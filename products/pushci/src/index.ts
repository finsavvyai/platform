// PushCI MCP Server — Smithery-compatible entry point.
// Spawns the PushCI Go binary's MCP server over stdio.
// Install: npm install -g pushci
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const binPath = resolve(__dirname, "..", "bin", "pushci.js");

if (existsSync(binPath)) {
  const child = spawn("node", [binPath, "mcp"], { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 0));
} else {
  process.stderr.write("PushCI not installed. Run: npm install -g pushci\n");
  process.exit(1);
}
