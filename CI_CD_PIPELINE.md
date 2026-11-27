# CI and Delivery Pipeline

## Workflows

| Workflow         | Trigger                              | Purpose                                    |
| ---------------- | ------------------------------------ | ------------------------------------------ |
| `lint.yml`       | push to `main`, pull request, manual | Lint, conventions, format, agent, graphify |
| `test.yml`       | push to `main`, pull request, manual | Unit tests, bundle, Autobahn self-test     |
| `dependabot.yml` | weekly schedule, Dependabot          | npm and GitHub Actions updates             |

The `lint` and `test` workflows use `contents: read`, `actions/checkout@v7`,
and `pnpm/setup@v3` with pnpm 12.4.2 and Node 24.22.1.

`.github/workflows/lint.yml` runs in the `Linting` environment and proves the
repository system: Oxlint, convention checks, Oxfmt, the skills lock, the
four-client agent parity, and the graphify integrations. It does not build or
run the action.

`.github/workflows/test.yml` runs in the `Testing` environment:

- `unit` runs `pnpm verify`, rebuilds `dist/index.cjs`, checks that the
  committed bundle is unchanged with `git diff --exit-code -- dist/index.cjs`,
  and verifies the graphify integrations.
- `autobahn` needs `unit`, runs the local action against
  `tests/fixtures/echo-server.mjs`, uses `1.1.1 2.1 2.2` on pull requests and
  the canonical `1.* 2.* 3.* 4.* 5.* 6.* 7.* 9.* 10.*` set on `main` or a
  manual run, and asserts that the report index, JSON summary, and Markdown
  summary are non-empty.
- `checks` needs both jobs, runs with `if: always()`, and fails when a needed
  job result is `failure` or `cancelled`.

The `Test` workflow uses the concurrency group
`test-${{ github.workflow }}-${{ github.ref }}` and cancels superseded pull
request runs. No job uses `continue-on-error`.

There is no release workflow yet. The repository owner creates the release tag
and GitHub release manually.

## Checks

Required before review:

```sh
pnpm install --frozen-lockfile
pnpm verify
pnpm build
git diff --exit-code -- dist/index.cjs
pnpm check
sh scripts/check-agent-parity.sh
sh scripts/check-graphify-integrations.sh
```

Developer-machine checks also include:

```sh
nix flake check
pnpm hooks:run
```

`test.yml` is the authoritative automation for the build, typecheck, test, and
Docker self-test gates. The action self-test uses a local WebSocket echo server,
a small case selection for pull requests, and the full default suite on `main`
or a manual run.

## Caching

- pnpm cache is keyed by `pnpm-lock.yaml` through `pnpm/setup`.
- The Autobahn Docker image is pulled by digest; no workflow cache is needed.
- The committed `dist/index.cjs` is rebuilt in CI rather than cached.

## Permissions and Secrets

Every workflow uses `contents: read`. The action needs no repository secret.
Artifact upload uses the runner-provided `ACTIONS_RUNTIME_TOKEN`; the token is
never logged. No workflow publishes, tags, or writes to the repository.

## Release Shape

`v1.0.0` is the immutable release tag. It points at a commit that contains
`dist/index.cjs` and whose `test.yml` run on `main` passed. `v1` is the moving
major alias tag used by consumers through
`uses: farbenbuilds/autobahn-action@v1`; it moves only to a passing release
commit. The release notes come from the `1.0.0` entry in `CHANGELOG.md`.

The release is created only after `test.yml` passes on `main`. Publishing does
not build on the consumer's runner: the tag already contains the bundle.

## Failure Policy

- A failing lint, convention, format, agent, or graphify check blocks the pull
  request.
- A failing unit test, stale committed bundle, or failing self-test blocks the
  pull request.
- A missing graphify integration file blocks the pull request.
- A stale or malformed report never produces a passing action summary.
- A Docker or readiness failure fails the action before any report gate.
- Do not add `continue-on-error` to a required check.
