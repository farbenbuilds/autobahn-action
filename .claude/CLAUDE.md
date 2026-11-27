# graphify

- `graphify` (`.claude/skills/graphify/SKILL.md`) builds and queries the
  project knowledge graph at `graphify-out/`.

When the user types `/graphify`, use the installed graphify skill before doing
anything else. When `graphify-out/graph.json` exists, start codebase questions
with `graphify query` before broad source reads and run `graphify update .`
after code changes.
