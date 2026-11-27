import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyReport } from "../../src/report/classify.ts";

import type { CaseStatus, FailurePolicy, ReportCase } from "../../src/domain/autobahn.ts";

function createCase(
  id: string,
  behavior: string,
  behaviorClose: string | undefined = undefined,
): ReportCase {
  return {
    id,
    behavior,
    behaviorClose,
    durationMs: undefined,
    remoteCloseCode: undefined,
    reportFile: undefined,
  };
}

function statuses(cases: ReportCase[]): CaseStatus[] {
  return classifyReport(cases, "failed").cases.map((reportCase) => reportCase.status);
}

describe("classifyReport", () => {
  it("classifies every tolerated behavior token", () => {
    const expectations: [string, string][] = [
      ["OK", "passed"],
      ["INFORMATIONAL", "informational"],
      ["NON-STRICT", "non-strict"],
    ];

    for (const [behavior, expected] of expectations) {
      assert.equal(statuses([createCase("1.1.1", behavior)])[0], expected);
    }
  });

  it("classifies every tolerated behaviorClose token", () => {
    const expectations: [string, string][] = [
      ["OK", "passed"],
      ["INFORMATIONAL", "informational"],
      ["NON-STRICT", "non-strict"],
    ];

    for (const [behaviorClose, expected] of expectations) {
      assert.equal(statuses([createCase("1.1.1", "OK", behaviorClose)])[0], expected);
    }
  });

  it("fails unknown behavior tokens on either side", () => {
    for (const behavior of ["FAILED", "WRONG", "ok", ""]) {
      assert.equal(statuses([createCase("1.1.1", behavior)])[0], "failed");
      assert.equal(statuses([createCase("1.1.1", "OK", behavior)])[0], "failed");
    }
  });

  it("takes the worst of behavior and behaviorClose", () => {
    const cases = [
      createCase("1.1.1", "OK", undefined),
      createCase("1.1.2", "OK", "OK"),
      createCase("1.1.3", "OK", "INFORMATIONAL"),
      createCase("1.1.4", "INFORMATIONAL", "OK"),
      createCase("1.1.5", "NON-STRICT", "OK"),
      createCase("1.1.6", "OK", "NON-STRICT"),
      createCase("1.1.7", "INFORMATIONAL", "NON-STRICT"),
      createCase("1.1.8", "NON-STRICT", "INFORMATIONAL"),
      createCase("1.1.9", "OK", "FAILED"),
      createCase("1.1.10", "NON-STRICT", "FAILED"),
      createCase("1.1.11", "FAILED", "OK"),
    ];

    assert.deepEqual(statuses(cases), [
      "passed",
      "passed",
      "informational",
      "informational",
      "non-strict",
      "non-strict",
      "non-strict",
      "non-strict",
      "failed",
      "failed",
      "failed",
    ]);
  });

  it("partitions the total across statuses exactly", () => {
    const cases = [
      createCase("1.1.1", "OK"),
      createCase("1.1.2", "INFORMATIONAL"),
      createCase("1.1.3", "NON-STRICT"),
      createCase("1.1.4", "FAILED"),
    ];

    const counts = classifyReport(cases, "failed").counts;

    assert.equal(counts.total, 4);
    assert.equal(counts.passed, 1);
    assert.equal(counts.informational, 1);
    assert.equal(counts.nonStrict, 1);
    assert.equal(counts.failed, 1);
    assert.equal(
      counts.passed + counts.informational + counts.nonStrict + counts.failed,
      counts.total,
    );
  });

  it("fails on failed cases under the failed and non-strict policies", () => {
    const cases = [createCase("1.1.1", "FAILED")];
    const policies: FailurePolicy[] = ["failed", "non-strict", "never"];

    assert.deepEqual(
      policies.map((policy) => classifyReport(cases, policy).outcome),
      ["failed", "failed", "passed"],
    );
  });

  it("fails on non-strict cases only under the non-strict policy", () => {
    const cases = [createCase("1.1.1", "NON-STRICT")];
    const policies: FailurePolicy[] = ["failed", "non-strict", "never"];

    assert.deepEqual(
      policies.map((policy) => classifyReport(cases, policy).outcome),
      ["passed", "failed", "passed"],
    );
  });

  it("passes informational cases under every policy", () => {
    const cases = [createCase("1.1.1", "INFORMATIONAL")];
    const policies: FailurePolicy[] = ["failed", "non-strict", "never"];

    assert.deepEqual(
      policies.map((policy) => classifyReport(cases, policy).outcome),
      ["passed", "passed", "passed"],
    );
  });

  it("preserves the policy and natural order of failed and non-strict subsets", () => {
    const cases = [
      createCase("1.1.1", "OK"),
      createCase("1.1.2", "FAILED"),
      createCase("1.1.10", "NON-STRICT"),
      createCase("1.1.11", "FAILED"),
      createCase("2.1.1", "INFORMATIONAL"),
    ];

    const before = cases.map((reportCase) => ({ ...reportCase }));

    const classification = classifyReport(cases, "non-strict");

    assert.equal(classification.policy, "non-strict");
    assert.deepEqual(
      classification.failedCases.map((reportCase) => reportCase.id),
      ["1.1.2", "1.1.11"],
    );
    assert.deepEqual(
      classification.nonStrictCases.map((reportCase) => reportCase.id),
      ["1.1.10"],
    );
    assert.deepEqual(cases, before);
  });

  it("handles an empty case list without producing a failure", () => {
    const classification = classifyReport([], "non-strict");

    assert.equal(classification.outcome, "passed");
    assert.deepEqual(classification.counts, {
      total: 0,
      passed: 0,
      failed: 0,
      nonStrict: 0,
      informational: 0,
    });
    assert.deepEqual(classification.failedCases, []);
    assert.deepEqual(classification.nonStrictCases, []);
  });
});
