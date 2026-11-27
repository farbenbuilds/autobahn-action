# Git Commit Message Convention

This convention adapts
[Angular's commit convention](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-angular).

## Format

```text
<type>(<scope>): <subject>

<body>

<footer>
```

The header is mandatory. The scope is optional. Use the imperative present
tense in the subject: "add", not "added" or "adds". Do not capitalize the first
letter and do not end the subject with a period.

## Types

- `feat`: a user-visible feature
- `fix`: a user-visible defect fix
- `perf`: a performance improvement
- `refactor`: a behavior-preserving change
- `docs`: documentation only
- `test`: tests only
- `build`: build, packaging, or dependency tooling
- `ci`: workflows and automation
- `chore`: maintenance that fits no other type
- `revert`: a revert of an earlier commit

`feat`, `fix`, and `perf` appear in the changelog. A breaking change appears
regardless of type.

## Scopes

Use a short area name: `action`, `inputs`, `report`, `suite`, `server`,
`summary`, `docker`, `ci`, `agents`, `skills`, `graphify`, `nix`, `docs`,
`deps`, `release`.

## Body

Explain the motivation and contrast the new behavior with the previous
behavior. Wrap at 72 columns. Do not restate the diff.

## Footer

Reference issues with `Closes #123` or `Refs #123`.

Mark a breaking change with a `BREAKING CHANGE:` footer and describe the
migration.

## Reverts

Begin with `revert: ` followed by the reverted header. In the body write
`This reverts commit <hash>.`

## Examples

```text
feat(report): gate NON-STRICT outcomes behind a policy input
```

```text
ci(agents): verify graphify integration parity in CI
```

```text
refactor(suite): split Docker argument construction from execution

BREAKING CHANGE: the suite runner now accepts a prepared argument array.
```
