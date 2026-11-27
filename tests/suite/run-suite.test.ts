import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { runSuite } from "../../src/suite/run-suite.ts";

import type { DockerPlan } from "../../src/suite/docker.ts";

function createPlan(args: string[]): DockerPlan {
  return {
    args,
    containerUrl: "ws://127.0.0.1:9001/",
    network: "host",
    containerName: "autobahn-test-container",
  };
}

describe("runSuite", () => {
  it("returns the CLI exit code without throwing on a protocol failure", async () => {
    const result = await runSuite(createPlan([process.execPath, "-e", "process.exit(3);"]), 5000);

    assert.equal(result.exitCode, 3);
  });

  it("wraps a spawn error with its cause", async () => {
    await assert.rejects(
      runSuite(createPlan(["/nonexistent-autobahn-cli"]), 5000),
      (error: Error) => {
        assert.match(error.message, /failed to start the Autobahn container CLI/u);
        assert.ok(error.cause instanceof Error);

        return true;
      },
    );
  });

  it("rejects a signal exit without an exit code", async () => {
    await assert.rejects(
      runSuite(createPlan([process.execPath, "-e", 'process.kill(process.pid, "SIGKILL");']), 5000),
      /docker CLI exited without an exit code/u,
    );
  });

  it("rejects a timed-out CLI and swallows container cleanup failure", async () => {
    const emptyPath = await mkdtemp(join(tmpdir(), "autobahn-no-docker-"));
    const previousPath = process.env.PATH;

    try {
      process.env.PATH = emptyPath;

      await assert.rejects(
        runSuite(createPlan([process.execPath, "-e", "setInterval(() => {}, 1000);"]), 100),
        /Autobahn suite timed out after 100 ms/u,
      );
    } finally {
      if (previousPath === undefined) {
        delete process.env.PATH;
      } else {
        process.env.PATH = previousPath;
      }

      await rm(emptyPath, { recursive: true, force: true });
    }
  });

  it("rejects a plan with no executable", async () => {
    await assert.rejects(runSuite(createPlan([]), 5000), /does not contain an executable/u);
  });
});
