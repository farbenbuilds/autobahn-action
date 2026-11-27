export type ReadinessProbe = {
  url: string;
  timeoutMs: number;
  intervalMs: number;
  isServerRunning: () => boolean;
};

function probeOnce(url: string, timeoutMs: number): Promise<boolean> {
  let socket: WebSocket;

  try {
    socket = new WebSocket(url);
  } catch {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = (isReady: boolean): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("error", onFailure);
      socket.removeEventListener("close", onClose);
      socket.close();
      resolve(isReady);
    };

    const onOpen = (): void => {
      finish(true);
    };

    const onFailure = (): void => {
      finish(false);
    };

    const onClose = (): void => {
      finish(false);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);

    socket.addEventListener("open", onOpen);
    socket.addEventListener("error", onFailure);
    socket.addEventListener("close", onClose);
  });
}

function waitForInterval(intervalMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, intervalMs);
  });
}

export async function waitForServer(probe: ReadinessProbe): Promise<void> {
  const deadline = Date.now() + probe.timeoutMs;

  while (Date.now() <= deadline) {
    if (!probe.isServerRunning()) {
      throw new Error("server exited before becoming ready");
    }

    const isReady = await probeOnce(probe.url, Math.max(1, deadline - Date.now()));

    if (isReady) {
      return;
    }

    if (!probe.isServerRunning()) {
      throw new Error("server exited before becoming ready");
    }

    const remainingMs = deadline - Date.now();

    if (remainingMs <= 0) {
      break;
    }

    await waitForInterval(Math.min(probe.intervalMs, remainingMs));
  }

  throw new Error(`server did not become ready within ${probe.timeoutMs} ms`);
}
