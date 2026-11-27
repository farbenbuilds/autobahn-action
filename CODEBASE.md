# autobahn-action Codebase

## Status

Implementation is in progress. The runtime is implemented: action input
parsing, server lifecycle and readiness probing, Docker planning and suite
execution, report persistence, summary rendering, artifact upload, outputs,
annotations, and the orchestration entry point, each covered by unit tests.
`action.yml` and the committed `dist/index.cjs` bundle are present. The runtime
workflows, the local Docker self-test, and the final documentation pass remain.

The module layout below is the implemented boundary. Modules marked `present`
are implemented now; the rest are landing next. Keep this document current when
a module is added, renamed, or merged.

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
action.yml                    present: public input and output contract
src/
  main.ts                     present: action entry point and failure boundary
  action/
    inputs.ts                 present: parse and validate action.yml inputs
    outputs.ts                present: format and publish action outputs
    annotate.ts               present: failure and non-strict annotations
    run.ts                    present: orchestrate one suite run
    run-report.ts             present: summarize, upload, and finish a run
  domain/
    autobahn.ts               present: named case and summary types
  server/
    start-server.ts           present: start and stop the consumer server
    wait-for-server.ts        present: WebSocket handshake readiness probe
  suite/
    config.ts                 present: fuzzingclient.json construction
    docker.ts                 present: URL mapping and Docker argument construction
    run-suite.ts              present: run the container with a timeout
  report/
    paths.ts                  present: resolve report and summary paths
    prepare-report-dir.ts     present: guard, reset, and create the report tree
    parse-report.ts           present: decode servers/index.json
    classify.ts               present: classify, count, and apply policy
    format-summary.ts         present: build the summary document and Markdown
    write-report.ts           present: persist JSON, Markdown, step summary
  artifact/
    upload-report.ts          present: enumerate files and upload one artifact
tests/
  report/                     present: parser, classifier, renderer, guard, and writer tests
  suite/                      present: config, URL mapping, argument, and run tests
  server/                     present: readiness, lifecycle, and process-group tests
  action/                     present: input, output, annotation, and run tests
  artifact/                   present: skip, URL, file enumeration, and exclusion tests
  fixtures/
    echo-server.mjs           present: WebSocket echo server for the self-test
scripts/
  build.mjs                   present: esbuild bundle of the entry point
  check-conventions.mjs       present: mechanical repository checks
  integration-test.mjs        landing next: local Docker end-to-end check
dist/
  index.cjs                   present: committed CommonJS release bundle
```

Runtime dependencies are `@actions/core` for the runner interface,
`@actions/artifact` for report upload, and `arktype` 2.2.10 for boundary
decoding. Subprocesses use `node:child_process` directly; tests use
`node:test`. The bundler is esbuild, not `@vercel/ncc`. The reasoning is in
[ADR 0002](docs/adr/0002-action-runtime-toolchain.md),
[ADR 0003](docs/adr/0003-automatic-report-artifact-upload.md), and
[ADR 0004](docs/adr/0004-arktype-report-decoder.md).

Every module stays below 500 lines. Split by responsibility, not by line
count, and never add a numbered continuation file.

## Data Flow

```text
action.yml
  -> action/inputs.ts            validated ActionInputs
  -> action/run.ts               owns the run timeline
       -> report/paths           report, config, and summary paths
       -> report/prepare-report  guarded fresh report tree
       -> server/start-server    optional child process group
       -> server/wait-for-server WebSocket handshake
       -> suite/config           fuzzingclient.json
       -> suite/docker           argv array and container URL
       -> suite/run-suite        container lifecycle
       -> report/parse-report    validated case records
       -> report/classify        outcomes, counts, policy
       -> report/format-summary  Markdown and failure document
       -> report/write-report    JSON, Markdown, step summary
       -> action/annotate        failed and non-strict annotations
       -> artifact/upload        @actions/artifact report archive
  -> action/run-report.ts        failure and policy completion
  -> action/outputs.ts           GitHub outputs
```

The run timeline is the only place that sequences effects. Parsing,
classification, and rendering stay pure so they are testable without Docker.
The JSON and Markdown files are written before the artifact upload, and the
artifact result never changes the protocol outcome.

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
- Symlinks are rejected for report directories inside the workspace. External
  absolute report paths are canonicalized, as are the workspace and home
  references, and must not resolve into either protected location; the final
  component may not be a symlink. This keeps platform prefixes such as macOS
  `/var` usable.
- Report JSON is untrusted. It is decoded into named types before use; a
  malformed report is an error, not an empty pass.
- `NON-STRICT` is tolerated by default and can fail the run through policy.
  `INFORMATIONAL` is tolerated because the suite uses it for cases that do not
  assert protocol behavior.
- A suite failure writes no passing summary. A partial report is preserved with
  the suite error and uploaded as evidence; a missing or malformed report writes
  a failed summary with zero counts.
- The Markdown report is appended to `GITHUB_STEP_SUMMARY` only when the
  summary input is enabled and the path exists.
- Report and summary files are uploaded as one immutable artifact after the
  summary is written, including when the policy fails. The generated
  fuzzingclient.json stays local because its target URL can contain a token.
  The upload is skipped with a warning outside Actions or on GHES, where the v2
  artifact backend is not available.
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
