import { lstat, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

import { DefaultArtifactClient } from "@actions/artifact";

export const ARTIFACT_SKIP_REASONS = [
  "disabled",
  "not-actions",
  "missing-token",
  "missing-results-url",
  "unsupported-host",
  "no-files",
] as const;

export type ArtifactSkipReason = (typeof ARTIFACT_SKIP_REASONS)[number];

export type ArtifactSettings = {
  enabled: boolean;
  name: string;
  retentionDays: number;
  directory: string;
};

export type ArtifactContext = {
  isGitHubActions: boolean;
  hasRuntimeToken: boolean;
  hasResultsUrl: boolean;
  serverUrl: string;
  repository: string | undefined;
  runId: string | undefined;
};

export type ArtifactFile = {
  absolutePath: string;
  relativePath: string;
};

export type ArtifactUploadResult =
  | {
      kind: "uploaded";
      id: number;
      size: number;
      digest: string;
      url: string | undefined;
      fileCount: number;
    }
  | {
      kind: "skipped";
      reason: ArtifactSkipReason;
    }
  | {
      kind: "failed";
      message: string;
    };

const EXCLUDED_ARTIFACT_FILES = new Set(["fuzzingclient.json"]);

function isSupportedHost(serverUrl: string): boolean {
  try {
    const hostname = new URL(serverUrl).hostname.toLowerCase();

    return (
      hostname === "github.com" || hostname.endsWith(".ghe.com") || hostname.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}

export function getEnvironmentSkipReason(
  settings: ArtifactSettings,
  context: ArtifactContext,
): ArtifactSkipReason | undefined {
  if (!settings.enabled) {
    return "disabled";
  }

  if (!context.isGitHubActions) {
    return "not-actions";
  }

  if (!context.hasRuntimeToken) {
    return "missing-token";
  }

  if (!context.hasResultsUrl) {
    return "missing-results-url";
  }

  if (!isSupportedHost(context.serverUrl)) {
    return "unsupported-host";
  }

  return undefined;
}

export async function listRegularFiles(root: string): Promise<ArtifactFile[]> {
  const files: ArtifactFile[] = [];

  async function walk(directory: string): Promise<void> {
    const entries = await readdir(directory);

    for (const entry of entries) {
      const absolutePath = join(directory, entry);
      const stats = await lstat(absolutePath);

      if (stats.isSymbolicLink()) {
        continue;
      }

      if (stats.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (stats.isFile()) {
        const artifactRelativePath = relative(root, absolutePath);

        if (EXCLUDED_ARTIFACT_FILES.has(artifactRelativePath)) {
          continue;
        }

        files.push({ absolutePath, relativePath: artifactRelativePath });
      }
    }
  }

  await walk(root);

  return files.toSorted((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/u, "");
}

export function buildArtifactUrl(context: ArtifactContext, id: number): string | undefined {
  if (context.repository === undefined || context.runId === undefined) {
    return undefined;
  }

  return `${trimTrailingSlashes(context.serverUrl)}/${context.repository}/actions/runs/${context.runId}/artifacts/${id}`;
}

function scrubSecrets(message: string): string {
  const secrets = [process.env.ACTIONS_RUNTIME_TOKEN, process.env.ACTIONS_RESULTS_URL].filter(
    (secret): secret is string => secret !== undefined && secret !== "",
  );

  return secrets.reduce((scrubbed, secret) => scrubbed.replaceAll(secret, "[REDACTED]"), message);
}

function messageOf(error: Error): string {
  return scrubSecrets(error.message);
}

export async function uploadReport(
  settings: ArtifactSettings,
  context: ArtifactContext,
): Promise<ArtifactUploadResult> {
  const skipReason = getEnvironmentSkipReason(settings, context);

  if (skipReason !== undefined) {
    return { kind: "skipped", reason: skipReason };
  }

  try {
    const files = await listRegularFiles(settings.directory);

    if (files.length === 0) {
      return { kind: "skipped", reason: "no-files" };
    }

    const client = new DefaultArtifactClient();

    const response = await client.uploadArtifact(
      settings.name,
      files.map((file) => file.absolutePath),
      settings.directory,
      { retentionDays: settings.retentionDays },
    );

    if (response.id === undefined) {
      return { kind: "failed", message: "artifact service did not return an artifact id" };
    }

    return {
      kind: "uploaded",
      id: response.id,
      size: response.size ?? 0,
      digest: response.digest ?? "",
      url: buildArtifactUrl(context, response.id),
      fileCount: files.length,
    };
  } catch (error) {
    if (error instanceof Error) {
      return { kind: "failed", message: messageOf(error) };
    }

    return { kind: "failed", message: "artifact upload failed with an unknown error" };
  }
}
