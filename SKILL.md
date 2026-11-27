# autobahn-action Skill Library

The project installs a curated skill library under `.agents/skills/` and pins
every skill in `skills-lock.json`. Skills are loaded on demand; do not load the
whole library for a small task. The action runtime is implemented at 1.0.0, so
the routing below covers implementation, CI, release, and documentation work.

## Routing

| Phase                 | Skills                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| Discover the request  | `using-agent-skills`, `find-skills`, `grill-me` -> `grilling`                                          |
| Design a module       | `codebase-design`, `improve-codebase-architecture`                                                     |
| Stress-test a plan    | `grilling`, `grill-me`                                                                                 |
| Implement             | `typescript-best-practices`, `functional-programming-fundamentals`, `pragmatic-functional-programming` |
| Lint and conventions  | `install-anti-slop`, `ponytail`                                                                        |
| CI and delivery       | `github-actions`, `nix-best-practices`                                                                 |
| Review                | `thermo-nuclear-code-quality-review`, `codebase-design`, `untangle-codebase`                           |
| Any codebase question | `graphify`                                                                                             |
| Reduce output         | `caveman` only when explicitly requested                                                               |

## Installations

| Skill                                 | Source                          |
| ------------------------------------- | ------------------------------- |
| `find-skills`                         | vercel-labs/skills              |
| `github-actions`                      | callstackincubator/agent-skills |
| `improve-codebase-architecture`       | mattpocock/skills               |
| `pragmatic-functional-programming`    | whatiskadudoing/fp-ts-skills    |
| `functional-programming-fundamentals` | whatiskadudoing/fp-ts-skills    |
| `ponytail`                            | dietrichgebert/ponytail         |
| `caveman`                             | juliusbrussee/caveman           |
| `context7`                            | intellectronica/agent-skills    |
| `typescript-best-practices`           | backnotprop/pstack              |
| `install-anti-slop`                   | dmmulroy/anti-slop              |
| `untangle-codebase`                   | caldoai/skills                  |
| `grill-me`                            | mattpocock/skills               |
| `thermo-nuclear-code-quality-review`  | cursor/plugins                  |
| `nix-best-practices`                  | alleneubank/claude-code         |
| `codebase-design`                     | mattpocock/skills               |
| `grilling`                            | mattpocock/skills               |
| `using-agent-skills`                  | addyosmani/agent-skills         |

## Rules

- Project rules in `AGENTS.md` and `CODING_CONVENTION.md` outrank every skill.
- Manual-only skills: `improve-codebase-architecture`, `grill-me`,
  `thermo-nuclear-code-quality-review`, `typescript-best-practices`, and
  `untangle-codebase`. Run them only when the user or root agent requests the
  pass.
- `grill-me` routes to `grilling`.
- `install-anti-slop` owns the vendored plugin. Update through the skill, then
  run `pnpm lint` and record provenance in
  `tools/oxlint/anti-slop/UPSTREAM.md`.
- `typescript-best-practices` has `disable-model-invocation: true`; load it
  explicitly when editing TypeScript.
- `caveman` is a communication mode, not a default. Use it only on request.
- `nix-best-practices` applies to `flake.nix`, `.envrc`, and `nix/**`.
- `github-actions` applies to `.github/workflows/**` and action metadata.

## Skill Updates

1. Read the skill's `SKILL.md` and any references it links.
2. Replace the whole skill directory from the pinned source.
3. Update `skills-lock.json` with the source, path, and new hash.
4. Run `pnpm check` and `scripts/check-graphify-integrations.sh`.
5. Report the old and new behavior in the pull request.

Do not hand-edit vendored skill content to make a project rule pass. Project
overrides belong in `AGENTS.md`, `CODING_CONVENTION.md`, or the agent
definitions.

## graphify

The graph skill is installed for the four supported clients:

- OpenCode: `.opencode/skills/graphify/`, `.opencode/plugins/graphify.js`
- Codex: `.codex/skills/graphify/`, `.codex/hooks.json`
- Claude Code: `.claude/skills/graphify/`, `.claude/settings.json`
- Google Antigravity: `.agents/skills/graphify/`,
  `.agents/rules/graphify.md`, `.agents/workflows/graphify.md`

Refresh with `sh scripts/install-graphify-integrations.sh`; verify with
`sh scripts/check-graphify-integrations.sh`. When `graphify-out/graph.json`
exists, start codebase questions with `graphify query` before broad source
reads and run `graphify update .` after code changes.
