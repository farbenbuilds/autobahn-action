import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { classifyReport } from "../../src/report/classify.ts";
import { buildSummaryDocument, formatSummaryMarkdown } from "../../src/report/format-summary.ts";
import { resolveRunPaths } from "../../src/report/paths.ts";
import { appendStepSummary, writeReportFiles } from "../../src/report/write-report.ts";

import type { ReportCase } from "../../src/domain/autobahn.ts";

const GENERATED_AT = "2026-11-28T12:00:00.000Z";

function createCase(): ReportCase {
  return {
    id: "1.1.1",
    behavior: "OK",
    behaviorClose: "OK",
    durationMs: 1,
    remoteCloseCode: 1000,
    reportFile: "1.1.1.json",
  };
}

describe("writeReportFiles", () => {
  it("writes JSON with a trailing newline and the Markdown report", async () => {
    const base = await mkdtemp(join(tmpdir(), "autobahn-write-"));
    const paths = resolveRunPaths(base, "reports");

    const document = buildSummaryDocument(
      classifyReport([createCase()], "failed"),
      "autobahn-action",
      GENERATED_AT,
    );

    const markdown = formatSummaryMarkdown(document);

    try {
      await mkdir(paths.reportDir, { recursive: true });

      await writeReportFiles({ paths, document, markdown });

      const json = await readFile(paths.summaryFile, "utf8");
      const rendered = await readFile(paths.markdownFile, "utf8");
      const parsed = JSON.parse(json);

      assert.ok(json.endsWith("\n"));
      assert.equal(parsed.agent, document.agent);
      assert.equal(parsed.generatedAt, document.generatedAt);
      assert.equal(parsed.policy, document.policy);
      assert.equal(parsed.outcome, document.outcome);
      assert.deepEqual(parsed.counts, document.counts);
      assert.deepEqual(parsed.cases, document.cases);
      assert.equal(rendered, markdown);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
});

describe("appendStepSummary", () => {
  it("does nothing when GITHUB_STEP_SUMMARY is absent", async () => {
    const previous = process.env.GITHUB_STEP_SUMMARY;

    try {
      delete process.env.GITHUB_STEP_SUMMARY;

      await appendStepSummary("# report\n");
    } finally {
      if (previous === undefined) {
        delete process.env.GITHUB_STEP_SUMMARY;
      } else {
        process.env.GITHUB_STEP_SUMMARY = previous;
      }
    }
  });

  it("appends Markdown to the step summary file", async () => {
    const base = await mkdtemp(join(tmpdir(), "autobahn-step-summary-"));
    const summaryPath = join(base, "summary.md");
    const previous = process.env.GITHUB_STEP_SUMMARY;

    try {
      await writeFile(summaryPath, "");
      process.env.GITHUB_STEP_SUMMARY = summaryPath;

      await appendStepSummary("# Autobahn report\n");

      const content = await readFile(summaryPath, "utf8");

      assert.match(content, /# Autobahn report/u);
    } finally {
      if (previous === undefined) {
        delete process.env.GITHUB_STEP_SUMMARY;
      } else {
        process.env.GITHUB_STEP_SUMMARY = previous;
      }

      await rm(base, { recursive: true, force: true });
    }
  });
});
