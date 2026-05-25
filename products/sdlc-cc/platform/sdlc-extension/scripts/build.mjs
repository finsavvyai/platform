#!/usr/bin/env node
/**
 * Build the loadable MV3 extension in dist/.
 *
 * Why esbuild: MV3 content scripts do *not* support ES modules — they
 * must be self-contained, classic-script IIFEs. Popup + options + service
 * worker *can* be modules but chrome's strict resolver requires explicit
 * `.js` extensions, which tsc doesn't emit. esbuild bundles each entry
 * into a single self-contained output, sidestepping both problems.
 *
 * Outputs:
 *   dist/manifest.json
 *   dist/icons/{16,48,128}.png
 *   dist/src/background.js     (module; bundled)
 *   dist/src/content.js        (classic IIFE; bundled for MV3 content script)
 *   dist/src/popup/popup.{html,js}
 *   dist/src/options/options.{html,js}
 */

import { build } from "esbuild";
import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIST = join(ROOT, "dist");
const SRC = join(ROOT, "src");

const entries = [
  { in: join(SRC, "background.ts"),      out: "dist/src/background.js",      format: "esm" },
  { in: join(SRC, "content.ts"),         out: "dist/src/content.js",         format: "iife" },
  { in: join(SRC, "popup/popup.ts"),     out: "dist/src/popup/popup.js",     format: "esm" },
  { in: join(SRC, "options/options.ts"), out: "dist/src/options/options.js", format: "esm" },
];

async function bundle() {
  for (const e of entries) {
    await build({
      entryPoints: [e.in],
      bundle: true,
      outfile: join(ROOT, e.out),
      format: e.format,
      target: ["chrome111"],
      platform: "browser",
      minify: false, // leave readable for Web Store reviewers
      sourcemap: false,
      logLevel: "warning",
    });
    console.log("  bundled", e.out, `(${e.format})`);
  }
}

async function copyTree(src, dst, filter) {
  await mkdir(dst, { recursive: true });
  for (const name of await readdir(src)) {
    const s = join(src, name);
    const d = join(dst, name);
    const st = await stat(s);
    if (st.isDirectory()) {
      await copyTree(s, d, filter);
    } else if (filter(s)) {
      await mkdir(dirname(d), { recursive: true });
      await copyFile(s, d);
      console.log("  copied", relative(ROOT, d));
    }
  }
}

async function main() {
  console.log("build: bundling entries");
  await bundle();

  console.log("build: copying static assets");
  await copyFile(join(ROOT, "manifest.json"), join(DIST, "manifest.json"));
  console.log("  copied dist/manifest.json");
  await copyTree(join(ROOT, "icons"), join(DIST, "icons"), (p) => p.endsWith(".png"));
  await copyTree(SRC, join(DIST, "src"), (p) => p.endsWith(".html"));

  console.log("build: done");
}

main().catch((err) => {
  console.error("build failed:", err);
  process.exit(1);
});
