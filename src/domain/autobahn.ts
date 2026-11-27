export const TOLERATED_BEHAVIOR_TOKENS = ["OK", "NON-STRICT", "INFORMATIONAL"] as const;

export type ToleratedBehaviorToken = (typeof TOLERATED_BEHAVIOR_TOKENS)[number];

export const CASE_STATUSES = ["passed", "failed", "non-strict", "informational"] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];

export const FAILURE_POLICIES = ["failed", "non-strict", "never"] as const;

export type FailurePolicy = (typeof FAILURE_POLICIES)[number];

export const RUN_OUTCOMES = ["passed", "failed"] as const;

export type RunOutcome = (typeof RUN_OUTCOMES)[number];

export type ReportCase = {
  id: string;
  behavior: string;
  behaviorClose: string | undefined;
  durationMs: number | undefined;
  remoteCloseCode: number | undefined;
  reportFile: string | undefined;
};

export type ClassifiedCase = ReportCase & {
  status: CaseStatus;
};

export type ReportCounts = {
  total: number;
  passed: number;
  failed: number;
  nonStrict: number;
  informational: number;
};

export type ReportClassification = {
  counts: ReportCounts;
  cases: ClassifiedCase[];
  failedCases: ClassifiedCase[];
  nonStrictCases: ClassifiedCase[];
  policy: FailurePolicy;
  outcome: RunOutcome;
};
