#!/usr/bin/env node
// Refuses a commit message that carries a CI skip marker anywhere in it. A
// squash merge concatenates every commit body into the message on main, and
// GitHub matches the marker anywhere, so a branch that merely describes the
// marker would silence every workflow on the next merge.

import { readFileSync } from "node:fs";
import { argv } from "node:process";

const MARKERS = ["skip ci", "ci skip", "no ci", "skip actions", "actions skip"];

function violations(message) {
  return MARKERS.filter((marker) => message.includes(`[${marker}]`));
}

function main() {
  const file = argv[2];

  if (file === undefined) throw new Error("check-commit-msg: no message file given");

  const message = readFileSync(file, "utf8").replace(/^#.*$/gm, "");
  const found = violations(message);

  if (found.length === 0) return;

  process.stderr.write("check-commit-msg: this marker would silence CI for the merge\n");

  for (const marker of found) process.stderr.write(`  [${marker}]\n`);

  process.stderr.write(
    "\nA squash merge puts every commit body into the message on main, and GitHub\n" +
      "reads the marker anywhere in it. Nothing then runs.\n\n" +
      "If the merge is quiet, run the lint workflow by hand:\n" +
      "  gh workflow run lint.yml --ref main\n",
  );
  process.exit(1);
}

main();
