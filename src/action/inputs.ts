import { getInput } from "@actions/core";

import { isIP } from "node:net";

import { FAILURE_POLICIES, type FailurePolicy } from "../domain/autobahn.ts";

export const DEFAULT_DOCKER_IMAGE =
  "crossbario/autobahn-testsuite:0.8.2@sha256:519915fb568b04c9383f70a1c405ae3ff44ab9e35835b085239c258b6fac3074";

export const DOCKER_NETWORKS = ["auto", "host", "bridge"] as const;

export type DockerNetwork = (typeof DOCKER_NETWORKS)[number];

export type ActionInputs = {
  url: string;
  serverCommand: string | undefined;
  serverWorkingDirectory: string;
  serverReadyTimeoutSeconds: number;
  cases: string[];
  excludeCases: string[];
  agent: string;
  reportDir: string;
  dockerImage: string;
  dockerNetwork: DockerNetwork;
  timeoutSeconds: number;
  failOn: FailurePolicy;
  summary: boolean;
  annotate: boolean;
  uploadArtifact: boolean;
  artifactName: string;
  retentionDays: number;
};

export type InputReader = (name: string) => string;

const DEFAULT_URL = "ws://127.0.0.1:9001";
const DEFAULT_SERVER_WORKING_DIRECTORY = ".";
const DEFAULT_SERVER_READY_TIMEOUT_SECONDS = 30;

// Mirrors denoland/fastwebsockets autobahn/fuzzingclient.json (Apache-2.0):
// https://github.com/denoland/fastwebsockets/tree/main/autobahn
export const DEFAULT_CASES: string[] = [
  "1.*",
  "2.*",
  "3.*",
  "4.*",
  "5.*",
  "6.*",
  "7.*",
  "9.*",
  "10.*",
];

export const DEFAULT_EXCLUDE_CASES: string[] = [];

