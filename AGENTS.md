# autobahn-action Agent Guide

## Project

`autobahn-action` packages the Autobahn WebSocket testsuite as a GitHub
Action. A consumer writes one step:

```yaml
- uses: farbenbuilds/autobahn-action@v1
  with:
    server-command: node dist/server.js
```

The action starts the server under test, runs the digest-pinned
`crossbario/autobahn-testsuite` image, reads the report, writes a JSON and
Markdown summary, annotates failures, and exits with the configured policy.

The project is implemented. `action.yml`, the runtime, the unit tests, the
committed `dist/index.cjs` bundle, and `test.yml` are current. A release tag is
immutable; the moving major alias is what consumers reference.

## Documentation Map

| Document                                                     | Read it for                                  |
| ------------------------------------------------------------ | -------------------------------------------- |
| [AGENTS.md](AGENTS.md)                                       | Canonical rules for every coding agent       |
| [AGENT_DIRECTORY.md](AGENT_DIRECTORY.md)                     | Roster, ownership, handoffs, skill coverage  |
| [CODING_CONVENTION.md](CODING_CONVENTION.md)                 | Non-negotiable coding rules                  |
| [CODEBASE.md](CODEBASE.md)                                   | Architecture, module boundaries, data flow   |
| [CLAUDE.md](CLAUDE.md)                                       | Claude Code entry point                      |
| [SKILL.md](SKILL.md)                                         | Human-readable skill routing                 |
| [CONTRIBUTE.md](CONTRIBUTE.md)                               | Environment, commands, branch and PR process |
| [SECURITY.md](SECURITY.md)                                   | Trust boundaries and vulnerability reporting |
| [.github/COMMIT_CONVENTION.md](.github/COMMIT_CONVENTION.md) | Commit message format                        |
| [.github/dependabot.yml](.github/dependabot.yml)             | Dependency update policy                     |

## Non-Negotiable Rules

- No emoji characters in repository-authored files. Vendored skills under
  `.agents/skills/` are upstream content and are exempt.
- Minimal comments. A comment says why in one or two sentences. Never restate
  code, narrate a diff, or leave commented-out code. Never add `TODO`,
  `FIXME`, `XXX`, or `HACK`.
- A source file must not exceed 500 lines. Target 150 to 300 lines and split by
  responsibility before the limit. Never create a `part-2` file.
- Separation of concerns is mandatory. Inputs, orchestration, Docker, report
  parsing, summary rendering, and server lifecycle are separate modules.
- Functional programming over object-oriented programming. No classes,
  prototypes, `this`, inheritance, or behavior bound to hidden state.
- Pure functions at the core; effects at the edges. Parsing and formatting do
  not read the clock, environment, filesystem, or network.
- Named, explicit, flat types. No `any`, no `unknown` parameters or returns,
  no unchecked casts, no non-null assertions, no enums, no `typeof` narrowing
  outside a boundary decoder.
- Domain data is plain records and arrays. Do not add `readonly` modifiers.
- External data is decoded at the boundary before it enters the domain. Use the
  repository schema library and infer the type from the schema.
- TypeScript strict mode, semicolons, double quotes, and trailing commas.
  Oxfmt owns formatting; do not hand-format around it.
- Files are kebab-case. Types are `PascalCase`; functions and variables are
  `camelCase`; module constants are `SCREAMING_SNAKE_CASE`.
- No `console` in shipped source. Use `@actions/core` logging.
- Do not weaken a lint rule, threshold, test, assertion, or workflow to make a
  change pass.
- Do not commit, push, tag, or open a pull request unless the user explicitly
  asks.

The full contract is [CODING_CONVENTION.md](CODING_CONVENTION.md).

## Toolchain

- Node.js 24 or newer and pnpm 12.4.2.
- Oxlint with the vendored anti-slop plugin and local project rules.
- Oxfmt with the repository configuration.
- Nix flake with default glibc and musl dev shells. `.envrc` selects the host
  libc automatically. The musl shell keeps only the cached Node and pnpm
  closure so a musl host does not rebuild the toolchain.
- Lefthook for commit-message and pre-commit checks.
- `graphify` for codebase queries and the project knowledge graph.

```sh
pnpm install
pnpm check                 # lint, convention checks, format check
pnpm lint                  # Oxlint plus scripts/check-conventions.mjs
pnpm lint:fix              # safe Oxlint fixes
pnpm format                # Oxfmt write
pnpm format:check          # Oxfmt check
pnpm hooks:install         # install Lefthook hooks
pnpm hooks:run             # Lefthook over every file
nix flake check            # flake formatting, package, and version checks
sh scripts/check-agent-parity.sh
sh scripts/check-graphify-integrations.sh
```

