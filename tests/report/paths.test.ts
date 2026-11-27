import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAbsolute, join } from "node:path";

import { resolveRunPaths } from "../../src/report/paths.ts";

describe("resolveRunPaths", () => {
  it("resolves a relative report directory against the working directory", () => {
    const paths = resolveRunPaths("/work/project", "autobahn-reports");

    assert.equal(paths.reportDir, "/work/project/autobahn-reports");
    assert.equal(paths.configFile, "/work/project/autobahn-reports/fuzzingclient.json");
    assert.equal(paths.indexFile, "/work/project/autobahn-reports/servers/index.json");
    assert.equal(paths.summaryFile, "/work/project/autobahn-reports/summary.json");
    assert.equal(paths.markdownFile, "/work/project/autobahn-reports/summary.md");
  });

  it("keeps an absolute report directory", () => {
    const paths = resolveRunPaths("/work/project", "/tmp/autobahn-reports");

    assert.equal(paths.reportDir, "/tmp/autobahn-reports");
    assert.equal(paths.indexFile, "/tmp/autobahn-reports/servers/index.json");
  });

  it("produces absolute paths", () => {
    const paths = resolveRunPaths("/work/project", join("nested", "reports"));

    assert.equal(isAbsolute(paths.reportDir), true);
    assert.equal(isAbsolute(paths.configFile), true);
    assert.equal(isAbsolute(paths.indexFile), true);
  });
});
