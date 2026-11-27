import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_DOCKER_IMAGE } from "../../src/action/inputs.ts";
import {
  buildDockerPlan,
  mapContainerUrl,
  resolveContainerNetwork,
} from "../../src/suite/docker.ts";

import type { DockerPlanInput } from "../../src/suite/docker.ts";

const BASE_PLAN_INPUT: DockerPlanInput = {
  url: "ws://127.0.0.1:9001",
  configPath: "/tmp/fuzzingclient.json",
  reportDir: "/tmp/reports",
  containerName: "autobahn-testsuite",
  image: DEFAULT_DOCKER_IMAGE,
  network: "auto",
  platform: "linux",
  uid: undefined,
  gid: undefined,
};

describe("resolveContainerNetwork", () => {
  it("uses host networking for auto on linux", () => {
    assert.equal(resolveContainerNetwork("auto", "linux"), "host");
  });

  it("uses bridge networking for auto away from linux", () => {
    assert.equal(resolveContainerNetwork("auto", "darwin"), "bridge");
    assert.equal(resolveContainerNetwork("auto", "win32"), "bridge");
  });

  it("honors an explicit network on every platform", () => {
    assert.equal(resolveContainerNetwork("host", "linux"), "host");
    assert.equal(resolveContainerNetwork("host", "darwin"), "host");
    assert.equal(resolveContainerNetwork("bridge", "linux"), "bridge");
    assert.equal(resolveContainerNetwork("bridge", "win32"), "bridge");
  });
});

describe("mapContainerUrl", () => {
  it("keeps the URL unchanged on host networking", () => {
    const url = "ws://localhost:9001/ws?token=a#frag";

    assert.equal(mapContainerUrl(url, "host"), url);
  });

  it("maps loopback hosts to host.docker.internal on bridge networking", () => {
    assert.equal(
      mapContainerUrl("ws://localhost:9001/ws?token=a#frag", "bridge"),
      "ws://host.docker.internal:9001/ws?token=a#frag",
    );
    assert.equal(
      mapContainerUrl("ws://127.0.0.1:9001/ws?token=a", "bridge"),
      "ws://host.docker.internal:9001/ws?token=a",
    );
    assert.equal(
      mapContainerUrl("ws://127.1.2.3:9001/ws?token=a", "bridge"),
      "ws://host.docker.internal:9001/ws?token=a",
    );
    assert.equal(
      mapContainerUrl("ws://0.0.0.0:9001/ws?token=a", "bridge"),
      "ws://host.docker.internal:9001/ws?token=a",
    );
    assert.equal(
      mapContainerUrl("ws://[::1]:9001/ws?token=a#frag", "bridge"),
      "ws://host.docker.internal:9001/ws?token=a#frag",
    );
  });

  it("does not add a path that the source URL omitted", () => {
    assert.equal(
      mapContainerUrl("ws://127.0.0.1:9001", "bridge"),
      "ws://host.docker.internal:9001",
    );
    assert.equal(
      mapContainerUrl("ws://localhost?token=a", "bridge"),
      "ws://host.docker.internal?token=a",
    );
  });

  it("leaves non-loopback hosts unchanged on bridge networking", () => {
    const url = "wss://example.com:9443/ws?token=a";

    assert.equal(mapContainerUrl(url, "bridge"), url);
    assert.equal(mapContainerUrl("ws://10.0.0.5:9001", "bridge"), "ws://10.0.0.5:9001");
  });
});

