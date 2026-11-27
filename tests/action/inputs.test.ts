import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_CASES,
  DEFAULT_DOCKER_IMAGE,
  DEFAULT_EXCLUDE_CASES,
  loadActionInputs,
  parseActionInputs,
} from "../../src/action/inputs.ts";

import type { ActionInputs, InputReader } from "../../src/action/inputs.ts";

function createReader(values: Record<string, string>): InputReader {
  return (name) => values[name] ?? "";
}

function parse(values: Record<string, string>): ActionInputs {
  return parseActionInputs(createReader(values));
}

describe("parseActionInputs", () => {
  it("returns the documented defaults when every input is empty", () => {
    assert.deepEqual(parse({}), {
      url: "ws://127.0.0.1:9001/",
      serverCommand: undefined,
      serverWorkingDirectory: ".",
      serverReadyTimeoutSeconds: 30,
      cases: [...DEFAULT_CASES],
      excludeCases: [...DEFAULT_EXCLUDE_CASES],
      agent: "autobahn-action",
      reportDir: "autobahn-reports",
      dockerImage: DEFAULT_DOCKER_IMAGE,
      dockerNetwork: "auto",
      timeoutSeconds: 1800,
      failOn: "failed",
      summary: true,
      annotate: true,
      uploadArtifact: true,
      artifactName: "autobahn-report",
      retentionDays: 30,
    });
  });

  it("accepts every declared docker network and failure policy", () => {
    for (const network of ["auto", "host", "bridge"]) {
      assert.equal(parse({ "docker-network": network }).dockerNetwork, network);
    }

    for (const policy of ["failed", "non-strict", "never"]) {
      assert.equal(parse({ "fail-on": policy }).failOn, policy);
    }
  });

  it("rejects an unknown docker network", () => {
    assert.throws(
      () => parse({ "docker-network": "overlay" }),
      /docker-network must be one of auto, host, bridge/u,
    );
  });

  it("rejects an unknown failure policy", () => {
    assert.throws(
      () => parse({ "fail-on": "sometimes" }),
      /fail-on must be one of failed, non-strict, never/u,
    );
  });

  it("rejects a non-WebSocket URL", () => {
    assert.throws(
      () => parse({ url: "http://127.0.0.1:9001" }),
      /url must start with ws:\/\/ or wss:\/\//u,
    );
    assert.throws(
      () => parse({ url: "ftp://127.0.0.1:9001" }),
      /url must start with ws:\/\/ or wss:\/\//u,
    );
  });

  it("rejects a URL without a literal ws:// or wss:// prefix", () => {
    assert.throws(() => parse({ url: "ws:foo" }), /url must start with ws:\/\/ or wss:\/\//u);
    assert.throws(
      () => parse({ url: "WS://127.0.0.1:9001" }),
      /url must start with ws:\/\/ or wss:\/\//u,
    );
  });

  it("rejects a URL without a hostname", () => {
    assert.throws(() => parse({ url: "ws:///path" }), /url must include a hostname/u);
  });

  it("rejects URL credentials", () => {
    assert.throws(
      () => parse({ url: "ws://user:pass@host" }),
      /url must not include a username or password/u,
    );
    assert.throws(
      () => parse({ url: "ws://@host" }),
      /url must not include a username or password/u,
    );
  });

  it("rejects URL fragments", () => {
    assert.throws(
      () => parse({ url: "ws://127.0.0.1:9001/#frag" }),
      /url must not include a fragment/u,
    );
  });

  it("accepts ws and wss URLs and returns the canonical href", () => {
    assert.equal(parse({ url: "ws://127.0.0.1:9001" }).url, "ws://127.0.0.1:9001/");
    assert.equal(parse({ url: "ws://127.0.0.1:9001/ws" }).url, "ws://127.0.0.1:9001/ws");
    assert.equal(parse({ url: "wss://example.com/socket" }).url, "wss://example.com/socket");
  });

  it("rejects a docker image without a digest", () => {
    assert.throws(
      () => parse({ "docker-image": "crossbario/autobahn-testsuite:0.8.2" }),
      /docker-image must be a valid image reference/u,
    );
    assert.throws(
      () => parse({ "docker-image": "crossbario/autobahn-testsuite" }),
      /docker-image must be a valid image reference/u,
    );
  });

  it("rejects a docker image whose digest is not 64 hex characters", () => {
    assert.throws(
      () => parse({ "docker-image": "crossbario/autobahn-testsuite@sha256:abc123" }),
      /docker-image must be a valid image reference/u,
    );
  });

  it("rejects malformed or option-like docker image references", () => {
    const digest = "a".repeat(64);

    const invalidImages = [
      `--mount=type=bind,target=/x@sha256:${digest}`,
      `-crossbario/autobahn-testsuite@sha256:${digest}`,
      `crossbario/autobahn testsuite@sha256:${digest}`,
      `crossbario/autobahn-testsuite@sha256:${digest}@sha256:${digest}`,
      `crossbario/autobahn-testsuite@SHA256:${digest}`,
      `crossbario/autobahn-testsuite@sha256:${"A".repeat(64)}`,
      `crossbario/autobahn-testsuite:@sha256:${digest}`,
      `crossbario/-autobahn-testsuite@sha256:${digest}`,
      `crossbario/_autobahn-testsuite@sha256:${digest}`,
      `autobahn..testsuite@sha256:${digest}`,
      `registry.example.com:abc/team/server@sha256:${digest}`,
      `team/server:tag/extra@sha256:${digest}`,
      `${"a".repeat(256)}@sha256:${digest}`,
    ];

    for (const image of invalidImages) {
      assert.throws(
        () => parse({ "docker-image": image }),
        /docker-image must be a valid image reference/u,
      );
    }
  });

  it("rejects an uppercase remote repository path", () => {
    // The lowercase first component is a remote path, which must stay lowercase.
    assert.throws(
      () =>
        parse({
          "docker-image": `crossbario/Autobahn-testsuite@sha256:${"a".repeat(64)}`,
        }),
      /docker-image must be a valid image reference/u,
    );
  });

  it("accepts an uppercase registry with a lowercase remote path", () => {
    const image = `Crossbario/autobahn-testsuite@sha256:${"a".repeat(64)}`;

    assert.equal(parse({ "docker-image": image }).dockerImage, image);
  });

  it("accepts uppercase registry domains", () => {
    const digest = "a".repeat(64);

    const images = [
      `Registry.Example.com/foo:tag@sha256:${digest}`,
      `REGISTRY.example.com:5000/foo@sha256:${digest}`,
    ];

    for (const image of images) {
      assert.equal(parse({ "docker-image": image }).dockerImage, image);
    }
  });

  it("accepts a tagged docker image with a 64-hex digest", () => {
    const image = `crossbario/autobahn-testsuite:0.8.2@sha256:${"a".repeat(64)}`;

    assert.equal(parse({ "docker-image": image }).dockerImage, image);
  });

  it("accepts a registry-with-port docker image reference", () => {
    const image = `registry.example.com:5000/team/server:1.2@sha256:${"a".repeat(64)}`;

    assert.equal(parse({ "docker-image": image }).dockerImage, image);
  });

  it("accepts an IPv6 registry with a port and tag", () => {
    const image = `[::1]:5000/foo:1.2@sha256:${"a".repeat(64)}`;

    assert.equal(parse({ "docker-image": image }).dockerImage, image);
  });

  it("accepts an uppercase tag", () => {
    const image = `crossbario/autobahn-testsuite:Latest@sha256:${"a".repeat(64)}`;

    assert.equal(parse({ "docker-image": image }).dockerImage, image);
  });

  it("enforces the server readiness timeout bounds", () => {
    assert.equal(parse({ "server-ready-timeout": "1" }).serverReadyTimeoutSeconds, 1);
    assert.equal(parse({ "server-ready-timeout": "3600" }).serverReadyTimeoutSeconds, 3600);
    assert.throws(
      () => parse({ "server-ready-timeout": "0" }),
      /server-ready-timeout must be an integer between 1 and 3600/u,
    );
    assert.throws(
      () => parse({ "server-ready-timeout": "3601" }),
      /server-ready-timeout must be an integer between 1 and 3600/u,
    );
  });

  it("enforces the suite timeout bounds", () => {
    assert.equal(parse({ timeout: "1" }).timeoutSeconds, 1);
    assert.equal(parse({ timeout: "86400" }).timeoutSeconds, 86400);
    assert.throws(() => parse({ timeout: "0" }), /timeout must be an integer between 1 and 86400/u);
    assert.throws(
      () => parse({ timeout: "86401" }),
      /timeout must be an integer between 1 and 86400/u,
    );
  });

  it("enforces the retention bounds and accepts zero", () => {
    assert.equal(parse({ "retention-days": "0" }).retentionDays, 0);
    assert.equal(parse({ "retention-days": "90" }).retentionDays, 90);
    assert.throws(
      () => parse({ "retention-days": "-1" }),
      /retention-days must be an integer between 0 and 90/u,
    );
    assert.throws(
      () => parse({ "retention-days": "91" }),
      /retention-days must be an integer between 0 and 90/u,
    );
  });

  it("rejects non-integer numeric inputs", () => {
    assert.throws(
      () => parse({ "server-ready-timeout": "1.5" }),
      /server-ready-timeout must be an integer/u,
    );
    assert.throws(() => parse({ timeout: "thirty" }), /timeout must be an integer/u);
    assert.throws(() => parse({ "retention-days": "30.5" }), /retention-days must be an integer/u);
  });

  it("parses booleans case-insensitively", () => {
    const parsed = parse({
      summary: "TRUE",
      annotate: "False",
      "upload-artifact": "true",
    });

    assert.equal(parsed.summary, true);
    assert.equal(parsed.annotate, false);
    assert.equal(parsed.uploadArtifact, true);
  });

  it("rejects boolean inputs that are not true or false", () => {
    assert.throws(() => parse({ summary: "yes" }), /summary must be true or false/u);
    assert.throws(() => parse({ annotate: "1" }), /annotate must be true or false/u);
    assert.throws(
      () => parse({ "upload-artifact": "on" }),
      /upload-artifact must be true or false/u,
    );
  });

  it("splits cases on commas and whitespace", () => {
    const parsed = parse({
      cases: "1.1.1, 2.2.2 3.3.3,\n4.4.4",
      "exclude-cases": "9.*,\t10.*",
    });

    assert.deepEqual(parsed.cases, ["1.1.1", "2.2.2", "3.3.3", "4.4.4"]);
    assert.deepEqual(parsed.excludeCases, ["9.*", "10.*"]);
  });

  it("falls back to the canonical case selection when cases are empty", () => {
    assert.deepEqual(parse({ cases: "  ", "exclude-cases": "" }).cases, DEFAULT_CASES);
    assert.deepEqual(
      parse({ cases: "", "exclude-cases": "  " }).excludeCases,
      DEFAULT_EXCLUDE_CASES,
    );
  });

  it("trims string inputs", () => {
    const parsed = parse({
      url: "  ws://127.0.0.1:9002  ",
      "server-command": "  node server.js  ",
      "server-working-directory": "  app  ",
      agent: "  agent-name  ",
      "report-dir": "  reports  ",
      "artifact-name": "  artifact  ",
    });

    assert.equal(parsed.url, "ws://127.0.0.1:9002/");
    assert.equal(parsed.serverCommand, "node server.js");
    assert.equal(parsed.serverWorkingDirectory, "app");
    assert.equal(parsed.agent, "agent-name");
    assert.equal(parsed.reportDir, "reports");
    assert.equal(parsed.artifactName, "artifact");
  });

  it("treats an empty server command as absent", () => {
    assert.equal(parse({ "server-command": "   " }).serverCommand, undefined);
  });

  it("falls back to defaults for empty report dir, agent, and artifact name", () => {
    const parsed = parse({
      "report-dir": "   ",
      agent: "",
      "artifact-name": "  ",
    });

    assert.equal(parsed.reportDir, "autobahn-reports");
    assert.equal(parsed.agent, "autobahn-action");
    assert.equal(parsed.artifactName, "autobahn-report");
  });

  it("rejects artifact names with forbidden characters", () => {
    const forbiddenCharacters = ['"', ":", "<", ">", "|", "*", "?", "\\", "/", "\r", "\n"];

    for (const character of forbiddenCharacters) {
      assert.throws(
        () => parse({ "artifact-name": `report${character}name` }),
        /artifact-name contains a character that is not allowed/u,
      );
    }
  });

  it("accepts an artifact name with an internal space", () => {
    assert.equal(parse({ "artifact-name": "report name" }).artifactName, "report name");
  });

  it("rejects an artifact name longer than 255 characters", () => {
    assert.throws(
      () => parse({ "artifact-name": "a".repeat(256) }),
      /artifact-name must be at most 255 characters/u,
    );
    assert.equal(parse({ "artifact-name": "a".repeat(255) }).artifactName, "a".repeat(255));
  });

  it("loads boolean defaults and values from the environment", () => {
    const keys = ["INPUT_SUMMARY", "INPUT_ANNOTATE", "INPUT_UPLOAD-ARTIFACT"];
    const previousValues = keys.map((key) => process.env[key]);

    try {
      for (const key of keys) {
        delete process.env[key];
      }

      const defaults = loadActionInputs();

      assert.equal(defaults.summary, true);
      assert.equal(defaults.annotate, true);
      assert.equal(defaults.uploadArtifact, true);

      process.env.INPUT_SUMMARY = "false";
      process.env.INPUT_ANNOTATE = "true";
      process.env["INPUT_UPLOAD-ARTIFACT"] = "false";

      const configured = loadActionInputs();

      assert.equal(configured.summary, false);
      assert.equal(configured.annotate, true);
      assert.equal(configured.uploadArtifact, false);
    } finally {
      keys.forEach((key, index) => {
        const value = previousValues[index];

        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      });
    }
  });
});
