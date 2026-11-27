# autobahn-action Codebase

## Status

Implemented. The action parses and validates inputs, starts and stops the
consumer server, waits for a WebSocket handshake, runs the digest-pinned
Autobahn container, decodes and classifies `servers/index.json`, writes JSON and
Markdown summaries, appends the job summary, annotates failures, uploads the
report, publishes outputs, and exits with the configured policy. The input,
report, server, suite, action, and artifact modules are covered by unit tests.
`action.yml`, the committed `dist/index.cjs` bundle, and `test.yml` are current.

## Product Contract

One step runs the Autobahn WebSocket testsuite against a consumer's server:

```yaml
- uses: farbenbuilds/autobahn-action@<release-tag>
  with:
    server-command: node dist/server.js
```

The action also works when a previous step starts the server. The public
surface is `action.yml`:

- inputs: target URL, optional server command and working directory, readiness
  timeout, case selection, exclusions, agent name, report directory, Docker
  image and network, suite timeout, failure policy, summary and annotation
  toggles, artifact toggles
- outputs: pass/fail, counts, policy, report paths, artifact metadata

## Module Layout

```text
action.yml                    public input and output contract
rolldown.config.ts            release bundle entry point and output options
src/
  main.ts                     action entry point and failure boundary
  action/
    inputs.ts                 parse and validate action.yml inputs
    outputs.ts                format and publish action outputs
    annotate.ts               failure and non-strict annotations
    run.ts                    orchestrate one suite run
    run-report.ts             summarize, upload, publish, and finish a run
  domain/
    autobahn.ts               named case and summary types
  server/
    start-server.ts           start and stop the consumer server
    wait-for-server.ts        WebSocket handshake readiness probe
  suite/
    config.ts                 fuzzingclient.json construction
    docker.ts                 URL mapping and Docker argument construction
    run-suite.ts              run the container with a timeout
  report/
    paths.ts                  resolve report and summary paths
    prepare-report-dir.ts     guard, reset, and create the report tree
    parse-report.ts           decode servers/index.json
    classify.ts               classify, count, and apply policy
    format-summary.ts         build the summary document and Markdown
    write-report.ts           persist JSON, Markdown, step summary
  artifact/
    upload-report.ts          enumerate regular files and upload one artifact
tests/
  report/                     parser, classifier, renderer, paths, directory, writer
  suite/                      config, URL mapping, argument, and run tests
  server/                     readiness and lifecycle tests
  action/                     input, output, and annotation tests
  artifact/                   skip, URL, and file enumeration tests
  fixtures/
    echo-server.mjs           WebSocket echo server for the self-test
scripts/
  check-conventions.mjs       mechanical repository checks
  check-agent-parity.sh       four-client role and skill parity
  check-graphify-integrations.sh
                              four-client graphify parity
  check-skills-lock.mjs       skills-lock.json verification
  check-commit-msg.mjs        commit-message hook check
  oxlint-plugin.mjs           local no-emoji, no-enum, and no-OOP rules
  install-graphify-integrations.sh
                              refresh the graphify integrations
dist/
  index.cjs                   committed CommonJS release bundle
```

Every module stays below 500 lines. Split by responsibility, not by line count,
and never add a numbered continuation file.

Runtime dependencies are `@actions/core` for the runner interface,
`@actions/artifact` for report upload, and `arktype` 2.2.10 for boundary
decoding. Subprocesses use `node:child_process` directly; tests use
`node:test`. The bundler is Rolldown 1.3.4, configured by the root
`rolldown.config.ts` and run with `rolldown -c rolldown.config.ts`, not
`@vercel/ncc`. The reasoning is in
[ADR 0002](docs/adr/0002-action-runtime-toolchain.md),
[ADR 0003](docs/adr/0003-automatic-report-artifact-upload.md),
[ADR 0004](docs/adr/0004-arktype-report-decoder.md), and
[ADR 0005](docs/adr/0005-rolldown-release-bundle.md).

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
  caller's UID and GID where the platform provides them so reports are readable.
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
  summary input is enabled and `GITHUB_STEP_SUMMARY` is set.
- The report directory is uploaded as one immutable artifact after the summary
  is written, including when the policy fails.
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

## Artifact Behavior

The report directory is uploaded after the summary files are written, on the
success, policy-failure, and pre-report failure paths. The upload is skipped
with an informational log outside GitHub Actions, when `ACTIONS_RUNTIME_TOKEN`
or `ACTIONS_RESULTS_URL` is missing, when the input is disabled, when no regular
files exist, or on an unsupported GHES host. An upload failure is a warning and
never rewrites the protocol result. The action enumerates regular files with
`lstat` and does not follow symlinks. The runtime token and result URL are
redacted from error messages.

## Release Shape

The release ships the committed `dist/index.cjs`, which bundles the runtime
dependencies. The immutable release tag points at the commit whose `test.yml`
run on `main` passed; consumers reference that release tag. The release notes
come from the `CHANGELOG.md` entry for that release. There is no
release workflow yet; the repository owner creates the tag and GitHub release
after the test workflow passes on `main`. See
[CI_CD_PIPELINE.md](CI_CD_PIPELINE.md).

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