describe("buildDockerPlan", () => {
  it("builds the exact host-network argv with no user override", () => {
    const plan = buildDockerPlan({ ...BASE_PLAN_INPUT, platform: "linux", network: "auto" });

    assert.equal(plan.network, "host");
    assert.equal(plan.containerUrl, "ws://127.0.0.1:9001");
    assert.equal(plan.containerName, "autobahn-testsuite");
    assert.deepEqual(plan.args, [
      "docker",
      "run",
      "--rm",
      "--name",
      "autobahn-testsuite",
      "--network",
      "host",
      "-v",
      "/tmp/fuzzingclient.json:/fuzzingclient.json:ro",
      "-v",
      "/tmp/reports:/reports",
      "--",
      DEFAULT_DOCKER_IMAGE,
      "wstest",
      "-m",
      "fuzzingclient",
      "-s",
      "/fuzzingclient.json",
    ]);
  });

  it("builds the exact bridge-network argv with the host gateway", () => {
    const plan = buildDockerPlan({ ...BASE_PLAN_INPUT, platform: "darwin", network: "bridge" });

    assert.equal(plan.network, "bridge");
    assert.equal(plan.containerUrl, "ws://host.docker.internal:9001");
    assert.deepEqual(plan.args, [
      "docker",
      "run",
      "--rm",
      "--name",
      "autobahn-testsuite",
      "--network",
      "bridge",
      "--add-host=host.docker.internal:host-gateway",
      "-v",
      "/tmp/fuzzingclient.json:/fuzzingclient.json:ro",
      "-v",
      "/tmp/reports:/reports",
      "--",
      DEFAULT_DOCKER_IMAGE,
      "wstest",
      "-m",
      "fuzzingclient",
      "-s",
      "/fuzzingclient.json",
    ]);
  });

  it("adds a user override when both uid and gid are present", () => {
    const plan = buildDockerPlan({
      ...BASE_PLAN_INPUT,
      platform: "linux",
      network: "host",
      uid: 1000,
      gid: 1000,
    });

    const userId = plan.args.indexOf("--user");

    assert.deepEqual(plan.args.slice(userId, userId + 2), ["--user", "1000:1000"]);
    assert.equal(plan.args[userId + 2], "--");
    assert.equal(plan.args[userId + 3], DEFAULT_DOCKER_IMAGE);
  });

  it("allows a root user override", () => {
    const plan = buildDockerPlan({
      ...BASE_PLAN_INPUT,
      platform: "linux",
      network: "host",
      uid: 0,
      gid: 0,
    });

    const userId = plan.args.indexOf("--user");

    assert.deepEqual(plan.args.slice(userId, userId + 2), ["--user", "0:0"]);
  });

  it("rejects a half uid and gid pair", () => {
    assert.throws(
      () => buildDockerPlan({ ...BASE_PLAN_INPUT, uid: 1000 }),
      /uid and gid must be provided together/u,
    );
    assert.throws(
      () => buildDockerPlan({ ...BASE_PLAN_INPUT, gid: 1000 }),
      /uid and gid must be provided together/u,
    );
  });

  it("rejects a relative config path", () => {
    assert.throws(
      () => buildDockerPlan({ ...BASE_PLAN_INPUT, configPath: "fuzzingclient.json" }),
      /configPath must be an absolute path/u,
    );
  });

  it("rejects relative report directory", () => {
    assert.throws(
      () => buildDockerPlan({ ...BASE_PLAN_INPUT, reportDir: "reports" }),
      /reportDir must be an absolute path/u,
    );
  });

  it("rejects filesystem roots", () => {
    assert.throws(
      () => buildDockerPlan({ ...BASE_PLAN_INPUT, configPath: "/" }),
      /configPath must not be a filesystem root/u,
    );
    assert.throws(
      () => buildDockerPlan({ ...BASE_PLAN_INPUT, platform: "win32", configPath: "C:\\" }),
      /configPath must not be a filesystem root/u,
    );
    assert.throws(
      () =>
        buildDockerPlan({
          ...BASE_PLAN_INPUT,
          platform: "win32",
          configPath: "\\\\server\\share",
        }),
      /configPath must not be a filesystem root/u,
    );
  });

  it("rejects non-normalized mount paths", () => {
    assert.throws(
      () => buildDockerPlan({ ...BASE_PLAN_INPUT, configPath: "/tmp/../etc" }),
      /configPath must be a normalized path/u,
    );
    assert.throws(
      () => buildDockerPlan({ ...BASE_PLAN_INPUT, reportDir: "/tmp/./reports" }),
      /reportDir must be a normalized path/u,
    );
    assert.throws(
      () => buildDockerPlan({ ...BASE_PLAN_INPUT, reportDir: "/tmp//reports" }),
      /reportDir must be a normalized path/u,
    );
    assert.throws(
      () =>
        buildDockerPlan({
          ...BASE_PLAN_INPUT,
          platform: "win32",
          network: "bridge",
          configPath: "C:/work/fuzzingclient.json",
          reportDir: "C:/work/../reports",
        }),
      /reportDir must be a normalized path/u,
    );
  });

  it("rejects control characters and line breaks in mount paths", () => {
    assert.throws(
      () => buildDockerPlan({ ...BASE_PLAN_INPUT, configPath: "/tmp/fuzz\u0000.json" }),
      /configPath must not contain control characters or line breaks/u,
    );
    assert.throws(
      () => buildDockerPlan({ ...BASE_PLAN_INPUT, reportDir: "/tmp/reports\n" }),
      /reportDir must not contain control characters or line breaks/u,
    );
  });

  it("rejects colons in mount paths off win32", () => {
    assert.throws(
      () =>
        buildDockerPlan({
          ...BASE_PLAN_INPUT,
          platform: "linux",
          configPath: "/tmp/fuzz:client.json",
        }),
      /configPath must not contain ':' on linux/u,
    );
    assert.throws(
      () =>
        buildDockerPlan({
          ...BASE_PLAN_INPUT,
          platform: "darwin",
          reportDir: "/tmp:reports",
        }),
      /reportDir must not contain ':' on darwin/u,
    );
  });

  it("rejects NTFS alternate data streams on win32", () => {
    assert.throws(
      () =>
        buildDockerPlan({
          ...BASE_PLAN_INPUT,
          platform: "win32",
          network: "bridge",
          configPath: "C:\\work\\fuzzingclient.json",
          reportDir: "C:\\work\\reports:ads",
        }),
      /reportDir must not contain ':' after the drive or share root/u,
    );
  });

  it("allows Windows drive paths on win32", () => {
    const plan = buildDockerPlan({
      ...BASE_PLAN_INPUT,
      platform: "win32",
      network: "bridge",
      configPath: "C:\\work\\fuzzingclient.json",
      reportDir: "C:\\work\\reports",
    });

    assert.equal(plan.network, "bridge");
    assert.ok(plan.args.includes("C:\\work\\fuzzingclient.json:/fuzzingclient.json:ro"));
    assert.ok(plan.args.includes("C:\\work\\reports:/reports"));
  });

  it("accepts forward and mixed Windows separators on win32", () => {
    const reportDirs = ["C:/work/reports", "C:/work/reports/", "C:\\work/reports"];

    for (const reportDir of reportDirs) {
      const plan = buildDockerPlan({
        ...BASE_PLAN_INPUT,
        platform: "win32",
        network: "bridge",
        configPath: "C:/work/fuzzingclient.json",
        reportDir,
      });

      assert.ok(plan.args.includes(`${reportDir}:/reports`));
    }
  });
});
