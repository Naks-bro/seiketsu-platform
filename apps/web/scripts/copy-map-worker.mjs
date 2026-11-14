// Copies MapLibre's web worker next to the site's static files, so the map can load it from our own origin
// (the bundler does not emit it). Runs before `dev` and `build`; the copy always matches the installed version.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pkg = require.resolve("maplibre-gl/package.json");
const from = join(dirname(pkg), "dist", "maplibre-gl-worker.mjs");
const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "maplibre");
mkdirSync(dir, { recursive: true });
copyFileSync(from, join(dir, "maplibre-gl-worker.mjs"));
