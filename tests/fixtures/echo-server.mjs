import { WebSocketServer } from "ws";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 9001;
const SHUTDOWN_GRACE_MS = 2000;

function readFlag(name, fallback) {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];

  return value === undefined ? fallback : value;
}

const host = readFlag("--host", DEFAULT_HOST);
const port = Number(readFlag("--port", String(DEFAULT_PORT)));

const server = new WebSocketServer({ host, port });

server.on("connection", (socket) => {
  socket.on("message", (data, isBinary) => {
    socket.send(data, { binary: isBinary });
  });
});

server.on("listening", () => {
  process.stdout.write(`echo server listening on ws://${host}:${port}\n`);
});

server.on("error", (error) => {
  process.stderr.write(`echo server error: ${error.message}\n`);
  process.exitCode = 1;
  server.close();
});

function shutdown() {
  server.close(() => {
    process.exit(0);
  });

  setTimeout(() => {
    process.exit(0);
  }, SHUTDOWN_GRACE_MS).unref();
}

process.on("SIGTERM", shutdown);

process.on("SIGINT", shutdown);
