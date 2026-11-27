import { setOutput } from "@actions/core";

import type { ArtifactUploadResult } from "../artifact/upload-report.ts";
import type { FailurePolicy, ReportCounts, RunOutcome } from "../domain/autobahn.ts";
import type { RunPaths } from "../report/paths.ts";

export type ActionOutputs = {
  outcome: RunOutcome;
  counts: ReportCounts;
  policy: FailurePolicy;
  paths: RunPaths;
  artifact: ArtifactUploadResult;
};

export type OutputValues = {
  ok: string;
  outcome: string;
  total: string;
  passed: string;
  failed: string;
  "non-strict": string;
  informational: string;
  policy: string;
  "report-dir": string;
  "index-path": string;
  "summary-path": string;
  "markdown-path": string;
  "artifact-id": string;
  "artifact-url": string;
  "artifact-size": string;
  "artifact-digest": string;
};

function formatArtifactField(
  artifact: ArtifactUploadResult,
  read: (uploaded: Extract<ArtifactUploadResult, { kind: "uploaded" }>) => string,
): string {
  return artifact.kind === "uploaded" ? read(artifact) : "";
}

export function formatOutputs(outputs: ActionOutputs): OutputValues {
  return {
    ok: outputs.outcome === "passed" ? "true" : "false",
    outcome: outputs.outcome,
    total: String(outputs.counts.total),
    passed: String(outputs.counts.passed),
    failed: String(outputs.counts.failed),
    "non-strict": String(outputs.counts.nonStrict),
    informational: String(outputs.counts.informational),
    policy: outputs.policy,
    "report-dir": outputs.paths.reportDir,
    "index-path": outputs.paths.indexFile,
    "summary-path": outputs.paths.summaryFile,
    "markdown-path": outputs.paths.markdownFile,
    "artifact-id": formatArtifactField(outputs.artifact, (uploaded) => String(uploaded.id)),
    "artifact-url": formatArtifactField(outputs.artifact, (uploaded) => uploaded.url ?? ""),
    "artifact-size": formatArtifactField(outputs.artifact, (uploaded) => String(uploaded.size)),
    "artifact-digest": formatArtifactField(outputs.artifact, (uploaded) => uploaded.digest),
  };
}

export function publishOutputs(outputs: ActionOutputs): void {
  const values = formatOutputs(outputs);

  const pairs: [string, string][] = [
    ["ok", values.ok],
    ["outcome", values.outcome],
    ["total", values.total],
    ["passed", values.passed],
    ["failed", values.failed],
    ["non-strict", values["non-strict"]],
    ["informational", values.informational],
    ["policy", values.policy],
    ["report-dir", values["report-dir"]],
    ["index-path", values["index-path"]],
    ["summary-path", values["summary-path"]],
    ["markdown-path", values["markdown-path"]],
    ["artifact-id", values["artifact-id"]],
    ["artifact-url", values["artifact-url"]],
    ["artifact-size", values["artifact-size"]],
    ["artifact-digest", values["artifact-digest"]],
  ];

  for (const [name, value] of pairs) {
    setOutput(name, value);
  }
}
