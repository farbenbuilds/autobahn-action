import { type as arkType } from "arktype";

import type { ReportCase } from "../domain/autobahn.ts";

const reportCaseSchema = arkType({
  behavior: "string",
  "behaviorClose?": "string | null",
  "duration?": "number >= 0",
  "remoteCloseCode?": "number.integer | null",
  "reportfile?": "string",
});

const reportSchema = arkType({ "[string]": { "[string]": reportCaseSchema } });

const CASE_ID_COLLATOR = new Intl.Collator("en", { numeric: true });

type DecodedReport = typeof reportSchema.infer;

type DecodedReportCase = typeof reportCaseSchema.infer;

function invalidReportError(agent: string, detail: string): Error {
  return new Error(`report for agent ${JSON.stringify(agent)} is invalid at ${detail}`);
}

function toReportCase(id: string, decodedCase: DecodedReportCase): ReportCase {
  return {
    id,
    behavior: decodedCase.behavior,
    behaviorClose: decodedCase.behaviorClose ?? undefined,
    durationMs: decodedCase.duration,
    remoteCloseCode: decodedCase.remoteCloseCode ?? undefined,
    reportFile: decodedCase.reportfile,
  };
}

function decodeReport(source: string, agent: string): DecodedReport {
  let parsedSource: unknown;

  try {
    parsedSource = JSON.parse(source);
  } catch (cause) {
    throw new Error("report is not valid JSON", { cause });
  }

  if (Array.isArray(parsedSource)) {
    throw invalidReportError(agent, "root");
  }

  const result = reportSchema(parsedSource);

  if (result instanceof arkType.errors) {
    const issuePath = result.issues[0]?.path.join(".");
    const detail = issuePath === undefined || issuePath === "" ? "root" : issuePath;

    throw invalidReportError(agent, detail);
  }

  return result;
}

export function parseReport(source: string, agent: string): ReportCase[] {
  const report = decodeReport(source, agent);

  if (!Object.hasOwn(report, agent)) {
    throw new Error(`report does not contain agent ${JSON.stringify(agent)}`);
  }

  const agentReport = report[agent];

  if (agentReport === undefined) {
    throw new Error(`report for agent ${JSON.stringify(agent)} contains no cases`);
  }

  if (Array.isArray(agentReport)) {
    throw invalidReportError(agent, agent);
  }

  if (Object.keys(agentReport).length === 0) {
    throw new Error(`report for agent ${JSON.stringify(agent)} contains no cases`);
  }

  const cases: ReportCase[] = [];

  for (const [id, decodedCase] of Object.entries(agentReport)) {
    if (Array.isArray(decodedCase)) {
      throw invalidReportError(agent, `${agent}.${id}`);
    }

    cases.push(toReportCase(id, decodedCase));
  }

  return cases.toSorted((left, right) => CASE_ID_COLLATOR.compare(left.id, right.id));
}
