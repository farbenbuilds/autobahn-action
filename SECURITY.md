# Security Policy

## Supported Versions

Security fixes target the latest published release and the current `main`
branch. Older releases are supported only when a fix also applies to the latest
release.

## Reporting a Vulnerability

Do not open a public issue for a security defect. Email the maintainers:

- trananhquan1009@gmail.com
- noah1109.tran@gmail.com

Include the affected version or commit, a reproduction, the impact, and any
known mitigation. Expect an acknowledgment within 48 hours and a triage
decision within 7 days. Do not disclose the issue publicly until a fix and an
advisory are ready.

## Trust Boundaries

Treat every one of these as untrusted:

- `action.yml` inputs, especially `server-command` and `docker-image`
- the consumer's server and its WebSocket handshake
- `servers/index.json` and every other report file
- environment variables, including `GITHUB_STEP_SUMMARY`
- the Docker daemon and the testsuite image

The action must:

- build subprocess argument arrays explicitly
- interpolate no input into a shell command except the deliberately supplied
  `server-command`
- pin the testsuite image by digest
- validate the target URL and report JSON before use
- create a fresh report directory for every run
- use least workflow permissions, `contents: read`
- redact tokens and authorization headers from logs and reports
- fail closed when the report is missing, malformed, or names an unknown agent

## Secrets

The action requires no repository secret. It does not publish, tag, or write
to the repository. Never add a token input unless a feature cannot work without
one, and never log it.

## Dependency and Image Updates

Dependabot proposes npm and GitHub Actions updates weekly. The Autobahn image
is updated by changing the digest in the action metadata and the documentation
in the same pull request, after the new image passes the action self-test.

## Scope

In scope: command injection, path traversal in report paths, report spoofing,
permission escalation, secret disclosure, container escape through action
arguments, and supply-chain compromise of the action bundle.

Out of scope: vulnerabilities in the consumer's WebSocket server, the Docker
daemon configuration, and the upstream Autobahn testsuite itself unless the
action's use of them introduces a new exposure.
