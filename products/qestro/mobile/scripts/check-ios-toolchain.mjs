import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const mobileRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const assetCatalogPath = join(mobileRoot, "ios", "Qestro", "Images.xcassets");

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}

function readTrimmed(command, args) {
  const result = run(command, args);
  return `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
}

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

const macosVersion = readTrimmed("sw_vers", ["-productVersion"]);
const macosBuild = readTrimmed("sw_vers", ["-buildVersion"]);
const xcodeVersionOutput = readTrimmed("xcodebuild", ["-version"]);
const xcodeVersionLine = xcodeVersionOutput.split("\n")[0] ?? "Xcode version unavailable";
const runtimesOutput = readTrimmed("xcrun", ["simctl", "list", "runtimes"]);

if (!/\biOS\s+\d+/m.test(runtimesOutput)) {
  fail(
    [
      "iOS simulator toolchain preflight failed.",
      `macOS: ${macosVersion} (${macosBuild})`,
      `Xcode: ${xcodeVersionLine}`,
      "No iOS simulator runtimes are currently registered via `xcrun simctl list runtimes`.",
    ].join("\n"),
  );
}

const tempRoot = mkdtempSync(join(tmpdir(), "qestro-ios-toolchain-"));
const outputDir = join(tempRoot, "asset-output");
mkdirSync(outputDir, { recursive: true });

const actoolArgs = [
  "actool",
  "--output-format",
  "human-readable-text",
  "--notices",
  "--warnings",
  "--export-dependency-info",
  join(tempRoot, "assetcatalog_dependencies"),
  "--output-partial-info-plist",
  join(tempRoot, "assetcatalog_generated_info.plist"),
  "--app-icon",
  "AppIcon",
  "--compress-pngs",
  "--enable-on-demand-resources",
  "YES",
  "--development-region",
  "en",
  "--target-device",
  "iphone",
  "--target-device",
  "ipad",
  "--minimum-deployment-target",
  "16.0",
  "--platform",
  "iphonesimulator",
  "--compile",
  outputDir,
  assetCatalogPath,
  "--bundle-identifier",
  "io.qestro.app",
];

const actoolResult = run("xcrun", actoolArgs);
const actoolOutput = `${actoolResult.stdout ?? ""}${actoolResult.stderr ?? ""}`.trim();

rmSync(tempRoot, { recursive: true, force: true });

if (actoolResult.status !== 0) {
  const lines = [
    "iOS simulator toolchain preflight failed.",
    `macOS: ${macosVersion} (${macosBuild})`,
    `Xcode: ${xcodeVersionLine}`,
    "The local Xcode/CoreSimulator stack could not compile the checked-in iOS asset catalog.",
  ];

  if (/AssetCatalogSimulatorAgent/.test(actoolOutput)) {
    lines.push("AssetCatalogSimulatorAgent crashed or exited before handshake.");
  }

  if (/^Xcode 16\./m.test(xcodeVersionOutput) && macosVersion.startsWith("26.")) {
    lines.push("Installed Xcode is older than the current macOS train on this host. Upgrade Xcode before running iOS or Maestro commands.");
  }

  if (actoolOutput) {
    lines.push("");
    lines.push(actoolOutput);
  }

  fail(lines.join("\n"), actoolResult.status ?? 1);
}

console.log(
  [
    "iOS simulator toolchain preflight passed.",
    `macOS: ${macosVersion} (${macosBuild})`,
    `Xcode: ${xcodeVersionLine}`,
  ].join("\n"),
);
