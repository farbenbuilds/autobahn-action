import type {
  ClassifiedCase,
  FailurePolicy,
  ReportClassification,
  ReportCounts,
  RunOutcome,
} from "../domain/autobahn.ts";

export type SummaryDocument = {
  schemaVersion: 1;
  agent: string;
  generatedAt: string;
  policy: FailurePolicy;
  outcome: RunOutcome;
  counts: ReportCounts;
  cases: ClassifiedCase[];
  error: string | undefined;
};

const NOT_AVAILABLE = "n/a";

const CASE_TABLE_HEADER = [
  "| Case | Behavior | Behavior close | Duration (ms) | Remote close code | Report file |",
  "| --- | --- | --- | ---: | ---: | --- |",
];

export function buildSummaryDocument(
  classification: ReportClassification,
  agent: string,
  generatedAt: string,
  error: string | undefined = undefined,
): SummaryDocument {
  return {
    schemaVersion: 1,
    agent,
    generatedAt,
    policy: classification.policy,
    outcome: classification.outcome,
    counts: { ...classification.counts },
    cases: [...classification.cases],
    error,
  };
}

function escapeTableCell(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replace(/\r\n|\r|\n/gu, "<br>");
}

function sanitizeInlineText(value: string): string {
  return value
    .replace(/\r\n|\r|\n/gu, " ")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("[", "&#91;")
    .replaceAll("]", "&#93;")
    .replaceAll("(", "&#40;")
    .replaceAll(")", "&#41;")
    .replaceAll("!", "&#33;")
    .replaceAll("~", "&#126;")
    .replaceAll("\\", "\\\\")
    .replaceAll("`", "\\`")
    .replaceAll("*", "\\*")
    .replaceAll("_", "\\_")
    .replaceAll("|", "\\|");
}

function formatOptionalText(value: string | undefined): string {
  return value === undefined ? NOT_AVAILABLE : escapeTableCell(value);
}

function formatOptionalNumber(value: number | undefined): string {
  return value === undefined ? NOT_AVAILABLE : String(value);
}

function formatCaseRow(reportCase: ClassifiedCase): string {
  const cells = [
    escapeTableCell(reportCase.id),
    escapeTableCell(reportCase.behavior),
    formatOptionalText(reportCase.behaviorClose),
    formatOptionalNumber(reportCase.durationMs),
    formatOptionalNumber(reportCase.remoteCloseCode),
    formatOptionalText(reportCase.reportFile),
  ];

  return `| ${cells.join(" | ")} |`;
}

function formatCountsTable(counts: ReportCounts): string[] {
  return [
    "| Count | Cases |",
    "| --- | ---: |",
    `| Total | ${counts.total} |`,
    `| Passed | ${counts.passed} |`,
    `| Failed | ${counts.failed} |`,
    `| Non-strict | ${counts.nonStrict} |`,
    `| Informational | ${counts.informational} |`,
  ];
}

export function buildFailureSummaryDocument(
  agent: string,
  generatedAt: string,
  policy: FailurePolicy,
  error: string,
): SummaryDocument {
  return {
    schemaVersion: 1,
    agent,
    generatedAt,
    policy,
    outcome: "failed",
    counts: {
      total: 0,
      passed: 0,
      failed: 0,
      nonStrict: 0,
      informational: 0,
    },
    cases: [],
    error,
  };
}

export function formatSummaryMarkdown(document: SummaryDocument): string {
  const failedCases = document.cases.filter((reportCase) => reportCase.status === "failed");

  const nonStrictCases = document.cases.filter((reportCase) => reportCase.status === "non-strict");

  const lines: string[] = [
    `# Autobahn WebSocket report: ${sanitizeInlineText(document.agent)}`,
    "",
    `Result: ${document.outcome}. Policy: ${document.policy}.`,
  ];

  if (document.error !== undefined) {
    lines.push(`Error: ${sanitizeInlineText(document.error)}`);
  }

  lines.push("", ...formatCountsTable(document.counts));

  if (failedCases.length === 0 && nonStrictCases.length === 0) {
    lines.push("", "No failed or non-strict cases.");

    return `${lines.join("\n")}\n`;
  }

  if (failedCases.length > 0) {
    lines.push("", "## Failed cases", "", ...CASE_TABLE_HEADER, ...failedCases.map(formatCaseRow));
  }

  if (nonStrictCases.length > 0) {
    lines.push(
      "",
      "## Non-strict cases",
      "",
      ...CASE_TABLE_HEADER,
      ...nonStrictCases.map(formatCaseRow),
    );
  }

  return `${lines.join("\n")}\n`;
}
