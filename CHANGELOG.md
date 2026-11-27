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
- Nix flake with default glibc and musl development shells and automatic
  `.envrc` selection.
- GitHub issue templates, pull request template, code of conduct, commit
  convention, funding metadata, and Dependabot configuration.

### Notes

- The action runtime is not implemented yet. `action.yml`, `src/`, `tests/`,
  `dist/`, and the Autobahn self-test workflow land in the implementation
  phase.

## [0.1.0] - 2026-11-28

### Added

- Initial repository scaffold.
