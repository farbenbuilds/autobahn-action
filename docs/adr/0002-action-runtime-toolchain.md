# ADR 0002: Action Runtime Toolchain

## Status

Accepted on 2026-11-28. Amended by
[ADR 0003](0003-automatic-report-artifact-upload.md): `@actions/artifact` is
now a planned runtime dependency, and by
[ADR 0004](0004-arktype-report-decoder.md): the report boundary uses ArkType
2.2.10.

## Context

The action will be a JavaScript GitHub Action on the Node 24 runtime. It must
run subprocesses, decode untrusted report JSON, write files, publish outputs,
and ship as a single committed entry point. The implementation is deliberately
deferred, but the dependency choices affect the module layout, the security
boundary, and the release process.

The setup originally had no runtime dependency. ADR 0003 adds
`@actions/artifact`, and ADR 0004 replaces the original report boundary schema
library. The other decisions here still apply.

## Decision

### @actions/core: yes

Use `@actions/core` as the runtime dependency for:

- reading action inputs
- setting outputs
- `info`, `warning`, and `error` logging
- `setFailed` and the process exit code
- step-summary support

It is the supported interface to the Actions runner and removes hand-rolled
`INPUT_*` and `GITHUB_OUTPUT` parsing from the action.

### @actions/exec: no

Use `node:child_process` directly.

The action needs process-group ownership for the consumer server, a hard
timeout for the suite container, inherited stdio, and a forced container
removal on timeout. `@actions/exec` wraps output buffering and shell escaping
that the action does not want, and it does not own those lifecycle concerns.
`spawn` and `spawnSync` with explicit argument arrays are smaller and clearer.

### @actions/artifact: originally no, now yes

The original decision kept artifact upload in the consumer's workflow. ADR
0003 replaces that part: the action uploads the report itself so a consumer
gets a downloadable result without a second step. See
[ADR 0003](0003-automatic-report-artifact-upload.md).

### @vercel/ncc: no

Bundle with esbuild from `scripts/build.mjs`.

`ncc` is the older default for JavaScript actions, but it is slow, opaque, and
adds a second package manager surface. esbuild produces one CommonJS file for
the Node 24 runner, bundles runtime dependencies, and is fast enough to run on
every verification pass. The generated `dist/index.cjs` is committed because a
consumer's runner does not run the repository build.

The bundle is generated output. Review the source, the build script, and the
lockfile; do not hand-edit `dist`.

### Report boundary schema library: ArkType

Use ArkType 2.2.10 at the report boundary. `servers/index.json` is untrusted,
and the anti-slop rules reject unchecked casts and `unknown` domain contracts.
The schema is the source of the decoded report type. ADR 0004 records the
nested index-signature schema and error handling.

### node:test: yes

Use the Node test runner with native TypeScript execution. The action's pure
modules are small and do not need a framework. Docker lifecycle verification
belongs in the action self-test workflow, not in a mocked unit test.

### oxlint and oxfmt: yes

Oxlint enforces the anti-slop and project rules. Oxfmt owns formatting. Neither
is a runtime dependency.

## Consequences

- Runtime dependencies are `@actions/core`, `@actions/artifact`, and `arktype`
  2.2.10.
- `@actions/exec` and `@vercel/ncc` stay out of the tree until a documented
  requirement proves one is necessary.
- All subprocess calls use explicit argument arrays and explicit timeouts.
- The committed bundle is verified by rebuilding and diffing in CI.
- Reviewers hold the bundle to generated-output rules, not source-file rules.
