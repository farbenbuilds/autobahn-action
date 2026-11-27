import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";

import { info, warning } from "@actions/core";

import type { ArtifactContext, ArtifactSettings } from "../artifact/upload-report.ts";
import { loadActionInputs } from "./inputs.ts";
import type { ActionInputs } from "./inputs.ts";
import { reportFailure, reportSuiteResult } from "./run-report.ts";
import type { RunPaths } from "../report/paths.ts";
import { resolveRunPaths } from "../report/paths.ts";
import { prepareReportDirectory } from "../report/prepare-report-dir.ts";
import { buildSuiteConfig, serializeSuiteConfig } from "../suite/config.ts";
import { buildDockerPlan } from "../suite/docker.ts";
import type { DockerPlatform } from "../suite/docker.ts";
import { runSuite } from "../suite/run-suite.ts";
import { isServerRunning, startServer, stopServer } from "../server/start-server.ts";
import type { ManagedServer } from "../server/start-server.ts";
import { waitForServer } from "../server/wait-for-server.ts";

const SERVER_READY_INTERVAL_MS = 200;
const CONTAINER_NAME_MAX_LENGTH = 63;

type RunContext = {
  inputs: ActionInputs;
  paths: RunPaths;
  artifactSettings: ArtifactSettings;
  artifactContext: ArtifactContext;
  cwd: string;
  home: string;
};

function readEnvironmentValue(name: string): string | undefined {
  const value = process.env[name];

  return value === undefined || value.trim() === "" ? undefined : value.trim();
}

function formatDisplayUrl(value: string): string {
  try {
    const url = new URL(value);

    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";

    return url.href;
  } catch {
    return "(invalid URL)";
  }
}

function sanitizeContainerNamePart(value: string): string {
  const sanitized = value.replace(/[^A-Za-z0-9_.-]+/gu, "-").replace(/^[^A-Za-z0-9]+/u, "");

  return sanitized === "" ? "run" : sanitized;
}

function buildContainerName(): string {
  const runId = sanitizeContainerNamePart(readEnvironmentValue("GITHUB_RUN_ID") ?? "local").slice(
    0,
    24,
  );

  const attempt = sanitizeContainerNamePart(
    readEnvironmentValue("GITHUB_RUN_ATTEMPT") ?? "1",
  ).slice(0, 8);

  const suffix = randomBytes(4).toString("hex");
  const name = `autobahn-${runId}-${attempt}-${suffix}`;

  return name.slice(0, CONTAINER_NAME_MAX_LENGTH);
}

function mapPlatform(platform: NodeJS.Platform): DockerPlatform {
  switch (platform) {
    case "linux":
    case "darwin":
    case "win32":
      return platform;
    default:
      throw new Error(`Autobahn action does not support the ${platform} platform`);
  }
}

function buildArtifactContext(): ArtifactContext {
  return {
    isGitHubActions: process.env.GITHUB_ACTIONS === "true",
    hasRuntimeToken: readEnvironmentValue("ACTIONS_RUNTIME_TOKEN") !== undefined,
    hasResultsUrl: readEnvironmentValue("ACTIONS_RESULTS_URL") !== undefined,
    serverUrl: readEnvironmentValue("GITHUB_SERVER_URL") ?? "https://github.com",
    repository: readEnvironmentValue("GITHUB_REPOSITORY"),
    runId: readEnvironmentValue("GITHUB_RUN_ID"),
  };
}

function createRunContext(inputs: ActionInputs): RunContext {
  const cwd = process.cwd();
  const home = readEnvironmentValue("HOME") ?? homedir();
  const paths = resolveRunPaths(cwd, inputs.reportDir);

  return {
    inputs,
    paths,
    artifactSettings: {
      enabled: inputs.uploadArtifact,
      name: inputs.artifactName,
      retentionDays: inputs.retentionDays,
      directory: paths.reportDir,
    },
    artifactContext: buildArtifactContext(),
    cwd,
    home,
  };
}

function resolveWorkingDirectory(cwd: string, directory: string): string {
  return isAbsolute(directory) ? directory : resolve(cwd, directory);
}

export async function runAction(): Promise<void> {
  const inputs = loadActionInputs();
  const context = createRunContext(inputs);

  const plan = buildDockerPlan({
    url: inputs.url,
    configPath: context.paths.configFile,
    reportDir: context.paths.reportDir,
    containerName: buildContainerName(),
    image: inputs.dockerImage,
    network: inputs.dockerNetwork,
    platform: mapPlatform(process.platform),
    uid: process.getuid?.(),
    gid: process.getgid?.(),
  });

  await prepareReportDirectory(context.paths.reportDir, {
    cwd: context.cwd,
    home: context.home,
  });

  let server: ManagedServer | undefined;
  let failure: Error | undefined;
  let suiteError: Error | undefined;

  try {
    await writeFile(
      context.paths.configFile,
      serializeSuiteConfig(
        buildSuiteConfig({
          url: plan.containerUrl,
          agent: inputs.agent,
          cases: inputs.cases,
          excludeCases: inputs.excludeCases,
        }),
      ),
      "utf8",
    );

    info(`Autobahn target: ${formatDisplayUrl(inputs.url)}`);

    if (inputs.serverCommand !== undefined) {
      server = startServer(
        inputs.serverCommand,
        resolveWorkingDirectory(context.cwd, inputs.serverWorkingDirectory),
      );
    }

    await waitForServer({
      url: inputs.url,
      timeoutMs: inputs.serverReadyTimeoutSeconds * 1000,
      intervalMs: SERVER_READY_INTERVAL_MS,
      isServerRunning: () => server === undefined || isServerRunning(server),
    });

    try {
      const result = await runSuite(plan, inputs.timeoutSeconds * 1000);

      if (result.exitCode !== 0) {
        suiteError = new Error(`Autobahn suite container exited with code ${result.exitCode}`);
      }
    } catch (cause) {
      suiteError = cause instanceof Error ? cause : new Error(String(cause));
    }
  } catch (cause) {
    failure = cause instanceof Error ? cause : new Error(String(cause));
  } finally {
    if (server !== undefined) {
      try {
        await stopServer(server);
      } catch (cause) {
        warning(
          `Failed to stop the server: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      }
    }
  }

  if (failure !== undefined) {
    await reportFailure(context, failure);

    return;
  }

  await reportSuiteResult(context, suiteError);
}
