import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { isServerRunning, startServer, stopServer } from "../../src/server/start-server.ts";

const NODE_COMMAND = JSON.stringify(process.execPath);

async function waitUntil(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }

    await delay(20);
  }

  throw new Error("condition was not met before the timeout");
}

async function readPidFile(path: string): Promise<number> {
  const deadline = Date.now() + 5000;

  while (Date.now() < deadline) {
    try {
      const pid = Number((await readFile(path, "utf8")).trim());

      if (Number.isInteger(pid) && pid > 0) {
        return pid;
      }
    } catch {
      // The background shell may not have written the pid file yet.
    }

    await delay(20);
  }

  throw new Error("background child pid was not written before the timeout");
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
}

describe("startServer", () => {
  it("starts a shell command and stops it", async () => {
    const server = startServer(`${NODE_COMMAND} -e "setInterval(() => {}, 1000);"`, process.cwd());

    try {
      await delay(100);
      assert.equal(isServerRunning(server), true);

      await stopServer(server);

      assert.equal(server.hasExited(), true);
      assert.equal(isServerRunning(server), false);
    } finally {
      if (!server.hasExited()) {
        await stopServer(server);
      }
    }
  });

  it("observes the exit code of a quick command", async () => {
    const server = startServer(`${NODE_COMMAND} -e "process.exit(7);"`, process.cwd());

    try {
      await waitUntil(() => server.hasExited());

      assert.equal(server.exitCode(), 7);
      assert.equal(server.spawnError(), undefined);
      assert.equal(isServerRunning(server), false);
    } finally {
      if (!server.hasExited()) {
        await stopServer(server);
      }
    }
  });

  it("exposes a spawn error instead of throwing synchronously", async () => {
    const server = startServer(`${NODE_COMMAND} -e ""`, "/nonexistent-autobahn-directory");

    try {
      await waitUntil(() => server.spawnError() !== undefined);

      assert.equal(isServerRunning(server), false);
      assert.equal(server.hasExited(), true);
    } finally {
      await stopServer(server);
    }
  });

  it(
    "stops a background child after its shell has exited",
    { skip: process.platform === "win32" },
    async () => {
      const base = await mkdtemp(join(tmpdir(), "autobahn-background-"));
      const scriptPath = join(base, "child.mjs");
      const pidFile = join(base, "child.pid");

      await writeFile(scriptPath, "setInterval(() => {}, 1000);\n");

      const server = startServer(
        `${NODE_COMMAND} ${JSON.stringify(scriptPath)} & echo $! > ${JSON.stringify(pidFile)}`,
        base,
      );

      let backgroundPid: number | undefined;

      try {
        await waitUntil(() => server.hasExited());
        backgroundPid = await readPidFile(pidFile);

        const pid = backgroundPid;

        assert.equal(isProcessAlive(pid), true);

        await stopServer(server);
        await waitUntil(() => !isProcessAlive(pid));

        assert.equal(isProcessAlive(pid), false);
      } finally {
        if (backgroundPid !== undefined && isProcessAlive(backgroundPid)) {
          try {
            process.kill(backgroundPid, "SIGKILL");
          } catch {
            // The background child may exit between the check and the signal.
          }
        }

        await rm(base, { recursive: true, force: true });
      }
    },
  );

  it("stops idempotently", async () => {
    const server = startServer(`${NODE_COMMAND} -e "setInterval(() => {}, 1000);"`, process.cwd());

    try {
      await stopServer(server);
      await stopServer(server);

      assert.equal(server.hasExited(), true);
    } finally {
      if (!server.hasExited()) {
        await stopServer(server);
      }
    }
  });
});
