import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { formatOutputs, publishOutputs } from "../../src/action/outputs.ts";

import type { ActionOutputs } from "../../src/action/outputs.ts";
import type { ArtifactUploadResult } from "../../src/artifact/upload-report.ts";
import type { ReportCounts } from "../../src/domain/autobahn.ts";
import type { RunPaths } from "../../src/report/paths.ts";

const PATHS: RunPaths = {
  reportDir: "/work/autobahn-reports",
  configFile: "/work/autobahn-reports/fuzzingclient.json",
  indexFile: "/work/autobahn-reports/servers/index.json",
  summaryFile: "/work/autobahn-reports/summary.json",
  markdownFile: "/work/autobahn-reports/summary.md",
};

const COUNTS: ReportCounts = {
  total: 10,
  passed: 7,
  failed: 2,
  nonStrict: 1,
  informational: 0,
};

function uploadedArtifact(): ArtifactUploadResult {
  return {
    kind: "uploaded",
    id: 42,
    size: 1234,
    digest: "sha256:abc",
    url: "https://github.com/owner/repository/actions/runs/1/artifacts/42",
    fileCount: 3,
  };
}

describe("formatOutputs", () => {
  it("formats every output for an uploaded artifact", () => {
    const values = formatOutputs({
      outcome: "passed",
      counts: COUNTS,
      policy: "failed",
      paths: PATHS,
      artifact: uploadedArtifact(),
    });

    assert.deepEqual(values, {
      ok: "true",
      outcome: "passed",
      total: "10",
      passed: "7",
      failed: "2",
      "non-strict": "1",
      informational: "0",
      policy: "failed",
      "report-dir": "/work/autobahn-reports",
      "index-path": "/work/autobahn-reports/servers/index.json",
      "summary-path": "/work/autobahn-reports/summary.json",
      "markdown-path": "/work/autobahn-reports/summary.md",
      "artifact-id": "42",
      "artifact-url": "https://github.com/owner/repository/actions/runs/1/artifacts/42",
      "artifact-size": "1234",
      "artifact-digest": "sha256:abc",
    });
  });

  it("uses false for a failed outcome and blanks skipped artifact fields", () => {
    const outputs: ActionOutputs = {
      outcome: "failed",
      counts: COUNTS,
      policy: "non-strict",
      paths: PATHS,
      artifact: { kind: "skipped", reason: "not-actions" },
    };

    const values = formatOutputs(outputs);

    assert.equal(values.ok, "false");
    assert.equal(values.outcome, "failed");
    assert.equal(values["artifact-id"], "");
    assert.equal(values["artifact-url"], "");
    assert.equal(values["artifact-size"], "");
    assert.equal(values["artifact-digest"], "");
  });
});

describe("publishOutputs", () => {
  it("publishes every explicit output pair", async () => {
    const base = await mkdtemp(join(tmpdir(), "autobahn-outputs-"));
    const outputPath = join(base, "output");
    const previous = process.env.GITHUB_OUTPUT;

    try {
      await writeFile(outputPath, "");
      process.env.GITHUB_OUTPUT = outputPath;

      publishOutputs({
        outcome: "failed",
        counts: COUNTS,
        policy: "failed",
        paths: PATHS,
        artifact: uploadedArtifact(),
      });

      const content = await readFile(outputPath, "utf8");

      assert.match(content, /ok<<[^\n]*\nfalse\n/u);
      assert.match(content, /outcome<<[^\n]*\nfailed\n/u);
      assert.match(content, /total<<[^\n]*\n10\n/u);
      assert.match(content, /non-strict<<[^\n]*\n1\n/u);
      assert.match(content, /report-dir<<[^\n]*\n\/work\/autobahn-reports\n/u);
      assert.match(content, /artifact-id<<[^\n]*\n42\n/u);
      assert.match(content, /artifact-digest<<[^\n]*\nsha256:abc\n/u);
    } finally {
      if (previous === undefined) {
        delete process.env.GITHUB_OUTPUT;
      } else {
        process.env.GITHUB_OUTPUT = previous;
      }

      await rm(base, { recursive: true, force: true });
    }
  });
});
