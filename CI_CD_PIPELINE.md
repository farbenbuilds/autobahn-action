# CI and Delivery Pipeline

## Current Setup Phase

The repository has no action runtime yet. The only workflow is `lint.yml`,
which proves the repository system:

- install dependencies with a frozen lockfile
- run Oxlint, convention checks, and Oxfmt
- verify the four agent definitions, the four graphify integrations, and their
  version parity

The workflow does not build, test, publish, or run an action that does not
exist. Nix checking is local until an environment workflow is added.

## Workflows

| Workflow         | Trigger                              | Purpose                             |
| ---------------- | ------------------------------------ | ----------------------------------- |
| `lint.yml`       | push to `main`, pull request, manual | Lint, conventions, format, graphify |
| `dependabot.yml` | weekly schedule, Dependabot          | npm and GitHub Actions updates      |

Planned for the implementation phase:

| Workflow              | Trigger                    | Purpose                                    |
| --------------------- | -------------------------- | ------------------------------------------ |
| `autobahn-action.yml` | push, pull request, manual | Run this action against a Node echo server |
| `release.yml`         | tag `v*`                   | Build, verify, and publish the action tag  |

## Checks

Setup-phase checks:

```sh
pnpm install --frozen-lockfile
pnpm check
sh scripts/check-agent-parity.sh
sh scripts/check-graphify-integrations.sh
```

Developer-machine checks also include:

```sh
nix flake check
pnpm hooks:run
```

Implementation checks will add:

```sh
pnpm build
pnpm typecheck
pnpm test
```

The action self-test will use a local WebSocket echo server, a small case
selection for pull requests, and the full suite on `main` or a manual run.

## Caching

- pnpm cache is keyed by `pnpm-lock.yaml` through `pnpm/setup`.
- The Autobahn Docker image is pulled by digest in the implementation phase; no
  workflow cache is needed.

## Permissions and Secrets

Every workflow uses `contents: read` unless it publishes. The action needs no
repository secret. Release workflows will use OIDC or `GITHUB_TOKEN` scoped to
the job that writes a release, never a token available to the test job.

## Release Shape

A release tag points at a commit that already contains the bundled
`dist/index.cjs`. Consumers reference a major tag such as `@v1`; that tag moves
only to a passing release commit. Publishing does not build on the consumer's
runner.

## Failure Policy

- A failing lint, convention, format, or graphify check blocks the pull
  request.
- A missing graphify integration file blocks the pull request.
- A stale or malformed report never produces a passing action summary.
- A Docker or readiness failure fails the action before any report gate.
- Do not add `continue-on-error` to a required check.
