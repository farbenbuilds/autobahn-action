import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_CASES,
  DEFAULT_EXCLUDE_CASES,
  parseActionInputs,
} from "../../src/action/inputs.ts";
import { buildSuiteConfig, serializeSuiteConfig } from "../../src/suite/config.ts";

describe("buildSuiteConfig", () => {
  it("builds the documented fuzzingclient configuration", () => {
    assert.deepEqual(
      buildSuiteConfig({
        url: "ws://127.0.0.1:9001",
        agent: "autobahn-action",
        cases: ["*"],
        excludeCases: [],
      }),
      {
        outdir: "/reports/servers",
        servers: [{ agent: "autobahn-action", url: "ws://127.0.0.1:9001" }],
        cases: ["*"],
        "exclude-cases": [],
        "exclude-agent-cases": {},
      },
    );
  });

  it("builds the default config from the default inputs", () => {
    const inputs = parseActionInputs(() => "");

    const config = buildSuiteConfig({
      url: inputs.url,
      agent: inputs.agent,
      cases: inputs.cases,
      excludeCases: inputs.excludeCases,
    });

    assert.deepEqual(config.cases, DEFAULT_CASES);
    assert.deepEqual(config["exclude-cases"], DEFAULT_EXCLUDE_CASES);
  });

  it("carries custom cases and exclusions", () => {
    const config = buildSuiteConfig({
      url: "wss://example.com:9443/socket",
      agent: "custom-agent",
      cases: ["1.*", "2.1.1"],
      excludeCases: ["9.*"],
    });

    assert.deepEqual(config.servers, [
      { agent: "custom-agent", url: "wss://example.com:9443/socket" },
    ]);
    assert.deepEqual(config.cases, ["1.*", "2.1.1"]);
    assert.deepEqual(config["exclude-cases"], ["9.*"]);
  });
});

describe("serializeSuiteConfig", () => {
  it("writes pretty JSON with a trailing newline", () => {
    const config = buildSuiteConfig({
      url: "ws://127.0.0.1:9001",
      agent: "autobahn-action",
      cases: ["*"],
      excludeCases: [],
    });

    assert.equal(
      serializeSuiteConfig(config),
      `{
  "outdir": "/reports/servers",
  "servers": [
    {
      "agent": "autobahn-action",
      "url": "ws://127.0.0.1:9001"
    }
  ],
  "cases": [
    "*"
  ],
  "exclude-cases": [],
  "exclude-agent-cases": {}
}
`,
    );
  });
});
