# ADR 0005: Rolldown Release Bundle

## Status

Accepted on 2026-11-28. Amends
[ADR 0002](0002-action-runtime-toolchain.md): the bundler is Rolldown 1.3.4,
not esbuild.

## Context

ADR 0002 chose esbuild to produce the committed `dist/index.cjs` from
`src/main.ts`. The user requested replacing esbuild with Rolldown while keeping
the single CommonJS release bundle, the Node 24 runtime, the
deterministic-output check, and the committed `dist/` workflow.

The entry point is a single TypeScript file with no code splitting. The bundle
must run on the Actions Node 24 runner, and a local rebuild must reproduce the
committed bytes.

## Decision

Bundle with Rolldown 1.3.4 from the root `rolldown.config.ts`:

- `platform: "node"`
- one CommonJS output at `dist/index.cjs`
- no sourcemap

The root config carries the entry point and output options, and `pnpm build`
runs `rolldown -c rolldown.config.ts`. The committed `dist/index.cjs` remains
the release artifact; consumers do not run the repository build.

## Why Rolldown over esbuild

- Rolldown supports the single-entry CommonJS output with a smaller
  configuration.
- It uses the native Oxc transform pipeline already present in the toolchain.
- The resulting bundle is about 3.7 MiB instead of about 4.0 MiB, with the same
  runtime behavior.
- Two consecutive builds produce byte-identical output, and the bundle passes
  `node --check`.
- A smoke run without Docker exits with the expected failure summary instead of
  crashing.

## Consequences

- `esbuild` leaves the development dependency tree; `rolldown` 1.3.4 replaces
  it.
- The build configuration moved from a standalone script to the root
  `rolldown.config.ts` before release; the command is
  `rolldown -c rolldown.config.ts`.
- Rolldown installs native optional binding packages per platform. They are
  transitive development dependencies recorded in `pnpm-lock.yaml`; the
  committed action bundle does not include them.
- `pnpm build` keeps the same output path, so the release shape and the CI
  rebuild-and-diff check do not change.
- ADR 0002's bundler choice is superseded by this decision.
