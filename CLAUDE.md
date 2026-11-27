# Claude Code Guidance

`AGENTS.md` is the canonical repository guide for every coding agent, including
Claude Code. Read it before acting. This file must not restate or shadow those
rules; when the two disagree, `AGENTS.md` wins.

@AGENTS.md

## Claude Code Notes

- Environment checks are `nix flake check` and `pnpm hooks:run`. Repository
  checks are `pnpm check`, `pnpm build`, `pnpm typecheck`, `pnpm test`, and
  `sh scripts/check-graphify-integrations.sh`.
- Use the architect, developer, reviewer, and integrator sequence from
  `AGENT_DIRECTORY.md`. Do not invent specialist agent names.
- Claude Code project subagents live in `.claude/agents/`. The architect and
  reviewer definitions are read-only; every definition inherits the parent
  model and preloads the project `graphify` skill.
- Load shared skills from `.agents/skills/<name>/SKILL.md`. Manual-only skills
  run only when the user requests the pass.
- The action runtime is implemented. `action.yml`, `src/`, `tests/`,
  the committed `dist/index.cjs` bundle, and `.github/workflows/test.yml` are
  current; keep the metadata, source, tests, and bundle in the same change.
- Do not add comments that narrate the diff. Comments explain an invariant, a
  byte value, ownership, or a deliberate divergence.
- Do not commit, push, tag, or open a pull request unless the user explicitly
  asked for it.
- Graphify is wired through `.claude/skills/graphify/` and the PreToolUse hooks
  in `.claude/settings.json`. Refresh with
  `sh scripts/install-graphify-integrations.sh`.

## graphify

When `graphify-out/graph.json` exists, start every codebase question with
`graphify query "<question>"` before broad source reads and run
`graphify update .` after code changes.
