# ADR 0004: ArkType Report Decoder

## Status

Accepted on 2026-11-28. Amends
[ADR 0002](0002-action-runtime-toolchain.md).

## Context

The Autobahn testsuite writes `servers/index.json`, which is untrusted input.
The report is a two-level map: agent name to case id to case record. The action
must reject malformed reports, keep the decoded values typed, and report a
short issue path without exposing the report body.

The project prefers schema-inferred types over hand-written decoders. The
schema should be the source of the decoded TypeScript type, and the runtime
must work on Node 24 with TypeScript 7.0.2.

## Decision

Use ArkType 2.2.10 at the report boundary. Define the case and report with
nested index signatures:

```ts
const reportCaseSchema = arkType({
  behavior: "string",
  "behaviorClose?": "string | null",
  "duration?": "number >= 0",
  "remoteCloseCode?": "number.integer | null",
  "reportfile?": "string",
});

const reportSchema = arkType({ "[string]": { "[string]": reportCaseSchema } });

type DecodedReport = typeof reportSchema.infer;
type DecodedReportCase = typeof reportCaseSchema.infer;
```

Decode with the schema call, branch on `instanceof arkType.errors`, and build
the concise path from the first issue path.

## Why ArkType over the previous schema library

ArkType's inference is 1:1 with TypeScript: `typeof schema.infer` is the
decoded type without a separate conversion layer. Its nested index-signature
schema is smaller than the previous library's equivalent for this report,
which needs only two string-keyed records and five case fields. The choice was
verified against TypeScript 7.0.2 and Node 24.

## Consequences

- Decode failures surface through ArkType's `ArkErrors`; the action reads the
  first issue path and keeps its existing concise error messages.
- ADR 0002's earlier schema-library choice is superseded by this decision.
- The committed bundle includes ArkType and its supporting packages.
