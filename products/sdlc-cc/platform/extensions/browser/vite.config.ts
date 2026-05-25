// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json" with { type: "json" };

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: "dist",
    sourcemap: true,
    minify: "esbuild",
    target: "es2022",
    rollupOptions: {
      input: {
        options: "src/options/options.html",
      },
    },
  },
});
