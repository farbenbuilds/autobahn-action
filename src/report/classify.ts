import {
  TOLERATED_BEHAVIOR_TOKENS,
  type CaseStatus,
  type ClassifiedCase,
  type FailurePolicy,
  type ReportCase,
  type ReportClassification,
  type ReportCounts,
  type RunOutcome,
} from "../domain/autobahn.ts";

function isToleratedBehavior(behavior: string): boolean {
  return TOLERATED_BEHAVIOR_TOKENS.some((token) => token === behavior);
}

function classifyStatus(behavior: string, behaviorClose: string | undefined): CaseStatus {
  if (!isToleratedBehavior(behavior)) {
    return "failed";
  }

  if (behaviorClose !== undefined && !isToleratedBehavior(behaviorClose)) {
    return "failed";
  }

  if (behavior === "NON-STRICT" || behaviorClose === "NON-STRICT") {
    return "non-strict";
  }

  if (behavior === "INFORMATIONAL" || behaviorClose === "INFORMATIONAL") {
    return "informational";
  }

  return "passed";
}

function outcomeFor(policy: FailurePolicy, counts: ReportCounts): RunOutcome {
  switch (policy) {
    case "failed":
      return counts.failed > 0 ? "failed" : "passed";
    case "non-strict":
      return counts.failed > 0 || counts.nonStrict > 0 ? "failed" : "passed";
    case "never":
      return "passed";
  }
}

export function classifyReport(cases: ReportCase[], policy: FailurePolicy): ReportClassification {
  const classifiedCases: ClassifiedCase[] = [];
  const failedCases: ClassifiedCase[] = [];
  const nonStrictCases: ClassifiedCase[] = [];
  let passed = 0;
  let failed = 0;
  let nonStrict = 0;
  let informational = 0;

  for (const reportCase of cases) {
    const classifiedCase: ClassifiedCase = {
      ...reportCase,
      status: classifyStatus(reportCase.behavior, reportCase.behaviorClose),
    };

    classifiedCases.push(classifiedCase);

    switch (classifiedCase.status) {
      case "failed":
        failed += 1;
        failedCases.push(classifiedCase);
        break;
      case "non-strict":
        nonStrict += 1;
        nonStrictCases.push(classifiedCase);
        break;
      case "informational":
        informational += 1;
        break;
      case "passed":
        passed += 1;
        break;
    }
  }

  const counts: ReportCounts = {
    total: cases.length,
    passed,
    failed,
    nonStrict,
    informational,
  };

  return {
    counts,
    cases: classifiedCases,
    failedCases,
    nonStrictCases,
    policy,
    outcome: outcomeFor(policy, counts),
  };
}
