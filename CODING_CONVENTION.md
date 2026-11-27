# autobahn-action Coding Conventions

These conventions adapt the Linux kernel style and the Farben WebSocket
repositories to a Node.js and TypeScript GitHub Action. They are mandatory.
Reviewers reject a change that violates them instead of negotiating them.

## 1. General Rules

- No emoji characters anywhere in repository-authored source, documentation,
  commit messages, issue text, test names, or logs. Vendored `.agents/skills/`
  content is upstream and exempt.
- Reduce comments to the minimum. A comment explains why a non-obvious
  constraint, workaround, byte value, or safety boundary exists. Never restate
  the code, narrate the diff, or leave commented-out code.
- No `TODO`, `FIXME`, `XXX`, or `HACK` markers. File an issue or land the fix.
- A source file must not exceed 500 lines. Target 150 to 300. Split by
  responsibility into a named sibling module before the limit. Never create a
  `part-2` or `helpers-2` file.
- Delete dead code, unused imports, unused exports, and stale configuration in
  the same change that makes them unused.
- Do not weaken a lint rule, threshold, test, assertion, or workflow to make a
  change pass.

## 2. Control Flow

- Use guard clauses and early returns. Keep the happy path unindented.
- Do not nest control flow more than three levels inside a function. Extract a
  named helper instead.
- Prefer `switch` over a long `if`/`else if` chain. Handle every variant and
  make the default arm exhaustive with a `never` check.
- Declare variables as close to first use as possible and prefer `const`.
- Use strict equality. Never rely on coercion.

## 3. Functional Programming

- No object-oriented programming: no classes, prototypes, `this`,
  inheritance, virtual dispatch, or behavior bound to hidden state.
- Data is plain records. Transformations are free functions that receive every
  input explicitly.
- Pure functions first. Parsing, validation, encoding, and state transitions
  must not perform I/O, logging, clock, random, or environment reads.
- Effects belong at the boundary: the action entry point, subprocess runners,
  filesystem adapters, and the report writer.
- Prefer returning values over mutating shared state. A function may mutate
  caller-owned state only when that mutation is its documented purpose.
- No module-level mutable state. A singleton must be justified by a platform
  constraint and documented.

## 4. Types

- TypeScript strict mode is the floor. `exactOptionalPropertyTypes`,
  `noUncheckedIndexedAccess`, `noImplicitOverride`, and
  `erasableSyntaxOnly` stay enabled.
- No `any`. No `unknown` in a function parameter or return contract. Parse
  external values at the I/O boundary and return a named domain type.
- No type assertions (`as`) without a `SAFETY:` comment stating the invariant
  TypeScript cannot express. Prefer a schema parser, a type guard, or
  `satisfies`.
- No non-null assertions. Model absence with a union and narrow it.
- No enums. Use `as const` unions and derive the union from the object.
- Model variants with discriminated unions. Do not use optional-field bags to
  represent mutually exclusive states.
- Name every value that crosses a function boundary. Do not use broad `object`
  parameters or `Record<string, unknown>` as a domain contract.
- Export explicit return types from module boundaries. Local inference is
  fine.

## 5. Naming

- Files and directories are `kebab-case`.
- Types, schemas, and components are `PascalCase`.
- Functions, variables, and parameters are `camelCase`.
- Module-level constants are `SCREAMING_SNAKE_CASE`.
- Booleans read as predicates: `isReady`, `hasGraph`, `shouldAnnotate`.
- A type guard is named `isX` or `hasX` and must actually verify its claim.

## 6. Async and Errors

- Every promise is awaited, returned, or explicitly detached with `void` at a
  top-level entry point.
- Do not swallow an error. A best-effort cleanup may ignore an error only with
  a comment that states why the failure is safe.
- Preserve the cause. Use `new Error(message, { cause })` when wrapping.
- Never expose a stack trace, token, or authorization header in action output.
- Use timeouts for every subprocess and network wait. A missing timeout is a
  hang that consumes a runner.

## 7. GitHub Action Rules

- `action.yml` is the public contract. Keep input and output descriptions
  accurate and additive. Renaming an input is a breaking change.
- Pin the Autobahn testsuite image by digest.
- Build subprocess argument arrays explicitly. Never interpolate an input into
  a shell command except the `server-command` the consumer deliberately
  supplied.
- Use the least workflow permission. The action itself needs `contents: read`.
- Commit the bundled `dist/` entry point for the release tag. A JavaScript
  action cannot build itself on the consumer's runner.
- Logging uses `@actions/core`. Shipped source does not use `console`.
- Keep the action metadata, source, tests, and dist bundle in the same change.

## 8. Tooling and Anti-Slop

- Oxlint owns linting. The vendored anti-slop plugin enforces:
  - no broad `object` parameters
  - no `unknown` parameters, returns, or aliases
  - no unsafe dictionaries
  - no runtime `typeof` narrowing
  - no module mocking
  - no `reflect.apply` or `reflect.get`
  - no chained or unexplained type assertions
  - no widening then asserting
  - no conditional empty-object spread
  - no accumulating spread or reducers that copy the accumulator
  - no `filter(...).map(...)` chains
  - readable spacing between statement groups
- The local `autobahn` plugin enforces no emoji, no enum, and no OOP.
- Oxfmt owns formatting: semicolons, double quotes, trailing commas, and a
  100-column line width.
- `scripts/check-conventions.mjs` enforces the file budget, kebab-case
  filenames, no emoji, no forbidden markers, and no `console` in `src/`.
- Do not add an ESLint, Prettier, Biome, or second formatter.

## 9. Documentation

- Documentation is part of the change. Update `README.md`, `CODEBASE.md`, and
  `AGENTS.md` when behavior, layout, or commands change.
- Code samples are runnable and use the same input names and versions the
  action publishes.
- No marketing language, no emoji, no unverifiable performance claims.
- Architecture review reports go to the OS temp directory, never the
  repository.

## 10. Verification

Before requesting review:

```sh
pnpm check
sh scripts/check-graphify-integrations.sh
nix flake check
pnpm hooks:run
```

Implementation changes add `pnpm build`, `pnpm typecheck`, `pnpm test`, and the
action self-test workflow. Report commands and their actual outcomes. Never
claim a check that was not run.
