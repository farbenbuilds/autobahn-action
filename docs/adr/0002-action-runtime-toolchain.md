# ADR 0002: Action Runtime Toolchain

## Status

Accepted on 2026-11-28.

## Context

The action will be a JavaScript GitHub Action on the Node 24 runtime. It must
run subprocesses, decode untrusted report JSON, write files, publish outputs,
and ship as a single committed entry point. The implementation is deliberately
deferred, but the dependency choices affect the module layout, the security
boundary, and the release process.

The setup currently has no runtime dependency.

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

### @actions/artifact: no, for now

Consumers upload `autobahn-reports` with `actions/upload-artifact` in their
workflow. The action writes the report and returns its path. Adding artifact
upload would couple the action to the Actions artifact runtime and its token
environment without changing the test result.

Revisit this when a one-step experience without a consumer upload step becomes
a requirement.

### @vercel/ncc: no

Bundle with esbuild from `scripts/build.mjs`.

`ncc` is the older default for JavaScript actions, but it is slow, opaque, and
adds a second package manager surface. esbuild produces one CommonJS file for
the Node 24 runner, bundles runtime dependencies, and is fast enough to run on
every verification pass. The generated `dist/index.cjs` is committed because a
consumer's runner does not run the repository build.

The bundle is generated output. Review the source, the build script, and the
lockfile; do not hand-edit `dist`.

### zod: yes

Use zod at the report boundary. `servers/index.json` is untrusted, and the
anti-slop rules reject unchecked casts and `unknown` domain contracts. The
schema is the source of the decoded report type.

### node:test: yes

Use the Node test runner with native TypeScript execution. The action's pure
modules are small and do not need a framework. Docker lifecycle verification
belongs in the action self-test workflow, not in a mocked unit test.

### oxlint and oxfmt: yes

Oxlint enforces the anti-slop and project rules. Oxfmt owns formatting. Neither
is a runtime dependency.

## Consequences

- Runtime dependencies stay at two packages: `@actions/core` and `zod`.
- `@actions/exec`, `@actions/artifact`, and `@vercel/ncc` stay out of the tree
  until a documented requirement proves one is necessary.
- All subprocess calls use explicit argument arrays and explicit timeouts.
- The committed bundle is verified by rebuilding and diffing in CI.
- Reviewers hold the bundle to generated-output rules, not source-file rules.
