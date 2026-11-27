import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";

import type { DockerPlan } from "./docker.ts";

export type SuiteResult = {
  exitCode: number;
};

const CONTAINER_REMOVE_TIMEOUT_MS = 30_000;
const CLI_KILL_GRACE_MS = 5000;

function waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = (hasExited: boolean): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      child.off("exit", onExit);
      resolve(hasExited);
    };

    const onExit = (): void => {
      finish(true);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);

    child.once("exit", onExit);
  });
}

export function removeContainer(containerName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["rm", "-f", containerName], { stdio: "ignore" });
    let settled = false;

    const finish = (error: Error | undefined): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      child.off("error", onError);
      child.off("exit", onExit);

      if (error === undefined) {
        resolve();
      } else {
        reject(error);
      }
    };

    const onError = (error: Error): void => {
      finish(new Error("failed to remove the Autobahn container", { cause: error }));
    };

    const onExit = (code: number | null): void => {
      if (code === 0) {
        finish(undefined);

        return;
      }

      finish(new Error(`docker rm -f exited with code ${String(code)}`));
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error(`docker rm -f did not finish within ${CONTAINER_REMOVE_TIMEOUT_MS} ms`));
    }, CONTAINER_REMOVE_TIMEOUT_MS);

    child.once("error", onError);
    child.once("exit", onExit);
  });
}

export function runSuite(plan: DockerPlan, timeoutMs: number): Promise<SuiteResult> {
  return new Promise((resolve, reject) => {
    const [command, ...args] = plan.args;

    if (command === undefined) {
      reject(new Error("docker plan does not contain an executable"));

      return;
    }

    const child = spawn(command, args, { stdio: "inherit" });
    let settled = false;

    const finish = (error: Error | undefined, exitCode: number | undefined): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      child.off("error", onError);
      child.off("exit", onExit);

      if (error === undefined && exitCode !== undefined) {
        resolve({ exitCode });

        return;
      }

      reject(error ?? new Error("docker CLI exited without an exit code"));
    };

    const onError = (error: Error): void => {
      finish(new Error("failed to start the Autobahn container CLI", { cause: error }), undefined);
    };

    const onExit = (code: number | null): void => {
      if (code === null) {
        finish(new Error("docker CLI exited without an exit code"), undefined);

        return;
      }

      finish(undefined, code);
    };

    const onTimeout = async (): Promise<void> => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      child.off("error", onError);
      child.off("exit", onExit);

      try {
        await removeContainer(plan.containerName);
      } catch {
        // The timeout error is authoritative; container removal is best effort.
      }

      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }

      await waitForExit(child, CLI_KILL_GRACE_MS);
      reject(new Error(`Autobahn suite timed out after ${timeoutMs} ms`));
    };

    const timer = setTimeout(() => {
      void onTimeout();
    }, timeoutMs);

    child.once("error", onError);
    child.once("exit", onExit);
  });
}
