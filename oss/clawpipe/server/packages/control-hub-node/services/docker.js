"use strict";

const fs = require("fs");
const { execFile } = require("child_process");
const { promisify } = require("util");
const utils = require("../utils");

const execFileAsync = promisify(execFile);
let composeRunnerCache = null;

async function detectLocalFallbackOpenclawImage(projectRoot) {
  try {
    const { stdout } = await execFileAsync(
      "docker", ["images", "--format", "{{.Repository}}:{{.Tag}}"],
      { cwd: projectRoot, timeout: 12000, maxBuffer: 512 * 1024 },
    );
    const images = String(stdout || "").split("\n").map((l) => l.trim())
      .filter(Boolean).filter((n) => !n.endsWith(":<none>"));
    if (!images.length) return "";
    const preferred = ["docker-lunaos-api:latest", "docker-lunaos-api"];
    for (const name of preferred) {
      const hit = images.find((img) => img === name || img.startsWith(`${name}:`));
      if (hit) return hit;
    }
    return images.find((img) => /(lunaos|openclaw)/i.test(img)) || "";
  } catch { return ""; }
}

async function detectComposeRunner(projectRoot) {
  if (composeRunnerCache) return composeRunnerCache;
  try {
    await execFileAsync("docker", ["compose", "version"], { cwd: projectRoot, timeout: 12000, maxBuffer: 512 * 1024 });
    composeRunnerCache = { command: "docker", prefixArgs: ["compose"] };
    return composeRunnerCache;
  } catch { /* fall through */ }
  try {
    await execFileAsync("docker-compose", ["version"], { cwd: projectRoot, timeout: 12000, maxBuffer: 512 * 1024 });
    composeRunnerCache = { command: "docker-compose", prefixArgs: [] };
    return composeRunnerCache;
  } catch {
    throw new Error("Docker Compose not found. Install Docker Desktop or docker-compose.");
  }
}

async function runDockerCompose(composeArgs, stack, timeoutMs = 180000, extraEnv = {}, projectRoot, dockerStackFiles) {
  const normalizedStack = utils.normalizeDockerStack(stack);
  const composeFile = dockerStackFiles[normalizedStack];
  if (!fs.existsSync(composeFile)) throw new Error(`Compose file not found for stack '${normalizedStack}'.`);
  const runner = await detectComposeRunner(projectRoot);
  const args = [...runner.prefixArgs, "-f", composeFile, ...composeArgs];
  try {
    const { stdout, stderr } = await execFileAsync(runner.command, args, {
      cwd: projectRoot, timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, ...extraEnv },
    });
    return {
      ok: true, stack: normalizedStack, composeFile,
      command: [runner.command, ...args].join(" "),
      envOverrides: Object.keys(extraEnv),
      stdout: String(stdout || "").trim(), stderr: String(stderr || "").trim(),
    };
  } catch (err) {
    const stdout = String(err.stdout || "").trim();
    const stderr = String(err.stderr || "").trim();
    const wrapped = new Error(stderr || stdout || err.message || "Docker command failed");
    wrapped.details = {
      ok: false, stack: normalizedStack, composeFile,
      command: [runner.command, ...args].join(" "),
      envOverrides: Object.keys(extraEnv), stdout, stderr,
      exitCode: typeof err.code === "number" ? err.code : null,
    };
    throw wrapped;
  }
}

module.exports = { detectLocalFallbackOpenclawImage, detectComposeRunner, runDockerCompose };
