# ADR 0001: Four Agent Clients

## Status

Accepted on 2026-11-28.

## Context

The repository needs one coherent agent system without maintaining a directory
for every coding client. The maintainer uses OpenCode, Google Antigravity,
Claude Code, and Codex. Previous Farben repositories accumulated Cursor,
Windsurf, Continue, and Gemini CLI copies, which drift from the canonical
instructions and multiply review work.

The system also needs one skill library and one knowledge graph integration
without five copies of every skill.

## Decision

Support exactly four clients:

- OpenCode: `.opencode/agents/`, `.opencode/skills/graphify/`,
  `.opencode/plugins/graphify.js`
- Google Antigravity: `.agents/agents/`, `.agents/rules/graphify.md`,
  `.agents/workflows/graphify.md`, `.agents/skills/graphify/`
- Claude Code: `.claude/agents/`, `.claude/skills/graphify/`,
  `.claude/settings.json`
- Codex: `.codex/agents/`, `.codex/skills/graphify/`, `.codex/hooks.json`

Shared skills live once under `.agents/skills/<name>/SKILL.md` and are pinned
by `skills-lock.json`. Only graphify is copied into a client-specific skill
directory because its installer writes client-specific hooks and rules.

The roster is fixed at four roles: `architect`, `developer`, `integrator`, and
`reviewer`. Definitions use the same names and the same graphify rule in every
client. No project prefix is added.

Graphify is installed for all four clients. `scripts/check-graphify-integrations.sh`
checks the graph integration, and `scripts/check-agent-parity.sh` checks that
every client has the same roster and that every installed skill is documented.

## Consequences

- A client not on the list is not supported and its directory is rejected by
  the graphify parity check.
- Adding a role means adding four definitions, one per client, plus a roster
  entry and skill coverage in `AGENT_DIRECTORY.md`.
- Adding a skill means installing it once under `.agents/skills/`, updating
  `skills-lock.json`, and naming it in the owning role definitions.
- Client-specific behavior belongs in the platform definition, never in the
  shared skill.
- The system has a small, testable surface: four clients, four roles, one
  shared skill tree.
