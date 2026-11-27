import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { describe, it } from "node:test";

import { runAction } from "../../src/action/run.ts";

describe("runAction", () => {
  it("rejects a report directory with traversal before deleting the target", async () => {
    const base = await mkdtemp(join(tmpdir(), "autobahn-run-"));
    const cwd = join(base, "work");
    const victimDir = join(base, "victim");
    const victimFile = join(victimDir, "keep.txt");
    const traversalDir = `${join(base, "missing")}${sep}..${sep}victim`;
    const previousCwd = process.cwd();
    const previousReportDir = process.env["INPUT_REPORT-DIR"];
    const previousReadyTimeout = process.env["INPUT_SERVER-READY-TIMEOUT"];
    const previousExitCode = process.exitCode;

    try {
      await mkdir(cwd, { recursive: true });
      await mkdir(victimDir, { recursive: true });
      await writeFile(victimFile, "keep\n");

      process.chdir(cwd);
      process.env["INPUT_REPORT-DIR"] = traversalDir;
      process.env["INPUT_SERVER-READY-TIMEOUT"] = "1";

      let failure: Error | undefined;

      try {
        await runAction();
      } catch (cause) {
        failure = cause instanceof Error ? cause : new Error(String(cause));
      }

      assert.ok(failure);
      assert.match(failure.message, /normalized path without traversal/u);
      assert.equal((await stat(victimFile)).isFile(), true);
    } finally {
      process.chdir(previousCwd);

      if (previousReportDir === undefined) {
        delete process.env["INPUT_REPORT-DIR"];
      } else {
        process.env["INPUT_REPORT-DIR"] = previousReportDir;
      }

      if (previousReadyTimeout === undefined) {
        delete process.env["INPUT_SERVER-READY-TIMEOUT"];
      } else {
        process.env["INPUT_SERVER-READY-TIMEOUT"] = previousReadyTimeout;
      }

      process.exitCode = previousExitCode;
      await rm(base, { recursive: true, force: true });
    }
  });
});
