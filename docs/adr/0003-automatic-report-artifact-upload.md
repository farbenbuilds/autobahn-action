# ADR 0003: Automatic Report Artifact Upload

## Status

Accepted on 2026-11-28. Amends ADR 0002.

## Context

ADR 0002 kept artifact upload out of the action and asked consumers to add
`actions/upload-artifact` after the suite step. The product goal is a
one-step action: a consumer should get a downloadable Autobahn report without
wiring another action, and the report must be available even when the protocol
gate fails.

GitHub exposes `@actions/artifact` as the library behind
`actions/upload-artifact`. It uploads an immutable archive, returns an artifact
ID immediately, and uses the workflow runtime token rather than a repository
secret.

## Decision

Add `@actions/artifact` as a runtime dependency and upload the report from the
action after the summary is written.

### Inputs

| Input             | Default           | Behavior                                            |
| ----------------- | ----------------- | --------------------------------------------------- |
| `upload-artifact` | `true`            | Upload the report directory                         |
| `artifact-name`   | `autobahn-report` | Artifact name; must be unique in the run            |
| `retention-days`  | `30`              | Days before expiry; `0` uses the repository default |

### Outputs

`artifact-id`, `artifact-url`, `artifact-size`, and `artifact-digest` are set
when the upload succeeds.

### Behavior

- Upload runs after the report JSON and Markdown exist, on the success and
  policy-failure paths.
- Upload also runs when the suite container fails after writing a partial
  report, so the partial evidence is available.
- The upload is skipped with a warning outside GitHub Actions, when
  `ACTIONS_RUNTIME_TOKEN` is absent, or when `upload-artifact` is false.
- An upload failure is reported as a warning and recorded in the summary. The
  protocol result remains authoritative; it is not rewritten by an artifact
  service failure.
- The action enumerates regular files under the report directory. It does not
  follow symlinks.
- A default artifact name is not unique across matrix jobs in one workflow
  run. Matrix consumers set `artifact-name` to a job-specific value.

### API

```ts
import { DefaultArtifactClient } from "@actions/artifact";

const client = new DefaultArtifactClient();
const result = await client.uploadArtifact(artifactName, files, reportDir, { retentionDays });
```

`uploadArtifact` requires the file list and a root directory. The returned ID
is used to build the artifact URL.

## Alternatives

### Keep `actions/upload-artifact` as the consumer's step

This is simpler for the action and the most familiar pattern. It fails the
one-step goal and every consumer repeats the same step plus the same failure
handling. It also tends to be skipped on failure unless the consumer remembers
`if: always()`.

### Shell out to `gh` or the REST API

This needs a token with `actions:write`, duplicates the runtime upload logic,
and loses the multipart, digest, and retention behavior. Rejected.

### Use `@actions/artifact` v1

v1 uses the older artifact backend and is out of maintenance. v6 is what
`upload-artifact@v4` uses. Rejected.

## Consequences

- Runtime dependencies become `@actions/core`, `@actions/artifact`, and
  `arktype` 2.2.10.
- The dev tree grows by the artifact client's transitive dependencies. The
  action bundle grows, but esbuild bundles only the reachable code.
- The action works on GitHub-hosted and self-hosted runners with access to the
  Actions artifact endpoints.
- `@actions/artifact` v2+ is not supported on GHES yet. On GHES the action
  skips the upload and keeps the local report.
- Each job can upload at most ten artifacts; this action uses one.
- Artifact names must be unique in a workflow run; matrix consumers override
  the default.
- Artifact upload needs no extra workflow permission for the current run. The
  runtime token is supplied by the runner.
- ADR 0002 remains the record of why direct `@actions/exec` and `@vercel/ncc`
  are not used.
