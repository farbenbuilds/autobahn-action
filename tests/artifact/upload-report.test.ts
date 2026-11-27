import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  buildArtifactUrl,
  getEnvironmentSkipReason,
  listRegularFiles,
  uploadReport,
} from "../../src/artifact/upload-report.ts";

import type { ArtifactContext, ArtifactSettings } from "../../src/artifact/upload-report.ts";

const SETTINGS: ArtifactSettings = {
  enabled: true,
  name: "autobahn-report",
  retentionDays: 30,
  directory: "/tmp/autobahn-reports",
};

const CONTEXT: ArtifactContext = {
  isGitHubActions: true,
  hasRuntimeToken: true,
  hasResultsUrl: true,
  serverUrl: "https://github.com",
  repository: "owner/repository",
  runId: "12345",
};

describe("getEnvironmentSkipReason", () => {
  it("preserves skip priority", () => {
    assert.equal(
      getEnvironmentSkipReason(
        { ...SETTINGS, enabled: false },
        {
          ...CONTEXT,
          isGitHubActions: false,
          hasRuntimeToken: false,
          hasResultsUrl: false,
          serverUrl: "https://ghes.example.com",
        },
      ),
      "disabled",
    );
    assert.equal(
      getEnvironmentSkipReason(SETTINGS, {
        ...CONTEXT,
        isGitHubActions: false,
        hasRuntimeToken: false,
        hasResultsUrl: false,
        serverUrl: "https://ghes.example.com",
      }),
      "not-actions",
    );
    assert.equal(
      getEnvironmentSkipReason(SETTINGS, {
        ...CONTEXT,
        hasRuntimeToken: false,
        hasResultsUrl: false,
        serverUrl: "https://ghes.example.com",
      }),
      "missing-token",
    );
    assert.equal(
      getEnvironmentSkipReason(SETTINGS, {
        ...CONTEXT,
        hasResultsUrl: false,
        serverUrl: "https://ghes.example.com",
      }),
      "missing-results-url",
    );
    assert.equal(
      getEnvironmentSkipReason(SETTINGS, {
        ...CONTEXT,
        serverUrl: "https://ghes.example.com",
      }),
      "unsupported-host",
    );
  });

  it("accepts github.com, ghe.com tenants, and localhost hosts", () => {
    assert.equal(getEnvironmentSkipReason(SETTINGS, CONTEXT), undefined);
    assert.equal(
      getEnvironmentSkipReason(SETTINGS, {
        ...CONTEXT,
        serverUrl: "https://tenant.ghe.com",
      }),
      undefined,
    );
    assert.equal(
      getEnvironmentSkipReason(SETTINGS, {
        ...CONTEXT,
        serverUrl: "http://runner.localhost:8080",
      }),
      undefined,
    );
  });
});

describe("listRegularFiles", () => {
  it("returns sorted nested regular files", async () => {
    const root = await mkdtemp(join(tmpdir(), "autobahn-files-"));

    try {
      await mkdir(join(root, "servers"));
      await writeFile(join(root, "summary.json"), "{}\n");
      await writeFile(join(root, "servers", "index.json"), "{}\n");

      const files = await listRegularFiles(root);

      assert.deepEqual(
        files.map((file) => file.relativePath),
        ["servers/index.json", "summary.json"],
      );
      assert.equal(files[0]?.absolutePath, join(root, "servers", "index.json"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("skips symbolic links to files and does not traverse symbolic directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "autobahn-files-"));

    try {
      await mkdir(join(root, "real"));
      await writeFile(join(root, "real", "inside.txt"), "inside\n");
      await writeFile(join(root, "regular.txt"), "regular\n");
      await symlink(join(root, "regular.txt"), join(root, "file-link"), "file");
      await symlink(join(root, "real"), join(root, "directory-link"), "dir");

      const files = await listRegularFiles(root);
      const relativePaths = files.map((file) => file.relativePath);

      assert.deepEqual(relativePaths, ["real/inside.txt", "regular.txt"]);
      assert.equal(relativePaths.includes("file-link"), false);
      assert.equal(relativePaths.includes("directory-link/inside.txt"), false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("omits fuzzingclient.json from the artifact file list", async () => {
    const root = await mkdtemp(join(tmpdir(), "autobahn-files-"));

    try {
      await writeFile(join(root, "fuzzingclient.json"), '{"servers":[]}\n');
      await writeFile(join(root, "summary.json"), "{}\n");
      await writeFile(join(root, "summary.md"), "# report\n");

      const files = await listRegularFiles(root);
      const relativePaths = files.map((file) => file.relativePath);

      assert.deepEqual(relativePaths, ["summary.json", "summary.md"]);
      assert.equal(relativePaths.includes("fuzzingclient.json"), false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("returns an empty list for an empty root", async () => {
    const root = await mkdtemp(join(tmpdir(), "autobahn-files-"));

    try {
      assert.deepEqual(await listRegularFiles(root), []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("buildArtifactUrl", () => {
  it("builds the run artifact URL", () => {
    assert.equal(
      buildArtifactUrl(CONTEXT, 99),
      "https://github.com/owner/repository/actions/runs/12345/artifacts/99",
    );
  });

  it("trims a trailing slash from the server URL", () => {
    assert.equal(
      buildArtifactUrl({ ...CONTEXT, serverUrl: "https://github.com/" }, 1),
      "https://github.com/owner/repository/actions/runs/12345/artifacts/1",
    );
  });

  it("requires a repository and run id", () => {
    assert.equal(buildArtifactUrl({ ...CONTEXT, repository: undefined }, 1), undefined);
    assert.equal(buildArtifactUrl({ ...CONTEXT, runId: undefined }, 1), undefined);
  });
});

describe("uploadReport", () => {
  it("skips before touching the filesystem when disabled", async () => {
    const result = await uploadReport({ ...SETTINGS, enabled: false }, CONTEXT);

    assert.deepEqual(result, { kind: "skipped", reason: "disabled" });
  });

  it("skips an empty report directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "autobahn-upload-"));

    try {
      const result = await uploadReport({ ...SETTINGS, directory: root }, CONTEXT);

      assert.deepEqual(result, { kind: "skipped", reason: "no-files" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
