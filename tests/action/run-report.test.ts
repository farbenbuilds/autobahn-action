import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { reportSuiteResult } from "../../src/action/run-report.ts";
import type { ReportRunContext } from "../../src/action/run-report.ts";
import { DEFAULT_DOCKER_IMAGE } from "../../src/action/inputs.ts";
import type { ActionInputs } from "../../src/action/inputs.ts";
import type { FailurePolicy } from "../../src/domain/autobahn.ts";
import { resolveRunPaths } from "../../src/report/paths.ts";

const AGENT = "autobahn-action";

type ContextOptions = {
  failOn: FailurePolicy;
};

let outputDirectory: string;
let outputFile: string;
let previousOutput: string | undefined;
let previousExitCode: number | string | null | undefined;

function createInputs(
  reportDir: string,
  failOn: FailurePolicy,
  overrides: Partial<ActionInputs> = {},
): ActionInputs {
  return {
    url: "ws://127.0.0.1:9001/",
    serverCommand: undefined,
    serverWorkingDirectory: ".",
    serverReadyTimeoutSeconds: 30,
    cases: ["1.*"],
    excludeCases: [],
    agent: AGENT,
    reportDir,
    dockerImage: DEFAULT_DOCKER_IMAGE,
    dockerNetwork: "auto",
    timeoutSeconds: 1800,
    failOn,
    summary: false,
    annotate: false,
    uploadArtifact: false,
    artifactName: "autobahn-report",
    retentionDays: 30,
    ...overrides,
  };
}

function createContext(base: string, options: ContextOptions): ReportRunContext {
  const reportDir = join(base, "reports");
  const paths = resolveRunPaths(base, reportDir);

  return {
    inputs: createInputs(reportDir, options.failOn),
    paths,
    artifactSettings: {
      enabled: false,
      name: "autobahn-report",
      retentionDays: 30,
      directory: paths.reportDir,
    },
    artifactContext: {
      isGitHubActions: false,
      hasRuntimeToken: false,
      hasResultsUrl: false,
      serverUrl: "https://github.com",
      repository: undefined,
      runId: undefined,
    },
  };
}

async function createReportDirectory(context: ReportRunContext): Promise<void> {
  await mkdir(context.paths.reportDir, { recursive: true });
  await mkdir(join(context.paths.reportDir, "servers"), { recursive: true });
}

async function writeIndex(
  context: ReportRunContext,
  cases: Record<string, Record<string, string>>,
): Promise<void> {
  await createReportDirectory(context);
  await writeFile(context.paths.indexFile, JSON.stringify({ [AGENT]: cases }));
}

async function readOutput(name: string): Promise<string | undefined> {
  const content = await readFile(outputFile, "utf8");
  const match = content.match(new RegExp(`^${name}<<[^\\n]*\\n([^\\n]*)\\n`, "mu"));

  return match?.[1];
}

beforeEach(async () => {
  outputDirectory = await mkdtemp(join(tmpdir(), "autobahn-run-report-output-"));
  outputFile = join(outputDirectory, "output");
  previousOutput = process.env.GITHUB_OUTPUT;
  previousExitCode = process.exitCode;

  await writeFile(outputFile, "");
  process.env.GITHUB_OUTPUT = outputFile;
  process.exitCode = undefined;
});

afterEach(async () => {
  if (previousOutput === undefined) {
    delete process.env.GITHUB_OUTPUT;
  } else {
    process.env.GITHUB_OUTPUT = previousOutput;
  }

  process.exitCode = previousExitCode;
  await rm(outputDirectory, { recursive: true, force: true });
});

describe("reportSuiteResult", () => {
  it("fails the configured policy and writes the summary and outputs", async () => {
    const base = await mkdtemp(join(tmpdir(), "autobahn-run-report-"));

    try {
      const context = createContext(base, { failOn: "failed" });

      await writeIndex(context, {
        "1.1.1": { behavior: "FAILED", behaviorClose: "OK" },
      });

      await reportSuiteResult(context, undefined);

      const summary = JSON.parse(await readFile(context.paths.summaryFile, "utf8"));

      assert.equal(process.exitCode, 1);
      assert.equal(summary.outcome, "failed");
      assert.equal(summary.counts.failed, 1);
      assert.equal(await readOutput("ok"), "false");
      assert.equal(await readOutput("outcome"), "failed");
      assert.equal(await readOutput("failed"), "1");
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("preserves a partial report and records the suite error", async () => {
    const base = await mkdtemp(join(tmpdir(), "autobahn-run-report-"));

    try {
      const context = createContext(base, { failOn: "never" });

      await writeIndex(context, {
        "1.1.1": { behavior: "OK", behaviorClose: "OK" },
      });

      await reportSuiteResult(context, new Error("container exited with code 3"));

      const summary = JSON.parse(await readFile(context.paths.summaryFile, "utf8"));

      assert.equal(process.exitCode, 1);
      assert.equal(summary.outcome, "failed");
      assert.equal(summary.error, "container exited with code 3");
      assert.equal(summary.counts.passed, 1);
      assert.equal(await readOutput("ok"), "false");
      assert.equal(await readOutput("outcome"), "failed");
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("writes a failure summary when the index is missing", async () => {
    const base = await mkdtemp(join(tmpdir(), "autobahn-run-report-"));

    try {
      const context = createContext(base, { failOn: "failed" });

      await createReportDirectory(context);
      await reportSuiteResult(context, undefined);

      const summary = JSON.parse(await readFile(context.paths.summaryFile, "utf8"));

      assert.equal(process.exitCode, 1);
      assert.equal(summary.outcome, "failed");
      assert.match(summary.error, /Autobahn report is missing/u);
      assert.equal(summary.counts.total, 0);
      assert.equal(await readOutput("outcome"), "failed");
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("writes a failure summary when the report is malformed", async () => {
    const base = await mkdtemp(join(tmpdir(), "autobahn-run-report-"));

    try {
      const context = createContext(base, { failOn: "failed" });

      await createReportDirectory(context);
      await writeFile(context.paths.indexFile, "{not-json");

      await reportSuiteResult(context, undefined);

      const summary = JSON.parse(await readFile(context.paths.summaryFile, "utf8"));

      assert.equal(process.exitCode, 1);
      assert.equal(summary.outcome, "failed");
      assert.match(summary.error, /report is not valid JSON/u);
      assert.equal(await readOutput("outcome"), "failed");
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("keeps a passing verdict when the artifact upload is skipped", async () => {
    const base = await mkdtemp(join(tmpdir(), "autobahn-run-report-"));

    try {
      const context = createContext(base, { failOn: "failed" });

      await writeIndex(context, {
        "1.1.1": { behavior: "OK", behaviorClose: "OK" },
      });

      await reportSuiteResult(context, undefined);

      const summary = JSON.parse(await readFile(context.paths.summaryFile, "utf8"));

      assert.equal(process.exitCode, undefined);
      assert.equal(summary.outcome, "passed");
      assert.equal(await readOutput("ok"), "true");
      assert.equal(await readOutput("outcome"), "passed");
      assert.equal(await readOutput("artifact-id"), "");
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
});
