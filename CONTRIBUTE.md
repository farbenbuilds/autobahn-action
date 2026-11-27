# Contributing to autobahn-action

## Prerequisites

- Node.js 24 or newer
- pnpm 12.4.2
- Docker, for the action integration test once it exists
- Nix, optional but recommended; `nix develop` provides Node, pnpm, and the
  formatters

On Linux, `.envrc` selects the glibc shell on glibc hosts and the musl shell on
musl hosts. With direnv installed, run `direnv allow` once.

## Setup

```sh
pnpm install
pnpm check
```

If the repository is in the setup phase, `pnpm check` runs linting, convention
checks, and formatting only. `pnpm build`, `pnpm typecheck`, `pnpm test`, and
the action self-test arrive with the runtime implementation.

## Commands

```sh
pnpm check                 # lint, conventions, format check
pnpm lint                  # Oxlint plus scripts/check-conventions.mjs
pnpm lint:fix              # safe Oxlint fixes
pnpm format                # Oxfmt write
pnpm format:check          # Oxfmt check
nix flake check            # Nix formatting and evaluation
pnpm hooks:run # staged-file and repository hooks
sh scripts/check-agent-parity.sh
sh scripts/check-graphify-integrations.sh
```

## Branch and Commit Rules

- Branch from `main` and keep one logical change per pull request.
- Use the commit format in [.github/COMMIT_CONVENTION.md](.github/COMMIT_CONVENTION.md).
- Run the checks before pushing. Do not mark a pull request ready while a check
  is failing.
- Assign the pull request to its owner and apply at least one existing label.
- Do not force-push a branch after review has started. Add commits instead.
- Do not commit generated reports, `graphify-out/`, `node_modules/`, secrets,
  or local environment files.

## Code Rules

Read [AGENTS.md](AGENTS.md) and [CODING_CONVENTION.md](CODING_CONVENTION.md).
The short version:

- no emojis
- minimal comments that explain why
- 500-line maximum per source file
- separation of concerns
- functional programming, no classes or `this`
- named types, no `any`, no unchecked casts
- kebab-case filenames
- Oxlint and Oxfmt own lint and formatting

Do not weaken a lint rule, threshold, test, or workflow to make a change pass.

## Agent-Assisted Changes

Multi-part work follows `architect -> developer -> reviewer -> integrator`.
The reviewer is read-only. The integrator runs the final gates. See
[AGENT_DIRECTORY.md](AGENT_DIRECTORY.md).

## Documentation

Update the relevant document in the same pull request:

- `README.md` for consumer-facing behavior and examples
- `CODEBASE.md` for architecture and module boundaries
- `AGENTS.md` for rules that every agent must follow
- `CHANGELOG.md` for user-visible changes
- `SECURITY.md` for trust-boundary changes

## Reporting Problems

- Security issues: follow [SECURITY.md](SECURITY.md), never a public issue.
- Bugs and feature requests: use the issue templates.
- Pull requests: use the pull request template and include the commands you
  actually ran.
