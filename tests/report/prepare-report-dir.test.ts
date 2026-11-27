import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";
import { describe, it } from "node:test";

import {
  assertSafeReportDirectory,
  prepareReportDirectory,
} from "../../src/report/prepare-report-dir.ts";

import type { ReportDirectoryContext } from "../../src/report/prepare-report-dir.ts";

async function createBase(): Promise<string> {
  return mkdtemp(join(tmpdir(), "autobahn-prepare-"));
}

function contextFor(base: string): ReportDirectoryContext {
  return {
    cwd: join(base, "project"),
    home: join(base, "home"),
  };
}

describe("assertSafeReportDirectory", () => {
  it("rejects a filesystem root", async () => {
    const base = await createBase();

    try {
      await assert.rejects(
        assertSafeReportDirectory(parse(base).root, contextFor(base)),
        /must not be a filesystem root/u,
      );
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("rejects the working directory", async () => {
    const base = await createBase();

    try {
      await assert.rejects(
        assertSafeReportDirectory(base, { cwd: base, home: join(base, "home") }),
        /must not be the working directory/u,
      );
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("rejects the home directory", async () => {
    const base = await createBase();

    try {
      await assert.rejects(
        assertSafeReportDirectory(base, { cwd: join(base, "project"), home: base }),
        /must not be the home directory/u,
      );
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("rejects an ancestor of the working directory", async () => {
    const base = await createBase();

    try {
      await assert.rejects(
        assertSafeReportDirectory(base, contextFor(base)),
        /must not be an ancestor of the working directory/u,
      );
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("rejects an ancestor of the home directory", async () => {
    const base = await createBase();
    const home = join(base, "home", "nested");

    try {
      await assert.rejects(
        assertSafeReportDirectory(join(base, "home"), {
          cwd: join(base, "project"),
          home,
        }),
        /must not be an ancestor of the home directory/u,
      );
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("resolves a relative report directory against the supplied working directory", async () => {
    const base = await createBase();

    try {
      await assert.rejects(
        assertSafeReportDirectory(".", contextFor(base)),
        /must not be the working directory/u,
      );
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("rejects a report path that matches a symlink-prefixed home", async () => {
    const base = await createBase();
    const real = join(base, "real");
    const linked = join(base, "linked");
    const cwd = join(real, "project");
    const home = join(linked, "home", "user");
    const reportDir = join(real, "home", "user");
    const victim = join(reportDir, "keep.txt");

    try {
      await mkdir(cwd, { recursive: true });
      await mkdir(reportDir, { recursive: true });
      await writeFile(victim, "keep\n");
      await symlink(real, linked, "dir");

      const context = { cwd, home };

      await assert.rejects(
        assertSafeReportDirectory(reportDir, context),
        /must not be the home directory/u,
      );
      await assert.rejects(
        prepareReportDirectory(reportDir, context),
        /must not be the home directory/u,
      );

      assert.equal(await readFile(victim, "utf8"), "keep\n");
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("rejects an existing symbolic link", async () => {
    const base = await createBase();

    try {
      const target = join(base, "target");

      await mkdir(target);
      await symlink(target, join(base, "report-link"), "dir");

      await assert.rejects(
        assertSafeReportDirectory(join(base, "report-link"), contextFor(base)),
        /must not be a symbolic link/u,
      );
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
});

describe("prepareReportDirectory", () => {
  it("removes stale files, creates the report directory, and creates servers", async () => {
    const base = await createBase();
    const reportDir = join(base, "reports");

    try {
      await mkdir(reportDir, { recursive: true });
      await writeFile(join(reportDir, "stale.json"), "{}\n");

      await prepareReportDirectory(reportDir, contextFor(base));

      const reportStats = await stat(reportDir);
      const serversStats = await stat(join(reportDir, "servers"));

      assert.equal(reportStats.isDirectory(), true);
      assert.equal(serversStats.isDirectory(), true);
      await assert.rejects(stat(join(reportDir, "stale.json")));
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("creates a relative report directory under the supplied working directory", async () => {
    const base = await createBase();
    const cwd = join(base, "project");
    const relativeDir = "autobahn-relative-reports-test";
    const processPath = join(process.cwd(), relativeDir);

    try {
      await mkdir(cwd, { recursive: true });

      await prepareReportDirectory(relativeDir, { cwd, home: join(base, "home") });

      const serversStats = await stat(join(cwd, relativeDir, "servers"));

      assert.equal(serversStats.isDirectory(), true);
      await assert.rejects(stat(processPath));
    } finally {
      await rm(base, { recursive: true, force: true });
      await rm(processPath, { recursive: true, force: true });
    }
  });

  it("rejects a parent-directory symbolic link and leaves its target intact", async () => {
    const base = await createBase();
    const cwd = join(base, "project");
    const target = join(base, "outside");
    const victim = join(target, "victim.txt");

    try {
      await mkdir(cwd, { recursive: true });
      await mkdir(target, { recursive: true });
      await writeFile(victim, "keep\n");
      await symlink(target, join(cwd, "linked"), "dir");

      const reportDir = join(cwd, "linked", "reports");
      const context = { cwd, home: join(base, "home") };

      await assert.rejects(
        assertSafeReportDirectory(reportDir, context),
        /must not be a symbolic link/u,
      );
      await assert.rejects(
        prepareReportDirectory(reportDir, context),
        /must not be a symbolic link/u,
      );

      assert.equal(await readFile(victim, "utf8"), "keep\n");
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("rejects an external symlink that canonicalizes into home and leaves the target intact", async () => {
    const base = await createBase();
    const cwd = join(base, "project");
    const home = join(base, "home");
    const userDir = join(home, "user");
    const victim = join(userDir, "keep.txt");
    const link = join(base, "link");

    try {
      await mkdir(cwd, { recursive: true });
      await mkdir(userDir, { recursive: true });
      await writeFile(victim, "keep\n");
      await symlink(home, link, "dir");

      const reportDir = join(link, "user");
      const context = { cwd, home };

      await assert.rejects(
        assertSafeReportDirectory(reportDir, context),
        /must not resolve inside the home directory/u,
      );
      await assert.rejects(
        prepareReportDirectory(reportDir, context),
        /must not resolve inside the home directory/u,
      );

      assert.equal(await readFile(victim, "utf8"), "keep\n");
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("rejects an external symlink to the filesystem root", async () => {
    const base = await createBase();
    const link = join(base, "root-link");

    try {
      await symlink(parse(base).root, link, "dir");

      await assert.rejects(
        assertSafeReportDirectory(link, contextFor(base)),
        /must not be a symbolic link/u,
      );
      await assert.rejects(
        prepareReportDirectory(link, contextFor(base)),
        /must not be a symbolic link/u,
      );
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("accepts an external report directory through a symlinked parent", async () => {
    const base = await createBase();
    const cwd = join(base, "project");
    const realTarget = join(base, "real-target");
    const link = join(base, "external-link");

    try {
      await mkdir(cwd, { recursive: true });
      await mkdir(realTarget, { recursive: true });
      await symlink(realTarget, link, "dir");

      const reportDir = join(link, "reports");
      const context = { cwd, home: join(base, "home") };

      const safePath = await assertSafeReportDirectory(reportDir, context);

      assert.equal(safePath, join(await realpath(realTarget), "reports"));

      await prepareReportDirectory(reportDir, context);

      const serversStats = await stat(join(realTarget, "reports", "servers"));

      assert.equal(serversStats.isDirectory(), true);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("creates a normal nested report directory", async () => {
    const base = await createBase();
    const reportDir = join(base, "nested", "reports");

    try {
      await prepareReportDirectory(reportDir, contextFor(base));

      const serversStats = await stat(join(reportDir, "servers"));

      assert.equal(serversStats.isDirectory(), true);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("refuses to prepare through a symbolic link", async () => {
    const base = await createBase();

    try {
      const target = join(base, "target");

      await mkdir(target);
      await symlink(target, join(base, "report-link"), "dir");

      await assert.rejects(
        prepareReportDirectory(join(base, "report-link"), contextFor(base)),
        /must not be a symbolic link/u,
      );
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
});
