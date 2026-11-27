import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { describe, it } from "node:test";

import { waitForServer } from "../../src/server/wait-for-server.ts";

const WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

type TestServer = {
  server: Server;
  url: string;
  sockets: Set<Socket>;
};

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();

      assert.ok(address !== null);
      // SAFETY: listen(0, host) always yields an AddressInfo, never a pipe path.
      resolve((address as AddressInfo).port);
    });
  });
}

async function close(testServer: TestServer): Promise<void> {
  for (const socket of testServer.sockets) {
    socket.destroy();
  }

  testServer.server.closeAllConnections();

  await new Promise<void>((resolve, reject) => {
    testServer.server.close((error) => {
      if (error === undefined) {
        resolve();

        return;
      }

      reject(error);
    });
  });
}

async function createHandshakeServer(): Promise<TestServer> {
  const server = createServer((_request, response) => {
    response.writeHead(200);
    response.end("not a websocket");
  });

  const sockets = new Set<Socket>();

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => {
      sockets.delete(socket);
    });
  });

  server.on("upgrade", (request, socket) => {
    const key = request.headers["sec-websocket-key"];

    if (key === undefined || Array.isArray(key)) {
      socket.destroy();

      return;
    }

    const accept = createHash("sha1").update(`${key}${WEBSOCKET_GUID}`).digest("base64");

    socket.write(
      [
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${accept}`,
        "",
        "",
      ].join("\r\n"),
    );
    socket.on("error", () => {
      socket.destroy();
    });
  });

  const port = await listen(server);

  return { server, url: `ws://127.0.0.1:${port}/`, sockets };
}

async function createHttpOnlyServer(): Promise<TestServer> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("not a websocket");
  });

  const sockets = new Set<Socket>();

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => {
      sockets.delete(socket);
    });
  });

  const port = await listen(server);

  return { server, url: `ws://127.0.0.1:${port}/`, sockets };
}

describe("waitForServer", () => {
  it("resolves after a successful WebSocket handshake", async () => {
    const testServer = await createHandshakeServer();

    try {
      await assert.doesNotReject(
        waitForServer({
          url: testServer.url,
          timeoutMs: 1000,
          intervalMs: 20,
          isServerRunning: () => true,
        }),
      );
    } finally {
      await close(testServer);
    }
  });

  it("times out against a server that does not upgrade", async () => {
    const testServer = await createHttpOnlyServer();

    try {
      await assert.rejects(
        waitForServer({
          url: testServer.url,
          timeoutMs: 150,
          intervalMs: 20,
          isServerRunning: () => true,
        }),
        /server did not become ready within 150 ms/u,
      );
    } finally {
      await close(testServer);
    }
  });

  it("fails fast when the managed server has exited", async () => {
    const startedAt = Date.now();

    await assert.rejects(
      waitForServer({
        url: "ws://127.0.0.1:1/",
        timeoutMs: 5000,
        intervalMs: 20,
        isServerRunning: () => false,
      }),
      /server exited before becoming ready/u,
    );

    assert.ok(Date.now() - startedAt < 1000);
  });

  it("clears its timers after the timeout", async () => {
    const testServer = await createHttpOnlyServer();

    try {
      await assert.rejects(
        waitForServer({
          url: testServer.url,
          timeoutMs: 100,
          intervalMs: 500,
          isServerRunning: () => true,
        }),
        /within 100 ms/u,
      );

      await delay(20);
    } finally {
      await close(testServer);
    }
  });
});
