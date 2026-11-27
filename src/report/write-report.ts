import { writeFile } from "node:fs/promises";

import { summary } from "@actions/core";

import type { RunPaths } from "./paths.ts";
import type { SummaryDocument } from "./format-summary.ts";

export type ReportFiles = {
  paths: RunPaths;
  document: SummaryDocument;
  markdown: string;
};

export async function writeReportFiles(files: ReportFiles): Promise<void> {
  await writeFile(files.paths.summaryFile, `${JSON.stringify(files.document, null, 2)}\n`, "utf8");
  await writeFile(files.paths.markdownFile, files.markdown, "utf8");
}

export async function appendStepSummary(markdown: string): Promise<void> {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;

  if (summaryPath === undefined || summaryPath.trim() === "") {
    return;
  }

  await summary.addRaw(markdown).write();
}
