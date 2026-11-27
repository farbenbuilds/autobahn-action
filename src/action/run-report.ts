import { access, readFile } from "node:fs/promises";

import { info, setFailed, warning } from "@actions/core";

import { uploadReport } from "../artifact/upload-report.ts";
import type {
  ArtifactContext,
  ArtifactSettings,
  ArtifactUploadResult,
} from "../artifact/upload-report.ts";
import type {
  FailurePolicy,
  ReportClassification,
  ReportCounts,
  RunOutcome,
} from "../domain/autobahn.ts";
import { classifyReport } from "../report/classify.ts";
import {
  buildFailureSummaryDocument,
  buildSummaryDocument,
  formatSummaryMarkdown,
} from "../report/format-summary.ts";
import type { SummaryDocument } from "../report/format-summary.ts";
import { parseReport } from "../report/parse-report.ts";
import type { RunPaths } from "../report/paths.ts";
import { appendStepSummary, writeReportFiles } from "../report/write-report.ts";
import { buildAnnotations, publishAnnotations } from "./annotate.ts";
import type { ActionInputs } from "./inputs.ts";
import { publishOutputs } from "./outputs.ts";
import type { ActionOutputs } from "./outputs.ts";

export type ReportRunContext = {
  inputs: ActionInputs;
  paths: RunPaths;
  artifactSettings: ArtifactSettings;
  artifactContext: ArtifactContext;
};

const ZERO_COUNTS: ReportCounts = {
  total: 0,
  passed: 0,
  failed: 0,
  nonStrict: 0,
  informational: 0,
};

function failureClassification(policy: FailurePolicy): ReportClassification {
  return {
    counts: { ...ZERO_COUNTS },
    cases: [],
    failedCases: [],
    nonStrictCases: [],
    policy,
    outcome: "failed",
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);

    return true;
  } catch {
    // A missing or unreadable index is treated as missing and fails closed.
    return false;
  }
}

function describeArtifactResult(result: ArtifactUploadResult): void {
  switch (result.kind) {
    case "uploaded": {
      info(`Uploaded artifact ${result.id} with ${result.fileCount} files (${result.size} bytes).`);

      if (result.url !== undefined) {
        info(`Artifact URL: ${formatDisplayUrl(result.url)}`);
      }

      return;
    }

    case "skipped":
      info(`Artifact upload skipped: ${result.reason}`);

      return;
    case "failed":
      warning(`Artifact upload failed: ${result.message}`);
  }
}

function formatDisplayUrl(value: string): string {
  try {
    const url = new URL(value);

    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";

    return url.href;
  } catch {
    return "(invalid URL)";
  }
}

async function uploadEvidence(context: ReportRunContext): Promise<ArtifactUploadResult> {
  const result = await uploadReport(context.artifactSettings, context.artifactContext);

  describeArtifactResult(result);

  return result;
}

async function writeSummary(context: ReportRunContext, document: SummaryDocument): Promise<void> {
  const markdown = formatSummaryMarkdown(document);

  await writeReportFiles({
    paths: context.paths,
    document,
    markdown,
  });

  if (context.inputs.summary) {
    await appendStepSummary(markdown);
  }
}

async function publishRunOutputs(
  context: ReportRunContext,
  outcome: RunOutcome,
  counts: ReportCounts,
): Promise<void> {
  const artifact = await uploadEvidence(context);

  publishOutputs({
    outcome,
    counts,
    policy: context.inputs.failOn,
    paths: context.paths,
    artifact,
  });
}

async function summarizeClassification(
  context: ReportRunContext,
  classification: ReportClassification,
  errorMessage: string | undefined,
): Promise<void> {
  const document = buildSummaryDocument(
    classification,
    context.inputs.agent,
    new Date().toISOString(),
    errorMessage,
  );

  await writeSummary(context, document);

  if (context.inputs.annotate) {
    publishAnnotations(buildAnnotations(classification, context.inputs.failOn));
  }

  await publishRunOutputs(context, classification.outcome, classification.counts);
}

export async function reportFailure(context: ReportRunContext, failure: Error): Promise<void> {
  const classification = failureClassification(context.inputs.failOn);

  try {
    const document = buildFailureSummaryDocument(
      context.inputs.agent,
      new Date().toISOString(),
      context.inputs.failOn,
      failure.message,
    );

    await writeSummary(context, document);
  } catch (summaryError) {
    warning(
      `Failed to write the failure summary: ${
        summaryError instanceof Error ? summaryError.message : String(summaryError)
      }`,
    );
  }

  const artifact = await uploadEvidence(context);

  const outputs: ActionOutputs = {
    outcome: "failed",
    counts: classification.counts,
    policy: classification.policy,
    paths: context.paths,
    artifact,
  };

  publishOutputs(outputs);
  setFailed(failure.message);
}

export async function reportSuiteResult(
  context: ReportRunContext,
  suiteError: Error | undefined,
): Promise<void> {
  if (!(await fileExists(context.paths.indexFile))) {
    await reportFailure(
      context,
      suiteError ?? new Error(`Autobahn report is missing at ${context.paths.indexFile}`),
    );

    return;
  }

  let classification: ReportClassification;

  try {
    const source = await readFile(context.paths.indexFile, "utf8");
    const cases = parseReport(source, context.inputs.agent);

    classification = classifyReport(cases, context.inputs.failOn);
  } catch (cause) {
    await reportFailure(context, cause instanceof Error ? cause : new Error(String(cause)));

    return;
  }

  const effectiveClassification: ReportClassification =
    suiteError === undefined ? classification : { ...classification, outcome: "failed" };

  try {
    await summarizeClassification(context, effectiveClassification, suiteError?.message);
  } catch (cause) {
    await reportFailure(context, cause instanceof Error ? cause : new Error(String(cause)));

    return;
  }

  if (suiteError !== undefined) {
    setFailed(suiteError.message);

    return;
  }

  if (effectiveClassification.outcome === "failed") {
    setFailed(
      `Autobahn policy ${context.inputs.failOn} failed with ${effectiveClassification.counts.failed} failed and ${effectiveClassification.counts.nonStrict} non-strict cases`,
    );

    return;
  }

  info(
    `Autobahn suite passed: ${effectiveClassification.counts.total} cases, ${effectiveClassification.counts.passed} passed, ${effectiveClassification.counts.failed} failed, ${effectiveClassification.counts.nonStrict} non-strict, ${effectiveClassification.counts.informational} informational.`,
  );
}
