// Enforces the mechanically checkable repository conventions that Oxlint does
// not cover: the 500-line module budget, kebab-case filenames, emoji code
// points, forbidden markers, and console output in shipped source.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN_ROOTS = ["src", "tests", "scripts"];
const EXEMPT = new Set(["scripts/oxlint-plugin.mjs", "scripts/check-conventions.mjs"]);
const MAX_LINES = 500;

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".mts",
  ".cts",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".yml",
  ".yaml",
]);

const EMOJI = /\p{Extended_Pictographic}|\u20E3|\p{Regional_Indicator}/u;
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FORBIDDEN_MARKER = /\b(?:TODO|FIXME|XXX|HACK)\b/u;

const violations = [];

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(path);
      continue;
    }

    check(path);
  }
}

function check(path) {
  const name = relative(ROOT, path).split(sep).join("/");

  if (EXEMPT.has(name)) return;

  const extension = name.slice(name.lastIndexOf("."));

  if (!TEXT_EXTENSIONS.has(extension)) return;

  const source = readFileSync(path, "utf8");
  const lines = source.split("\n").length - (source.endsWith("\n") ? 1 : 0);

  if (lines > MAX_LINES) {
    violations.push(`${name}: ${lines} lines exceeds the ${MAX_LINES}-line module budget`);
  }

  if (EMOJI.test(source)) violations.push(`${name}: contains an emoji code point`);

  if (FORBIDDEN_MARKER.test(source)) {
    violations.push(`${name}: contains a TODO, FIXME, XXX, or HACK marker`);
  }

  if (name.startsWith("src/") && source.includes("console.")) {
    violations.push(`${name}: uses console in shipped source; use @actions/core logging`);
  }

  if (
    (extension === ".ts" || extension === ".mts" || extension === ".cts") &&
    name.startsWith("src/")
  ) {
    const base = name.slice(name.lastIndexOf("/") + 1);
    const stem = base.slice(0, base.length - extension.length);

    if (!KEBAB_CASE.test(stem)) {
      violations.push(`${name}: TypeScript filename '${stem}' is not kebab-case`);
    }
  }
}

for (const root of SCAN_ROOTS) {
  const directory = join(ROOT, root);

  if (existsSync(directory)) walk(directory);
}

if (violations.length > 0) {
  for (const violation of violations) process.stderr.write(`conventions: ${violation}\n`);
  process.exit(1);
}

process.stdout.write("conventions: ok\n");
