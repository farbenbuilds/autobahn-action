# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Oxlint with the vendored anti-slop plugin, local no-emoji, no-enum, and
  no-OOP rules, and a 500-line module budget.
- Oxfmt formatting with semicolons, double quotes, trailing commas, and a
  100-column width.
- Repository convention checks for file size, kebab-case filenames, emoji,
  forbidden markers, and console output in shipped source.
- Curated skill library pinned in `skills-lock.json`, including TypeScript,
  functional programming, architecture, review, GitHub Actions, Nix, and
  anti-slop skills.
- Architect, developer, reviewer, and integrator definitions for OpenCode,
  Google Antigravity, Claude Code, and Codex.
- Graphify integrations for the same four clients, plus refresh and verification
  scripts.
- Nix flake with default glibc and musl development shells and direnv libc
  selection.
- GitHub issue templates, pull request template, code of conduct, commit
  convention, funding metadata, and Dependabot configuration.
- Agent parity checks, CODEOWNERS, and ADR 0001 recording the four-client
  decision.
- ADR 0002 recording the action runtime toolchain: `@actions/core` as the
  runner interface, direct `node:child_process`, `node:test`, esbuild, and no
  `@actions/exec` or `@vercel/ncc`.
- `@actions/core` 3.0.1 and `@actions/artifact` 6.3.1 as runtime dependencies.
- Fast musl direnv startup: the musl shell keeps only the cached Node and
  pnpm closure and aligns its nixpkgs pin with the sibling ventiws flake.
- ADR 0003 defining automatic report upload, artifact naming, retention,
  outputs, GHES fallback, and failure behavior.
- ADR 0004 recording ArkType 2.2.10 as the report boundary decoder and
  superseding ADR 0002's earlier schema-library choice.
- Runtime core: validated action inputs, canonical Autobahn case defaults,
  fuzzingclient configuration builder, Docker network and argument planning,
  and `typecheck`, `test`, and `verify` scripts.
- Report pipeline: ArkType-validated `servers/index.json` decoding, natural
  case ordering, failure classification under all three policies, and
  deterministic summary document and Markdown rendering.
- Action runtime: managed server lifecycle, WebSocket handshake readiness,
  timed suite execution with container cleanup, guarded report directory reset,
  JSON and Markdown persistence, step summary, annotations, and failure
  summaries.
- Automatic report artifact upload with skip handling for non-Actions runners,
  missing runtime configuration, and unsupported GitHub Enterprise Server hosts.
- Action contract in `action.yml` with every input, default, and output, the
  Node 24 entry point, and the committed `dist/index.cjs` esbuild bundle.
- esbuild 0.28.2 and `ws` 8.23.1 as development dependencies, plus a WebSocket
  echo server fixture for the self-test.

### Notes

- The action runtime is implemented. The runtime self-test workflow, release
  metadata, and the final documentation pass remain.

## [0.1.0] - 2026-11-28

### Added

- Initial repository scaffold.
