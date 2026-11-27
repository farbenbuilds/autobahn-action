import { posix, win32 } from "node:path";

import type { DockerNetwork } from "../action/inputs.ts";

export type DockerPlatform = "linux" | "darwin" | "win32";

export type ContainerNetwork = "host" | "bridge";

export type DockerPlanInput = {
  url: string;
  configPath: string;
  reportDir: string;
  containerName: string;
  image: string;
  network: DockerNetwork;
  platform: DockerPlatform;
  uid: number | undefined;
  gid: number | undefined;
};

export type DockerPlan = {
  args: string[];
  containerUrl: string;
  network: ContainerNetwork;
};

const HOST_GATEWAY_NAME = "host.docker.internal";
const CONTAINER_CONFIG_PATH = "/fuzzingclient.json";
const CONTAINER_REPORT_DIR = "/reports";
const MOUNT_PATH_CONTROL_PATTERN = /\p{Cc}/u;

function validateMountPath(path: string, name: string, platform: DockerPlatform): void {
  if (MOUNT_PATH_CONTROL_PATTERN.test(path)) {
    throw new Error(`${name} must not contain control characters or line breaks`);
  }

  const pathParser = platform === "win32" ? win32 : posix;

  if (platform !== "win32" && path.includes(":")) {
    throw new Error(`${name} must not contain ':' on ${platform}`);
  }

  if (!pathParser.isAbsolute(path)) {
    throw new Error(`${name} must be an absolute path`);
  }

  const normalized = pathParser.normalize(path);
  const canonicalPath = platform === "win32" ? path.replaceAll("/", "\\") : path;
  const root = pathParser.parse(normalized).root;

  if (root !== "" && normalized === root) {
    throw new Error(`${name} must not be a filesystem root`);
  }

  if (normalized !== canonicalPath) {
    throw new Error(`${name} must be a normalized path without traversal or redundant separators`);
  }

  if (platform === "win32" && normalized.slice(root.length).includes(":")) {
    throw new Error(`${name} must not contain ':' after the drive or share root`);
  }
}

function isLoopbackHostname(hostname: string): boolean {
  if (
    hostname === "localhost" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "[::1]"
  ) {
    return true;
  }

  return /^127(?:\.\d{1,3}){3}$/u.test(hostname);
}

export function resolveContainerNetwork(
  requested: DockerNetwork,
  platform: DockerPlatform,
): ContainerNetwork {
  if (requested === "auto") {
    return platform === "linux" ? "host" : "bridge";
  }

  return requested;
}

function replaceUrlHost(url: string, hostname: string): string {
  const schemeEnd = url.indexOf("://");

  if (schemeEnd === -1) {
    return url;
  }

  const authorityStart = schemeEnd + 3;
  const authorityOffset = url.slice(authorityStart).search(/[/?#]/u);
  const authorityEnd = authorityOffset === -1 ? url.length : authorityStart + authorityOffset;
  const authority = url.slice(authorityStart, authorityEnd);
  const userInfoEnd = authority.lastIndexOf("@") + 1;
  const hostAndPort = authority.slice(userInfoEnd);

  const portStart = hostAndPort.startsWith("[")
    ? hostAndPort.indexOf("]") + 1
    : hostAndPort.indexOf(":");

  const port = portStart === -1 ? "" : hostAndPort.slice(portStart);

  return `${url.slice(0, authorityStart)}${authority.slice(0, userInfoEnd)}${hostname}${port}${url.slice(authorityEnd)}`;
}

export function mapContainerUrl(url: string, network: ContainerNetwork): string {
  if (network === "host") {
    return url;
  }

  const parsed = new URL(url);

  if (!isLoopbackHostname(parsed.hostname)) {
    return url;
  }

  return replaceUrlHost(url, HOST_GATEWAY_NAME);
}

export function buildDockerPlan(input: DockerPlanInput): DockerPlan {
  validateMountPath(input.configPath, "configPath", input.platform);
  validateMountPath(input.reportDir, "reportDir", input.platform);

  const hasUid = input.uid !== undefined;
  const hasGid = input.gid !== undefined;

  if (hasUid !== hasGid) {
    throw new Error("uid and gid must be provided together");
  }

  const network = resolveContainerNetwork(input.network, input.platform);
  const networkArgs = network === "bridge" ? [`--add-host=${HOST_GATEWAY_NAME}:host-gateway`] : [];

  const userArgs =
    input.uid !== undefined && input.gid !== undefined
      ? ["--user", `${input.uid}:${input.gid}`]
      : [];

  const args = [
    "docker",
    "run",
    "--rm",
    "--name",
    input.containerName,
    "--network",
    network,
    ...networkArgs,
    "-v",
    `${input.configPath}:${CONTAINER_CONFIG_PATH}:ro`,
    "-v",
    `${input.reportDir}:${CONTAINER_REPORT_DIR}`,
    ...userArgs,
    "--",
    input.image,
    "wstest",
    "-m",
    "fuzzingclient",
    "-s",
    CONTAINER_CONFIG_PATH,
  ];

  return {
    args,
    containerUrl: mapContainerUrl(input.url, network),
    network,
  };
}
