# autobahn-action Agent Directory

Ownership map and review workflow for coding agents. `AGENTS.md` is the
canonical rule set; this document assigns scopes, handoffs, and skill coverage.

## Roster

The roster is exactly four roles: `architect`, `developer`, `integrator`, and
`reviewer`. The names never carry a project prefix.

| Role         | Purpose                                                                     | Can edit |
| ------------ | --------------------------------------------------------------------------- | -------- |
| `architect`  | Scope, risks, ownership, acceptance criteria, verification plan             | No       |
| `developer`  | Action code, tests, build tooling, action metadata, usage docs              | Yes      |
| `integrator` | CI, release, Nix environment, dependencies, agent tooling, platform configs | Yes      |
| `reviewer`   | Independent quality gate over the final diff and evidence                   | No       |

Use `architect -> developer -> reviewer -> integrator` sequentially for
multi-part work. For a single-owner change, the developer may implement directly
and the reviewer still gates the result.

## Definitions

| Client             | Role definitions             | Graph integration                                                                        |
| ------------------ | ---------------------------- | ---------------------------------------------------------------------------------------- |
| OpenCode           | `.opencode/agents/<role>.md` | `.opencode/skills/graphify/`, `.opencode/plugins/graphify.js`                            |
| Google Antigravity | `.agents/agents/<role>.md`   | `.agents/skills/graphify/`, `.agents/rules/graphify.md`, `.agents/workflows/graphify.md` |
| Claude Code        | `.claude/agents/<role>.md`   | `.claude/skills/graphify/`, `.claude/settings.json`                                      |
| Codex              | `.codex/agents/<role>.toml`  | `.codex/skills/graphify/`, `.codex/hooks.json`                                           |

Codex team procedure: `.codex/TEAM_WORKFLOW.md`. Claude entry point:
`CLAUDE.md`. Shared skills: `.agents/skills/<name>/SKILL.md`. The four-client
decision is recorded in
[docs/adr/0001-four-agent-clients.md](docs/adr/0001-four-agent-clients.md).

## Ownership

| Area                                                                                                                 | Owner                                |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `action.yml`, `src/**`, `tests/**`, `scripts/build*`, `dist/**`                                                      | `developer`                          |
| `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `.oxlintrc.json`, `.oxfmtrc.json`, `tools/oxlint/**`              | `developer`                          |
| `README.md`, usage examples, `CHANGELOG.md`                                                                          | `developer`                          |
| `.github/workflows/**`, `.github/dependabot.yml`, `.github/ISSUE_TEMPLATE/**`                                        | `integrator`                         |
| `flake.nix`, `flake.lock`, `.envrc`, `nix/**`                                                                        | `integrator`                         |
| `.agents/**`, `.opencode/**`, `.claude/**`, `.codex/**`, `skills-lock.json`, `scripts/*graphify*`                    | `integrator`                         |
| `AGENTS.md`, `AGENT_DIRECTORY.md`, `CODING_CONVENTION.md`, `CODEBASE.md`, `SKILL.md`, `CONTRIBUTE.md`, `SECURITY.md` | `integrator` with `developer` review |
| Final diff and gates                                                                                                 | `reviewer` and `integrator`          |

Cross-scope changes are handed to the owner instead of edited in the same pass.
Documentation and agent-tooling updates do not require a version bump.

## Delivery Contract

1. The architect returns affected paths, owner per path, risks, dependencies,
   acceptance criteria, and the exact verification commands. It does not edit.
2. The developer makes the smallest complete change, keeps behavior covered,
   and reports changed files and commands actually run.
3. The reviewer reports severity-ranked findings with `file:line` references.
   A clean review says the diff is ready for integration.
4. The integrator routes findings back to the owner, re-reviews changed work,
   runs the final combined checks, and reports blockers plus the delivery
   summary.
5. Every opened or updated pull request is assigned to its owner and carries at
   least one existing repository label. An unassigned or unlabeled pull request
   is not ready for review.

No agent commits, pushes, tags, or opens a pull request unless the user
explicitly asks.

## Required Checks

Every change:

```sh
pnpm check
pnpm build
pnpm typecheck
pnpm test
sh scripts/check-agent-parity.sh
sh scripts/check-graphify-integrations.sh
nix flake check
pnpm hooks:run
```

`pnpm verify` runs `pnpm check`, `pnpm typecheck`, and `pnpm test` in one
command. The action self-test in `.github/workflows/test.yml` runs the full
unit, bundle, and Autobahn self-test path with Docker. The reviewer confirms the
commands were actually run. A claim without output is not evidence.

## Skill Coverage

| Skill                                 | Loaded by                                  |
| ------------------------------------- | ------------------------------------------ |
| `find-skills`                         | architect, developer, integrator, reviewer |
| `using-agent-skills`                  | architect, developer, integrator, reviewer |
| `improve-codebase-architecture`       | architect, reviewer (manual)               |
| `untangle-codebase`                   | architect, developer, reviewer (manual)    |
| `codebase-design`                     | architect, developer, reviewer             |
| `grill-me`, `grilling`                | architect (manual), reviewer (manual)      |
| `ponytail`                            | architect, developer, integrator, reviewer |
| `caveman`                             | developer, reviewer (on request)           |
| `context7`                            | developer, integrator                      |
| `typescript-best-practices`           | developer, reviewer (manual)               |
| `functional-programming-fundamentals` | developer                                  |
| `pragmatic-functional-programming`    | developer, reviewer                        |
| `install-anti-slop`                   | developer, integrator                      |
| `thermo-nuclear-code-quality-review`  | reviewer (manual)                          |
| `github-actions`                      | integrator, developer                      |
| `nix-best-practices`                  | integrator                                 |
| `graphify`                            | every role                                 |

Vendored skills are pinned by `skills-lock.json`. Project rules outrank skill
defaults, including the no-emoji rule, the 500-line budget, and the rule that
architecture reports stay in the OS temp directory.

## graphify

When `graphify-out/graph.json` exists, every role starts codebase questions
with `graphify query "<question>"` before broad grep or source reads. Use
`graphify path` and `graphify explain` for relationships and concepts, and
`graphify affected` and `graphify god-nodes` for impact and hubs. The architect
passes this rule into every worker prompt. The developer runs
`graphify update .` after code changes. The reviewer confirms graph use and
freshness before reporting ready for integration. If the graph is missing or
stale, say so and fall back to source reads.