Action changes also run `pnpm build`, plus `pnpm typecheck` and `pnpm test`, or
`pnpm verify` for the check, typecheck, and test passes. `.github/workflows/test.yml`
runs `pnpm verify`, rebuilds the bundle, and runs the Autobahn self-test. The
lint job runs in the `Linting` environment; every `test.yml` job runs in the
`Testing` environment.

## Agent Team

Use the roster in [AGENT_DIRECTORY.md](AGENT_DIRECTORY.md):

1. `architect` reads the request and project context, states assumptions,
   identifies ownership boundaries, and returns a scoped plan with acceptance
   criteria. It is read-only.
2. `developer` implements the assigned slice, reports changed files and
   commands actually run, and never claims an unrun check passed.
3. `reviewer` independently reviews the diff for correctness, security,
   compatibility, tests, conventions, and scope. It is read-only and reports
   severity-ranked findings with `file:line` references.
4. `integrator` resolves findings through the owner, checks the combined diff,
   runs the final gates, and prepares the delivery summary.

Do not advance a phase while its required output is missing. Keep one writer
per file. Parallelize only independent slices. The root agent owns scope,
decisions, and the final report.

Agent definitions exist for exactly four clients: OpenCode, Google
Antigravity, Claude Code, and Codex. Do not add Cursor, Windsurf, Gemini CLI,
or other platform directories.

## Skills

All project skills live in `.agents/skills/<name>/SKILL.md` and are pinned in
`skills-lock.json`. Load only the skills that match the current phase. If a
skill is missing, stop and report drift instead of guessing.

The installed library covers:

- discovery: `find-skills`, `using-agent-skills`
- architecture: `improve-codebase-architecture`, `untangle-codebase`,
  `codebase-design`
- design stress tests: `grill-me`, `grilling`
- engineering discipline: `ponytail`, `caveman`, `context7`
- TypeScript: `typescript-best-practices`, `functional-programming-fundamentals`,
  `pragmatic-functional-programming`
- linting: `install-anti-slop`
- review: `thermo-nuclear-code-quality-review`
- delivery: `github-actions`
- environment: `nix-best-practices`
- graph: `graphify`

Manual-only skills are `improve-codebase-architecture`, `grill-me`,
`thermo-nuclear-code-quality-review`, `typescript-best-practices`, and
`untangle-codebase`. Run them only when the user or root agent requests the
pass. `grill-me` routes to `grilling`.

## graphify

This project has a knowledge graph at `graphify-out/` with god nodes,
community structure, and cross-file relationships. `graphify-out/` is
generated and git-ignored.

When `graphify-out/graph.json` exists, run `graphify query "<question>"` before
the first grep, search, or source read for a codebase question. Use
`graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"`
for focused concepts. These return a scoped subgraph, usually much smaller than
`GRAPH_REPORT.md` or raw grep output. Read `GRAPH_REPORT.md` only for broad
architecture review. After modifying code, run `graphify update .`.

Every subagent prompt that explores code carries this rule. Graphify is
installed for the four supported clients only:

- OpenCode: `.opencode/skills/graphify/` and `.opencode/plugins/graphify.js`
- Codex: `.codex/skills/graphify/` and `.codex/hooks.json`
- Claude Code: `.claude/skills/graphify/` and `.claude/settings.json`
- Google Antigravity: `.agents/skills/graphify/`, `.agents/rules/graphify.md`,
  and `.agents/workflows/graphify.md`

Refresh with `sh scripts/install-graphify-integrations.sh` and verify with
`sh scripts/check-agent-parity.sh` and
`sh scripts/check-graphify-integrations.sh`.

## Security Boundaries

- Treat `action.yml` inputs, the server command, the Docker image reference,
  the report JSON, and the environment as untrusted.
- Build subprocess argument arrays explicitly. Never interpolate an input into
  a shell command except the `server-command` that the consumer deliberately
  supplied.
- Pin the Autobahn image by digest. A tag would let a rebuilt image change the
  case set under the gate.
- The action needs `contents: read` only. It never publishes, tags, or writes
  to the repository.
- Artifact upload uses the runner-provided runtime token. Never log that token,
  and never follow a symlink while collecting report files.
- Never print secrets. Redact tokens and authorization headers.
