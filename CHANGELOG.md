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
- ADR 0002 recording the action runtime toolchain: `@actions/core` and `zod`
  as dependencies, direct `node:child_process`, `node:test`, esbuild, and no
  `@actions/exec` or `@vercel/ncc`.
- `@actions/core` 3.0.1 and `@actions/artifact` 6.3.1 as runtime dependencies.
- Fast musl direnv startup: the musl shell keeps only the cached Node and
  pnpm closure and aligns its nixpkgs pin with the sibling ventiws flake.
- ADR 0003 defining automatic report upload, artifact naming, retention,
  outputs, GHES fallback, and failure behavior.
- Runtime core: validated action inputs, canonical Autobahn case defaults,
  fuzzingclient configuration builder, Docker network and argument planning,
  and `typecheck`, `test`, and `verify` scripts.

### Notes

- The runtime is under active implementation. `action.yml`, the action entry
  point, `dist/`, the report pipeline, and the Autobahn self-test workflow land
  in the remaining slices.

## [0.1.0] - 2026-11-28

### Added

- Initial repository scaffold.
