# Codex Agent Team

Codex custom agents in `.codex/agents/` mirror the four roles in
`.opencode/agents/`, `.claude/agents/`, and `.agents/agents/`. Root project
instructions stay in `AGENTS.md`; ownership stays in `AGENT_DIRECTORY.md`.

## Procedure

1. `architect` reads the request, relevant instructions, and ownership
   boundaries. It returns assumptions, a scoped plan, dependencies, acceptance
   criteria, and verification commands. It does not edit files.
2. `developer` implements the assigned slice. Independent slices may run in
   parallel only when they do not edit the same files.
3. `reviewer` receives the final diff and verification evidence. It is
   read-only and reports actionable findings with `file:line` references.
   Findings return to the developer; changed work gets another review.
4. `integrator` takes the plan, developer report, and reviewer findings;
   checks ownership, scope, required commands, and the final diff; then
   prepares the delivery summary. Integration does not override project gates
   or silently discard findings.

The root agent owns orchestration and the final response. No phase is complete
until its output is returned. Every opened or updated pull request is assigned
to its owner and carries at least one existing repository label.

## Scope

The action runtime is implemented at 1.0.0. `action.yml`, `src/`, `tests/`, the
committed `dist/index.cjs` bundle, and `.github/workflows/test.yml` are current.
Changes keep the action metadata, source, tests, and bundle together. Required
checks are `pnpm verify`, `pnpm build`, `sh scripts/check-agent-parity.sh`,
`sh scripts/check-graphify-integrations.sh`, `nix flake check`, and
`pnpm hooks:run`; the action self-test runs in `test.yml`.

## Skills

Apply skills from `.agents/skills/` and the project rules in `AGENTS.md`,
`AGENT_DIRECTORY.md`, and `CODING_CONVENTION.md`. Report commands and their
actual outcomes; never claim checks that were not run.

## Graphify

When `graphify-out/graph.json` exists, each phase starts codebase questions
with `graphify query "<question>"` before broad grep or source reads. Use
`graphify path` and `graphify explain` for relationships and concepts, and
`graphify affected` and `graphify god-nodes` for impact and hubs. The architect
passes this rule into every worker prompt. The developer runs
`graphify update .` after code changes. The reviewer confirms graph use and
freshness before reporting ready for integration. If the graph is missing or
stale, say so and fall back to source reads.
