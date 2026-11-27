# autobahn-action

Run the [Autobahn WebSocket testsuite](https://github.com/crossbario/autobahn-testsuite)
from one GitHub Actions step. It can start your server, run the digest-pinned
suite, write reports, annotate failures, and apply your policy.

[![Lint](https://github.com/farbenbuilds/autobahn-action/actions/workflows/lint.yml/badge.svg)](https://github.com/farbenbuilds/autobahn-action/actions/workflows/lint.yml)
[![Test](https://github.com/farbenbuilds/autobahn-action/actions/workflows/test.yml/badge.svg)](https://github.com/farbenbuilds/autobahn-action/actions/workflows/test.yml)

## Quick start

```yaml
on: [push, pull_request]

permissions:
  contents: read

jobs:
  autobahn:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v7

      - uses: pnpm/setup@v3
        with:
          version: 12.4.2
          runtime: node@24.22.1

      - run: pnpm install --frozen-lockfile && pnpm build

      - uses: farbenbuilds/autobahn-action@v1
        with:
          server-command: node dist/server.js
          url: ws://127.0.0.1:9001
          cases: 1.* 2.* 3.* 4.* 5.* 6.* 7.* 9.* 10.*
```

### Server started in a previous step

```yaml
- run: node dist/server.js &
- uses: farbenbuilds/autobahn-action@v1
  with:
    cases: 1.* 2.* 3.*
```

Leave `server-command` empty when another step owns the server. The action waits
for the handshake before it runs the suite.

## What it does

- Starts the optional server command and stops it on every exit path.
- Waits for a WebSocket handshake, not only a TCP connect.
- Runs the digest-pinned Autobahn image with explicit Docker arguments.
- Writes JSON and Markdown summaries, appends the step summary, annotates
  failures.
- Applies the `fail-on` policy and uploads the report even when it fails.

## Inputs

| Input                      | Default                                | Purpose                                  |
| -------------------------- | -------------------------------------- | ---------------------------------------- |
| `url`                      | `ws://127.0.0.1:9001`                  | WebSocket target                         |
| `server-command`           | empty                                  | Optional command that starts the server  |
| `server-working-directory` | `.`                                    | Working directory for the command        |
| `server-ready-timeout`     | `30`                                   | Seconds to wait for a handshake          |
| `cases`                    | `1.* 2.* 3.* 4.* 5.* 6.* 7.* 9.* 10.*` | Space- or comma-separated case patterns  |
| `exclude-cases`            | empty                                  | Case patterns to skip                    |
| `agent`                    | `autobahn-action`                      | Agent key in the report                  |
| `report-dir`               | `autobahn-reports`                     | Report, summary, and Markdown output     |
| `docker-image`             | pinned Autobahn digest                 | Testsuite image; must keep a digest      |
| `docker-network`           | `auto`                                 | `auto`, `host`, or `bridge`              |
| `timeout`                  | `1800`                                 | Seconds allowed for the container        |
| `fail-on`                  | `failed`                               | `failed`, `non-strict`, or `never`       |
| `summary`                  | `true`                                 | Append the report to the step summary    |
| `annotate`                 | `true`                                 | Annotate failed cases in the log         |
| `upload-artifact`          | `true`                                 | Upload the report as a workflow artifact |
| `artifact-name`            | `autobahn-report`                      | Artifact name; unique per run            |
| `retention-days`           | `30`                                   | Artifact retention; `0` uses the default |

`docker-image` defaults to `crossbario/autobahn-testsuite:0.8.2` by digest; see
`action.yml`.

## Outputs

| Output                                                            | Meaning                                         |
| ----------------------------------------------------------------- | ----------------------------------------------- |
| `ok`, `outcome`                                                   | Policy pass/fail result                         |
| `total`, `passed`, `failed`, `non-strict`, `informational`        | Case counts                                     |
| `policy`                                                          | Failure policy used for the run                 |
| `report-dir`, `index-path`, `summary-path`, `markdown-path`       | Report locations                                |
| `artifact-id`, `artifact-url`, `artifact-size`, `artifact-digest` | Artifact metadata; empty when skipped or failed |

## Case selection

The default covers groups 1 through 7, 9, and 10. Group 8 is omitted; the
compression groups 11 through 13 are excluded by default. Override `cases` to
opt in, and use `exclude-cases` to remove patterns:

```yaml
with:
  cases: 1.* 2.* 3.* 4.* 5.* 6.* 7.* 9.* 10.* 11.* 12.* 13.*
```

## Networking

`auto` uses host networking on Linux so a server bound to `127.0.0.1` is
reachable, and bridge networking elsewhere. `host` and `bridge` force either
mode. In bridge mode a loopback target is rewritten to `host.docker.internal`;
the server must listen on a container-reachable interface, not only on
`127.0.0.1`. Forcing bridge on Linux has the same caveat.

## Artifacts and permissions

The report directory is uploaded as the `autobahn-report` artifact after the
summary is written, including on the failure path. The upload uses the
runner-provided runtime token, needs no repository secret, and expected skips
are logged at informational level outside Actions or on unsupported GHES hosts.
An upload failure is logged as a warning. The workflow needs `contents: read`
only. Use a unique `artifact-name` for each matrix job.

## Development

```sh
pnpm install
pnpm verify              # check, typecheck, and tests
pnpm build               # rebuild dist/index.cjs
pnpm hooks:install
nix flake check
```

`dist/index.cjs` is committed because a consumer's runner does not build the
repository. Rebuild and diff it before review. `test.yml` rebuilds the bundle,
runs the unit tests, and runs the action against the echo server.

## Design notes

The action uses `@actions/core`, `@actions/artifact`, `arktype` 2.2.10,
`node:child_process`, `node:test`, and esbuild. The reasoning is in
[ADR 0002](docs/adr/0002-action-runtime-toolchain.md),
[ADR 0003](docs/adr/0003-automatic-report-artifact-upload.md), and
[ADR 0004](docs/adr/0004-arktype-report-decoder.md).

## Attribution

The harness follows
[fastwebsockets/server-test.js](https://github.com/denoland/fastwebsockets/blob/main/autobahn/server-test.js)
(Apache-2.0) for the configuration shape, default case selection, and flow. No
upstream source is vendored. The suite is the
[Autobahn testsuite](https://github.com/crossbario/autobahn-testsuite), which is
Apache-2.0. This action is MIT licensed under [LICENSE](LICENSE); see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
