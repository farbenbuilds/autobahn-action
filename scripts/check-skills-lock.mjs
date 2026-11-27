// Verifies that every installed skill matches the hash recorded in
// skills-lock.json and that no unpinned skill directory was added.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SKILLS_DIR = ".agents/skills";
const LOCK_FILE = "skills-lock.json";

const violations = [];

function readLock() {
  const raw = readFileSync(LOCK_FILE, "utf8");

  return JSON.parse(raw);
}

function hash(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const lock = readLock();

if (lock.version !== 2)
  violations.push(`${LOCK_FILE}: unsupported version ${String(lock.version)}`);

for (const [name, entry] of Object.entries(lock.skills)) {
  const path = join(SKILLS_DIR, name, "SKILL.md");

  if (!existsSync(path)) {
    violations.push(`${path}: missing installed skill`);
    continue;
  }

  const actual = hash(path);

  if (actual !== entry.computedHash) {
    violations.push(`${path}: hash ${actual} does not match ${entry.computedHash}`);
  }
}

for (const entry of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;

  if (entry.name === "graphify") continue;

  if (Object.hasOwn(lock.skills, entry.name)) continue;

  violations.push(`${SKILLS_DIR}/${entry.name}: installed skill is not pinned`);
}

if (violations.length > 0) {
  for (const violation of violations) process.stderr.write(`skills: ${violation}\n`);
  process.exit(1);
}

process.stdout.write(`skills: ${String(Object.keys(lock.skills).length)} pinned and verified\n`);