const DEFAULT_AGENT = "autobahn-action";
const DEFAULT_REPORT_DIR = "autobahn-reports";
const DEFAULT_DOCKER_NETWORK: DockerNetwork = "auto";
const DEFAULT_TIMEOUT_SECONDS = 1800;
const DEFAULT_FAIL_ON: FailurePolicy = "failed";
const DEFAULT_ARTIFACT_NAME = "autobahn-report";
const DEFAULT_RETENTION_DAYS = 30;
const MAX_ARTIFACT_NAME_LENGTH = 255;
const DOCKER_IMAGE_MAX_NAME_LENGTH = 255;
const DOCKER_IMAGE_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const DOCKER_IMAGE_TAG_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/u;
const DOCKER_IMAGE_REPOSITORY_COMPONENT_PATTERN = /^[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*$/u;

const DOCKER_IMAGE_DOMAIN_PATTERN =
  /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)*[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/u;

const DOCKER_IMAGE_PORT_PATTERN = /^[0-9]+$/u;
const DOCKER_IMAGE_FORBIDDEN_PATTERN = /[\s\p{Cc}]/u;
const ARTIFACT_NAME_FORBIDDEN_PATTERN = /[":<>|*?\\/\r\n]/u;

function readText(read: InputReader, name: string, fallback: string): string {
  const value = read(name).trim();

  return value === "" ? fallback : value;
}

function readNonEmptyText(read: InputReader, name: string, fallback: string): string {
  const value = readText(read, name, fallback);

  if (value === "") {
    throw new Error(`${name} must not be empty`);
  }

  return value;
}

function readOptionalText(read: InputReader, name: string): string | undefined {
  const value = read(name).trim();

  return value === "" ? undefined : value;
}

function readInteger(
  read: InputReader,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = read(name).trim();

  if (raw === "") {
    return fallback;
  }

  const value = Number(raw);

  if (!/^\d+$/u.test(raw) || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }

  return value;
}

function readBoolean(read: InputReader, name: string, fallback: boolean): boolean {
  const raw = read(name).trim();

  if (raw === "") {
    return fallback;
  }

  const normalized = raw.toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  throw new Error(`${name} must be true or false`);
}

function readPatternList(read: InputReader, name: string, fallback: string[]): string[] {
  const patterns = read(name)
    .split(/[\s,]+/u)
    .filter((pattern) => pattern !== "");

  return patterns.length === 0 ? fallback : patterns;
}

function isDockerNetwork(value: string): value is DockerNetwork {
  return DOCKER_NETWORKS.some((network) => network === value);
}

function readDockerNetwork(read: InputReader): DockerNetwork {
  const value = readText(read, "docker-network", DEFAULT_DOCKER_NETWORK);

  if (!isDockerNetwork(value)) {
    throw new Error(`docker-network must be one of ${DOCKER_NETWORKS.join(", ")}`);
  }

  return value;
}

function isFailurePolicy(value: string): value is FailurePolicy {
  return FAILURE_POLICIES.some((policy) => policy === value);
}

function readFailurePolicy(read: InputReader): FailurePolicy {
  const value = readText(read, "fail-on", DEFAULT_FAIL_ON);

  if (!isFailurePolicy(value)) {
    throw new Error(`fail-on must be one of ${FAILURE_POLICIES.join(", ")}`);
  }

  return value;
}

function readUrl(read: InputReader): string {
  const value = readText(read, "url", DEFAULT_URL);

  if (!value.startsWith("ws://") && !value.startsWith("wss://")) {
    throw new Error("url must start with ws:// or wss://");
  }

  const prefix = value.startsWith("wss://") ? "wss://" : "ws://";
  const authority = value.slice(prefix.length);
  const authorityEnd = authority.search(/[/?#]/u);
  const authorityPart = authorityEnd === -1 ? authority : authority.slice(0, authorityEnd);

  if (authorityPart === "") {
    throw new Error("url must include a hostname");
  }

  if (authorityPart.includes("@")) {
    throw new Error("url must not include a username or password");
  }

  if (value.includes("#")) {
    throw new Error("url must not include a fragment");
  }

  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error("url must be a valid ws:// or wss:// URL");
  }

  if (parsed.hostname === "") {
    throw new Error("url must include a hostname");
  }

  if (parsed.username !== "" || parsed.password !== "") {
    throw new Error("url must not include a username or password");
  }

  return parsed.href;
}

function isRegistryComponent(component: string): boolean {
  return (
    component !== component.toLowerCase() ||
    component.includes(".") ||
    component.includes(":") ||
    component === "localhost" ||
    component.startsWith("[")
  );
}

function isValidRegistry(registry: string): boolean {
  if (registry.startsWith("[")) {
    const closingBracket = registry.indexOf("]");

    if (closingBracket === -1) {
      return false;
    }

    const host = registry.slice(1, closingBracket);
    const remainder = registry.slice(closingBracket + 1);

    if (isIP(host) !== 6) {
      return false;
    }

    return (
      remainder === "" ||
      (remainder.startsWith(":") && DOCKER_IMAGE_PORT_PATTERN.test(remainder.slice(1)))
    );
  }

  const portSeparator = registry.lastIndexOf(":");
  const hasPort = portSeparator !== -1;
  const host = hasPort ? registry.slice(0, portSeparator) : registry;
  const port = hasPort ? registry.slice(portSeparator + 1) : "";

  if (hasPort && !DOCKER_IMAGE_PORT_PATTERN.test(port)) {
    return false;
  }

  return DOCKER_IMAGE_DOMAIN_PATTERN.test(host);
}

function isValidRepository(repository: string): boolean {
  return repository
    .split("/")
    .every((component) => DOCKER_IMAGE_REPOSITORY_COMPONENT_PATTERN.test(component));
}

function isValidDockerImage(image: string): boolean {
  if (image === "" || image.startsWith("-") || DOCKER_IMAGE_FORBIDDEN_PATTERN.test(image)) {
    return false;
  }

  const atIndex = image.indexOf("@");

  if (atIndex === -1 || atIndex !== image.lastIndexOf("@")) {
    return false;
  }

  const nameAndTag = image.slice(0, atIndex);
  const digest = image.slice(atIndex + 1);

  if (!DOCKER_IMAGE_DIGEST_PATTERN.test(digest) || nameAndTag === "") {
    return false;
  }

  const lastSlash = nameAndTag.lastIndexOf("/");
  const lastColon = nameAndTag.lastIndexOf(":");
  const hasTag = lastColon > lastSlash;
  const name = hasTag ? nameAndTag.slice(0, lastColon) : nameAndTag;
  const tag = hasTag ? nameAndTag.slice(lastColon + 1) : undefined;

  if (name === "" || name.length > DOCKER_IMAGE_MAX_NAME_LENGTH) {
    return false;
  }

  if (tag !== undefined && !DOCKER_IMAGE_TAG_PATTERN.test(tag)) {
    return false;
  }

  const firstSlash = name.indexOf("/");

  if (firstSlash === -1) {
    return isValidRepository(name);
  }

  const registry = name.slice(0, firstSlash);

  if (!isRegistryComponent(registry)) {
    return isValidRepository(name);
  }

  if (!isValidRegistry(registry)) {
    return false;
  }

  return isValidRepository(name.slice(firstSlash + 1));
}

function readDockerImage(read: InputReader): string {
  const value = readText(read, "docker-image", DEFAULT_DOCKER_IMAGE);

  if (!isValidDockerImage(value)) {
    throw new Error(
      "docker-image must be a valid image reference pinned by @sha256: with 64 lowercase hex characters",
    );
  }

  return value;
}

function readArtifactName(read: InputReader): string {
  const value = readNonEmptyText(read, "artifact-name", DEFAULT_ARTIFACT_NAME);

  if (ARTIFACT_NAME_FORBIDDEN_PATTERN.test(value)) {
    throw new Error("artifact-name contains a character that is not allowed");
  }

  if (value.length > MAX_ARTIFACT_NAME_LENGTH) {
    throw new Error(`artifact-name must be at most ${MAX_ARTIFACT_NAME_LENGTH} characters`);
  }

  return value;
}

export function parseActionInputs(read: InputReader): ActionInputs {
  return {
    url: readUrl(read),
    serverCommand: readOptionalText(read, "server-command"),
    serverWorkingDirectory: readNonEmptyText(
      read,
      "server-working-directory",
      DEFAULT_SERVER_WORKING_DIRECTORY,
    ),
    serverReadyTimeoutSeconds: readInteger(
      read,
      "server-ready-timeout",
      DEFAULT_SERVER_READY_TIMEOUT_SECONDS,
      1,
      3600,
    ),
    cases: readPatternList(read, "cases", DEFAULT_CASES),
    excludeCases: readPatternList(read, "exclude-cases", DEFAULT_EXCLUDE_CASES),
    agent: readNonEmptyText(read, "agent", DEFAULT_AGENT),
    reportDir: readNonEmptyText(read, "report-dir", DEFAULT_REPORT_DIR),
    dockerImage: readDockerImage(read),
    dockerNetwork: readDockerNetwork(read),
    timeoutSeconds: readInteger(read, "timeout", DEFAULT_TIMEOUT_SECONDS, 1, 86400),
    failOn: readFailurePolicy(read),
    summary: readBoolean(read, "summary", true),
    annotate: readBoolean(read, "annotate", true),
    uploadArtifact: readBoolean(read, "upload-artifact", true),
    artifactName: readArtifactName(read),
    retentionDays: readInteger(read, "retention-days", DEFAULT_RETENTION_DAYS, 0, 90),
  };
}

export function loadActionInputs(): ActionInputs {
  return parseActionInputs((name) => getInput(name));
}
