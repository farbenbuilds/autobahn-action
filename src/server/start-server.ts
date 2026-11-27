import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

export type ManagedServer = {
  child: ChildProcess;
  command: string;
  hasExited: () => boolean;
  exitCode: () => number | null;
  spawnError: () => Error | undefined;
};

const STOP_GRACE_MS = 5000;
const KILL_GRACE_MS = 2000;
const TASKKILL_TIMEOUT_MS = 5000;
const GROUP_POLL_INTERVAL_MS = 50;

function isMissingProcessError(error: Error): boolean {
  return "code" in error && error.code === "ESRCH";
}

function isProcessGroupAlive(pid: number): boolean {
  try {
    process.kill(-pid, 0);

    return true;
  } catch (error) {
    if (error instanceof Error && isMissingProcessError(error)) {
      return false;
    }

    return true;
  }
}

async function waitForProcessGroupExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (!isProcessGroupAlive(pid)) {
      return true;
    }

    await delay(Math.max(1, Math.min(GROUP_POLL_INTERVAL_MS, deadline - Date.now())));
  }

  return !isProcessGroupAlive(pid);
}

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

function signalProcessGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if (error instanceof Error && isMissingProcessError(error)) {
      return;
    }

    throw error;
  }
}

function runTaskkill(pid: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("taskkill", ["/pid", String(pid), "/t", "/f"], { stdio: "ignore" });
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
      finish(error);
    };

    const onExit = (): void => {
      finish(undefined);
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(undefined);
    }, TASKKILL_TIMEOUT_MS);

    child.once("error", onError);
    child.once("exit", onExit);
  });
}

export function isServerRunning(server: ManagedServer): boolean {
  return server.spawnError() === undefined && !server.hasExited() && server.child.pid !== undefined;
}

export function startServer(command: string, workingDirectory: string): ManagedServer {
  let exited = false;
  let observedExitCode: number | null = null;
  let observedSpawnError: Error | undefined;

  const child = spawn(command, {
    cwd: workingDirectory,
    shell: true,
    detached: process.platform !== "win32",
    stdio: "inherit",
  });

  child.once("exit", (code) => {
    exited = true;
    observedExitCode = code;
  });

  child.once("error", (error) => {
    observedSpawnError = error;
    exited = true;
  });

  return {
    child,
    command,
    hasExited: () => exited,
    exitCode: () => observedExitCode,
    spawnError: () => observedSpawnError,
  };
}

export async function stopServer(server: ManagedServer): Promise<void> {
  if (server.spawnError() !== undefined) {
    return;
  }

  const pid = server.child.pid;

  if (pid === undefined) {
    return;
  }

  if (process.platform === "win32") {
    try {
      await runTaskkill(pid);
    } catch {
      // taskkill is best effort before the direct child kill.
    }

    if (!server.hasExited()) {
      server.child.kill();
    }

    await waitForExit(server.child, KILL_GRACE_MS);

    return;
  }

  signalProcessGroup(pid, "SIGTERM");

  if (await waitForProcessGroupExit(pid, STOP_GRACE_MS)) {
    return;
  }

  signalProcessGroup(pid, "SIGKILL");
  await waitForProcessGroupExit(pid, KILL_GRACE_MS);
}
