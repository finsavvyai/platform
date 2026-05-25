/**
 * Questro Workers Build Configuration
 *
 * This config builds the Cloudflare Workers application using esbuild
 * for fast TypeScript compilation and bundling optimized for edge computing.
 */

import esbuild from "esbuild";
const isWatchMode = process.argv.includes("--watch");

// Build configuration
const config = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "browser",
  target: "es2022",
  format: "esm",
  minify: process.env.NODE_ENV === "production",
  sourcemap: true,
  define: {
    "process.env.NODE_ENV": `"${process.env.NODE_ENV || "development"}"`,
    "process.env.ENVIRONMENT": `"${process.env.ENVIRONMENT || "development"}"`,
  },
  external: [
    // Cloudflare Workers bindings are provided by the runtime
    "@cloudflare/workers-types",
    // Node.js built-ins that aren't available in Workers
    "node:*",
    // Packages that are incompatible with Workers
    "aws-sdk",
    "sharp",
    "canvas",
  ],
  loader: {
    ".ts": "ts",
  },
  tsconfig: "./tsconfig.json",
  outfile: "./dist/worker.js",
  logLevel: "info",
};

// Build function
async function build() {
  console.log("🔨 Building Questro Workers application...");

  try {
    if (isWatchMode) {
      console.log("👀 Starting watch mode...");
      const context = await esbuild.context(config);
      await context.watch();
      console.log("✅ Watch mode started. Building...");
    } else {
      await esbuild.build(config);
      console.log("✅ Build completed successfully!");

      // Validate the output
      const fs = await import("fs");
      if (fs.existsSync("./dist/worker.js")) {
        const stats = fs.statSync("./dist/worker.js");
        console.log(`📦 Bundle size: ${(stats.size / 1024).toFixed(2)} KB`);
      }
    }
  } catch (error) {
    console.error("❌ Build failed:", error);
    process.exit(1);
  }
}

// Run build if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  build();
}

export { build, config };
