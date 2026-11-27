import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

await build({
  entryPoints: [join(ROOT, "src/main.ts")],
  outfile: join(ROOT, "dist/index.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node24",
  minify: false,
  sourcemap: false,
  legalComments: "none",
  logLevel: "info",
});
