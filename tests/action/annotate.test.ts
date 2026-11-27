import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAnnotations, publishAnnotations } from "../../src/action/annotate.ts";
import { classifyReport } from "../../src/report/classify.ts";

import type { ReportCase } from "../../src/domain/autobahn.ts";

function createCase(id: string, behavior: string, behaviorClose = "OK"): ReportCase {
  return {
    id,
    behavior,
    behaviorClose,
    durationMs: undefined,
    remoteCloseCode: undefined,
    reportFile: undefined,
  };
}

function failedCases(count: number): ReportCase[] {
  return Array.from({ length: count }, (_value, index) => createCase(`${index + 1}.1.1`, "FAILED"));
}

describe("buildAnnotations", () => {
  it("annotates failed cases as errors", () => {
    const classification = classifyReport(
      [createCase("1.1.1", "FAILED", "WRONG"), createCase("1.1.2", "OK")],
      "failed",
    );

    const annotations = buildAnnotations(classification, "failed");

    assert.equal(annotations.length, 1);
    assert.equal(annotations[0]?.level, "error");
    assert.equal(annotations[0]?.title, "Autobahn case failed");
    assert.match(annotations[0]?.message ?? "", /Case 1\.1\.1/u);
    assert.match(annotations[0]?.message ?? "", /behavior FAILED/u);
    assert.match(annotations[0]?.message ?? "", /behavior close WRONG/u);
  });

  it("adds non-strict warnings only under the non-strict policy", () => {
    const classification = classifyReport(
      [createCase("1.1.1", "FAILED"), createCase("1.1.2", "NON-STRICT")],
      "non-strict",
    );

    const warnings = buildAnnotations(classification, "non-strict");
    const errorsOnly = buildAnnotations(classification, "failed");

    assert.deepEqual(
      warnings.map((annotation) => annotation.level),
      ["error", "warning"],
    );
    assert.equal(warnings[1]?.title, "Autobahn non-strict case");
    assert.deepEqual(
      errorsOnly.map((annotation) => annotation.level),
      ["error"],
    );
  });

  it("caps annotations at fifty and keeps failed cases first", () => {
    const classification = classifyReport(failedCases(60), "failed");

    const annotations = buildAnnotations(classification, "failed");

    assert.equal(annotations.length, 50);
    assert.equal(
      annotations.every((annotation) => annotation.level === "error"),
      true,
    );
  });
});

describe("publishAnnotations", () => {
  it("publishes error and warning annotations", () => {
    const classification = classifyReport(
      [createCase("1.1.1", "FAILED"), createCase("1.1.2", "NON-STRICT")],
      "non-strict",
    );

    assert.doesNotThrow(() => {
      publishAnnotations(buildAnnotations(classification, "non-strict"));
    });
  });
});
