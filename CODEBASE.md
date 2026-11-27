# autobahn-action Codebase

## Status

Implementation is in progress. The runtime core is present: action input
parsing and validation, shared report types, the fuzzingclient configuration
builder, and Docker network and argument planning, each covered by unit tests.
The action entry point, server lifecycle, suite execution, report parsing and
summaries, artifact upload, `action.yml`, the committed bundle, and runtime
workflows land in the remaining slices.

The module layout below is the target boundary. Modules marked `present` are
implemented now; the rest are landing next. Keep this document current when a
module is added, renamed, or merged.

## Product Contract

The action runs the Autobahn WebSocket testsuite against a consumer's server.
One step starts the server, waits for a WebSocket handshake, runs the
digest-pinned `crossbario/autobahn-testsuite` container, parses
`servers/index.json`, writes machine and human summaries, annotates failures,
and exits with the configured policy.

The public surface is `action.yml`:

- inputs: target URL, optional server command and working directory, readiness
  timeout, case selection, exclusions, agent name, report directory, Docker
  image and network, suite timeout, failure policy, summary and annotation
  toggles
- outputs: pass/fail, counts, policy, report paths

The action must work with a server the consumer starts in a previous step and
with a server the action starts itself. The second form is the one-step
experience.

## Module Layout

```text
src/
  main.ts                     landing next: action entry point
  action/
    inputs.ts                 present: parse and validate action.yml inputs
    outputs.ts                landing next: publish action outputs
    run.ts                    landing next: orchestrate one suite run
  domain/
    autobahn.ts               present: named case and summary types
  server/
    start-server.ts           landing next: start and stop the consumer server
    wait-for-server.ts        landing next: WebSocket handshake readiness probe
  suite/
    config.ts                 present: fuzzingclient.json construction
    docker.ts                 present: URL mapping and Docker argument construction
    run-suite.ts              landing next: run the container with a timeout
  report/
    parse-report.ts           landing next: decode servers/index.json
    classify.ts               landing next: tolerate, classify, count, and policy
    format-summary.ts         landing next: render Markdown
    write-report.ts           landing next: persist JSON, Markdown, step summary
  artifact/
    upload-report.ts          landing next: enumerate files and upload one artifact
tests/
  report/                     landing next: parser, classifier, and renderer tests
  suite/                      present: config, URL mapping, and argument tests
  server/                     landing next: readiness and lifecycle tests
  action/                     present: input parsing tests
scripts/
  build.mjs                   landing next: esbuild bundle of the entry point
  check-conventions.mjs       present: mechanical repository checks
  integration-test.mjs        landing next: local Docker end-to-end check
dist/
  index.cjs                   landing next: committed CommonJS release bundle
```

Runtime dependencies are `@actions/core` for the runner interface and
`@actions/artifact` for report upload. The report boundary decoder lands with
the report pipeline and will use ArkType. Subprocesses use
`node:child_process` directly; tests use `node:test`. The
bundler is esbuild, not `@vercel/ncc`. The reasoning is in
[ADR 0002](docs/adr/0002-action-runtime-toolchain.md) and
[ADR 0003](docs/adr/0003-automatic-report-artifact-upload.md).

Every module stays below 500 lines. Split by responsibility, not by line
count, and never add a numbered continuation file.

## Data Flow

```text
action.yml
  -> action/inputs.ts            validated ActionInputs
  -> action/run.ts               owns the run timeline
       -> server/start-server    optional child process group
       -> server/wait-for-server WebSocket handshake
       -> suite/config           fuzzingclient.json
       -> suite/docker           argv array and container URL
       -> suite/run-suite        container lifecycle
       -> report/parse-report    validated case records
       -> report/classify        outcomes, counts, policy
       -> report/format-summary  Markdown
       -> report/write-report    JSON, Markdown, step summary
       -> artifact/upload        @actions/artifact report archive
  -> action/outputs.ts           GitHub outputs
```

