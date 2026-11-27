# autobahn-action

Run the [Autobahn WebSocket testsuite](https://github.com/crossbario/autobahn-testsuite)
from a GitHub Actions workflow.

[![Lint](https://github.com/farbenbuilds/autobahn-action/actions/workflows/lint.yml/badge.svg)](https://github.com/farbenbuilds/autobahn-action/actions/workflows/lint.yml)

## Status

Setup phase. The repository ships the toolchain, agent system, skill library,
and Nix environment. The action runtime, `action.yml`, tests, bundle, and
Autobahn workflow land in the implementation phase.

The planned consumer experience is one step:

```yaml
name: Autobahn

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  autobahn:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v6
      - run: npm ci
      - run: npm run build

      - uses: farbenbuilds/autobahn-action@v1
        with:
          server-command: node dist/server.js
          url: ws://127.0.0.1:9001

      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: autobahn-report
          path: autobahn-reports
```

The action will start the server, wait for a WebSocket handshake, run the
digest-pinned Autobahn container, parse `servers/index.json`, write JSON and
Markdown summaries, append the report to the job summary, annotate failures,
and fail according to the configured policy.

## Planned Inputs

| Input                      | Default               | Purpose                                 |
| -------------------------- | --------------------- | --------------------------------------- |
| `url`                      | `ws://127.0.0.1:9001` | WebSocket target                        |
| `server-command`           | empty                 | Optional command that starts the server |
| `server-working-directory` | `.`                   | Working directory for the command       |
| `server-ready-timeout`     | `30`                  | Seconds to wait for a handshake         |
| `cases`                    | `*`                   | Comma- or space-separated case patterns |
| `exclude-cases`            | empty                 | Case patterns to skip                   |
| `agent`                    | `autobahn-action`     | Agent key in the report                 |
| `report-dir`               | `autobahn-reports`    | Report, summary, and Markdown output    |
| `docker-image`             | pinned digest         | Autobahn testsuite image                |
| `docker-network`           | `auto`                | `auto`, `host`, or `bridge`             |
| `timeout`                  | `1800`                | Seconds allowed for the container       |
| `fail-on`                  | `failed`              | `failed`, `non-strict`, or `never`      |
| `summary`                  | `true`                | Append the report to the step summary   |
| `annotate`                 | `true`                | Annotate failed cases in the log        |

## Planned Outputs

`ok`, `outcome`, `total`, `passed`, `failed`, `non-strict`, `informational`,
`policy`, `report-dir`, `index-path`, `summary-path`, and `markdown-path`.

## Design Notes

The harness takes its shape from
[fastwebsockets/server-test.js](https://github.com/denoland/fastwebsockets/blob/main/autobahn/server-test.js):
start an echo server, run the fuzzing client with the suite image, read
`reports/servers/index.json`, count outcomes, and exit non-zero when a case
fails. It also follows the hardened harnesses in
[uWebZockets](https://github.com/farbenbuilds/uWebZockets) and
[ventiws](https://github.com/farbenbuilds/ventiws): a digest-pinned image,
explicit case groups, a fresh report directory, caller-owned report files, and
a policy that distinguishes `OK`, `INFORMATIONAL`, and `NON-STRICT` from real
failures.

## Development

Requirements: Node.js 24 or newer, pnpm 12.4.2, and optionally Nix and Docker.

```sh
pnpm install
pnpm check
pnpm hooks:install
nix flake check
```

`.envrc` selects the default glibc shell or the musl shell automatically. Both
shells provide Node, pnpm, TypeScript, lefthook, and the formatters.

| Command                                     | Purpose                                   |
| ------------------------------------------- | ----------------------------------------- |
| `pnpm check`                                | Lint, convention checks, and format check |
| `pnpm lint`                                 | Oxlint plus repository conventions        |
| `pnpm lint:fix`                             | Safe Oxlint fixes                         |
| `pnpm format`                               | Oxfmt write                               |
| `pnpm format:check`                         | Oxfmt check                               |
| `pnpm hooks:run`                            | Lefthook over every file                  |
| `nix flake check`                           | Nix formatting and flake evaluation       |
| `sh scripts/check-graphify-integrations.sh` | Four-client graphify parity               |

## Agent System

The repository is built for four clients only: OpenCode, Google Antigravity,
Claude Code, and Codex. The roster is `architect`, `developer`, `integrator`,
and `reviewer`, with matching definitions under `.opencode/agents/`,
`.agents/agents/`, `.claude/agents/`, and `.codex/agents/`.

Skills are installed under `.agents/skills/` and pinned in
`skills-lock.json`. Graphify is installed for all four clients. See
[AGENTS.md](AGENTS.md), [AGENT_DIRECTORY.md](AGENT_DIRECTORY.md), and
[SKILL.md](SKILL.md).

## Contributing

Read [CONTRIBUTE.md](CONTRIBUTE.md), [CODING_CONVENTION.md](CODING_CONVENTION.md),
and [.github/COMMIT_CONVENTION.md](.github/COMMIT_CONVENTION.md). Security
reports follow [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE). The project is funded through
[GitHub Sponsors](https://github.com/sponsors/farbenbuilds).
