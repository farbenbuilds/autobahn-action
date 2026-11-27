import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseReport } from "../../src/report/parse-report.ts";

const AGENT = "autobahn-action";

type ReportCaseJson = {
  behavior: string;
  behaviorClose?: string | null;
  duration?: number;
  remoteCloseCode?: number | null;
  reportfile?: string;
  extra?: string;
};

function reportSource(cases: Record<string, ReportCaseJson>): string {
  return JSON.stringify({ [AGENT]: cases });
}

describe("parseReport", () => {
  it("decodes the documented Autobahn report shape", () => {
    const source = reportSource({
      "1.1.1": {
        behavior: "OK",
        behaviorClose: "OK",
        duration: 12,
        remoteCloseCode: 1000,
        reportfile: "1.1.1.json",
      },
    });

    assert.deepEqual(parseReport(source, AGENT), [
      {
        id: "1.1.1",
        behavior: "OK",
        behaviorClose: "OK",
        durationMs: 12,
        remoteCloseCode: 1000,
        reportFile: "1.1.1.json",
      },
    ]);
  });

  it("rejects a report that does not contain the requested agent", () => {
    assert.throws(
      () => parseReport("{}", AGENT),
      /report does not contain agent "autobahn-action"/u,
    );
    assert.throws(
      () => parseReport(reportSource({}), "other-agent"),
      /report does not contain agent "other-agent"/u,
    );
  });

  it("rejects a report whose requested agent has no cases", () => {
    const source = `{"${AGENT}":{}}`;

    assert.throws(
      () => parseReport(source, AGENT),
      /report for agent "autobahn-action" contains no cases/u,
    );
  });

  it("rejects malformed JSON and preserves the syntax error as the cause", () => {
    let thrown: Error | undefined;

    try {
      parseReport("{", AGENT);
    } catch (error) {
      assert.ok(error instanceof Error);
      thrown = error;
    }

    assert.ok(thrown !== undefined);
    assert.equal(thrown.message, "report is not valid JSON");
    assert.ok(thrown.cause instanceof SyntaxError);
  });

  it("names the agent and a short issue path for invalid field types", () => {
    const source = `{"${AGENT}":{"1.1.1":{"behavior":7}}}`;

    assert.throws(
      () => parseReport(source, AGENT),
      /report for agent "autobahn-action" is invalid at autobahn-action\.1\.1\.1\.behavior/u,
    );
  });

  it("preserves the ArkType issue path for a malformed case record", () => {
    const source = `{"${AGENT}":{"1.1.1":"not a case"}}`;

    assert.throws(
      () => parseReport(source, AGENT),
      /report for agent "autobahn-action" is invalid at autobahn-action\.1\.1\.1/u,
    );
  });

  it("rejects an array agent record instead of classifying it", () => {
    const source = `{"${AGENT}":[{"behavior":"OK"}]}`;

    assert.throws(
      () => parseReport(source, AGENT),
      /report for agent "autobahn-action" is invalid at autobahn-action/u,
    );
  });

  it("rejects an array case record instead of classifying it", () => {
    const source = `{"${AGENT}":{"1.1.1":[{"behavior":"OK"}]}}`;

    assert.throws(
      () => parseReport(source, AGENT),
      /report for agent "autobahn-action" is invalid at autobahn-action\.1\.1\.1/u,
    );
  });

  it("rejects reports whose root is not an agent record", () => {
    assert.throws(() => parseReport("[]", AGENT), /is invalid at root/u);
    assert.throws(() => parseReport("null", AGENT), /is invalid at root/u);
  });

  it("maps null behaviorClose and remoteCloseCode to undefined", () => {
    const source = reportSource({
      "1.1.1": { behavior: "OK", behaviorClose: null, remoteCloseCode: null },
    });

    assert.deepEqual(parseReport(source, AGENT), [
      {
        id: "1.1.1",
        behavior: "OK",
        behaviorClose: undefined,
        durationMs: undefined,
        remoteCloseCode: undefined,
        reportFile: undefined,
      },
    ]);
  });

  it("maps missing optional fields to undefined", () => {
    const source = reportSource({ "1.1.1": { behavior: "OK" } });

    assert.deepEqual(parseReport(source, AGENT), [
      {
        id: "1.1.1",
        behavior: "OK",
        behaviorClose: undefined,
        durationMs: undefined,
        remoteCloseCode: undefined,
        reportFile: undefined,
      },
    ]);
  });

  it("strips unknown case fields", () => {
    const source = reportSource({
      "1.1.1": { behavior: "OK", extra: "ignored" },
    });

    assert.deepEqual(parseReport(source, AGENT), [
      {
        id: "1.1.1",
        behavior: "OK",
        behaviorClose: undefined,
        durationMs: undefined,
        remoteCloseCode: undefined,
        reportFile: undefined,
      },
    ]);
  });

  it("sorts cases naturally by numeric id segments", () => {
    const source = reportSource({
      "10.1.1": { behavior: "OK" },
      "2.1.1": { behavior: "OK" },
      "1.1.10": { behavior: "OK" },
      "1.1.2": { behavior: "OK" },
      "1.1.1": { behavior: "OK" },
    });

    const ids = parseReport(source, AGENT).map((reportCase) => reportCase.id);

    assert.deepEqual(ids, ["1.1.1", "1.1.2", "1.1.10", "2.1.1", "10.1.1"]);
  });

  it("rejects negative durations and fractional remote close codes", () => {
    assert.throws(
      () => parseReport(reportSource({ "1.1.1": { behavior: "OK", duration: -1 } }), AGENT),
      /is invalid at autobahn-action\.1\.1\.1\.duration/u,
    );
    assert.throws(
      () =>
        parseReport(reportSource({ "1.1.1": { behavior: "OK", remoteCloseCode: 1000.5 } }), AGENT),
      /is invalid at autobahn-action\.1\.1\.1\.remoteCloseCode/u,
    );
  });
});