The run timeline is the only place that sequences effects. Parsing,
classification, and rendering stay pure so they are testable without Docker.

## Invariants

- The Autobahn image is pinned by digest. A tag is not a reproducible case set.
- The report directory is created fresh for each run. A stale `index.json`
  must never make a failed run look green.
- The readiness probe completes a WebSocket handshake, not only a TCP connect.
- The server child is stopped on every path: success, suite failure, timeout,
  and readiness failure.
- The container is named, force-removed on timeout, and mounted with the
  caller's UID and GID so reports are readable.
- Docker arguments are an array. Only `server-command` is intentionally a
  shell command supplied by the consumer.
- Report and config mount paths are normalized, must be non-root, and must not
  contain traversal.
- Report JSON is untrusted. It is decoded into named types before use; a
  malformed report is an error, not an empty pass.
- `NON-STRICT` is tolerated by default and can fail the run through policy.
  `INFORMATIONAL` is tolerated because the suite uses it for cases that do not
  assert protocol behavior.
- A suite failure writes no passing summary. The action fails with the docker
  or readiness error.
- The Markdown report is appended to `GITHUB_STEP_SUMMARY` only when the
  summary input is enabled and the path exists.
- The report directory is uploaded as one immutable artifact after the summary
  is written, including when the policy fails. The upload is skipped with a
  warning outside Actions or on GHES, where the v2 artifact backend is not
  available.
- Artifact names must be unique in a workflow run. Matrix consumers override
  the default `autobahn-report` name per job.
- An artifact upload failure is a warning in the summary; it never rewrites
  the protocol result.

## External Contracts

### Autobahn configuration

The generated `fuzzingclient.json` mounts under `/reports`:

```json
{
  "outdir": "/reports/servers",
  "servers": [{ "agent": "autobahn-action", "url": "ws://127.0.0.1:9001/" }],
  "cases": ["1.*", "2.*", "3.*", "4.*", "5.*", "6.*", "7.*", "9.*", "10.*"],
  "exclude-cases": [],
  "exclude-agent-cases": {}
}
```

### Autobahn report

The suite writes `/reports/servers/index.json`:

```json
{
  "autobahn-action": {
    "1.1.1": {
      "behavior": "OK",
      "behaviorClose": "OK",
      "duration": 12,
      "remoteCloseCode": 1000
    }
  }
}
```

The outer key must match the `agent` input. A missing key is a hard error.

### Docker network

`auto` uses host networking on Linux so a server bound to `127.0.0.1` is
reachable. Elsewhere it uses bridge networking and maps a loopback target to
`host.docker.internal`. Consumers can force either mode. A forced bridge
container reaches a loopback server only when the server listens on the host
gateway interface.

## Ownership

`AGENT_DIRECTORY.md` is the ownership map. The developer owns runtime code,
tests, action metadata, and usage documentation. The integrator owns CI,
release, Nix, dependencies, and the agent platform files. The reviewer is
read-only. Cross-scope changes go through the owner.

## Generated and Vendored Trees

| Path                         | Kind      | Rule                                                |
| ---------------------------- | --------- | --------------------------------------------------- |
| `tools/oxlint/anti-slop/`    | vendored  | Upstream MIT code; update through install-anti-slop |
| `.agents/skills/`            | vendored  | Pinned by `skills-lock.json`; do not hand-edit      |
| `.opencode/skills/graphify/` | generated | Refresh with graphify installer                     |
| `.codex/skills/graphify/`    | generated | Refresh with graphify installer                     |
| `.claude/skills/graphify/`   | generated | Refresh with graphify installer                     |
| `.agents/skills/graphify/`   | generated | Refresh with graphify installer                     |
| `dist/`                      | generated | Committed release bundle; never edit by hand        |
| `graphify-out/`              | generated | Git-ignored knowledge graph                         |
| `node_modules/`              | generated | Never committed                                     |
