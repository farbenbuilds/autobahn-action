import { setFailed } from "@actions/core";

import { runAction } from "./action/run.ts";

async function main(): Promise<void> {
  try {
    await runAction();
  } catch (cause) {
    setFailed(cause instanceof Error ? cause.message : String(cause));
  }
}

void main();
