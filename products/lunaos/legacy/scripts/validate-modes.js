#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const rootPkgPath = path.join(root, "package.json");

if (!fs.existsSync(rootPkgPath)) {
  console.error("❌ Cannot find root package.json");
  process.exit(1);
}

const rootPkg = require(rootPkgPath);

console.log("\n🔍 Validating LunaForge Modes...\n");

// we only care about packages/* that start with lunaforge-
const packagesDir = path.join(root, "packages");
const allPackages = fs.existsSync(packagesDir)
  ? fs.readdirSync(packagesDir)
  : [];

const modePackages = allPackages.filter((name) =>
  name.startsWith("lunaforge-")
);

// ignore core + worker packages – they are infrastructure, not modes
const ignore = new Set([
  "lunaforge-core",
  "lunaforge-worker",
  "lunaforge-agent-brain-worker",
  "lunaforge-extension" 
]);

function loadSource(pkgName) {
  const pkgDir = path.join(packagesDir, pkgName);

  const visited = new Set();

  function loadFile(relPath) {
    const fullPath = path.join(pkgDir, "src", relPath);
    if (!fs.existsSync(fullPath) || visited.has(fullPath)) return "";

    visited.add(fullPath);
    let src = fs.readFileSync(fullPath, "utf8");

    // Find "export * from './xxx'"
    const exportMatches = [...src.matchAll(/export\s*\*\s*from\s*["'](.+)["']/g)];

    for (const m of exportMatches) {
      const target = m[1] + ".ts";
      src += "\n" + loadFile(target);
    }

    return src;
  }

  // always start from index.ts
  return loadFile("index.ts");
}

function checkMode(pkgName) {
  if (ignore.has(pkgName)) return;

  console.log(`📦 Checking mode: ${pkgName}`);

  const src = loadSource(pkgName);
  if (!src) {
    console.log(`❌ [${pkgName}] Could not read src/dist index file`);
    console.log("");
    return;
  }

  const errors = [];
  const ok = (msg) => console.log(`✔ [${pkgName}] ${msg} ✓`);
  const fail = (msg) => {
    console.log(`❌ [${pkgName}] ${msg}`);
    errors.push(msg);
  };

  // very simple structural checks on the returned object literal

  // 1) basic metadata
  if (!/id:\s*["'`][^"'`]+["'`]/.test(src)) {
    fail("Missing required field in mode: id");
  }
  if (!/title:\s*["'`][^"'`]+["'`]/.test(src)) {
    fail("Missing required field in mode: title");
  }
  if (!/description:\s*["'`][^"'`]+["'`]/.test(src)) {
    fail("Missing required field in mode: description");
  }

  // 2) activate: now we only require that there is a method named activate
  //    either as `activate(ctx` or `activate: (ctx`
  if (!/activate\s*\(\s*ctx/.test(src) && !/activate\s*:\s*\(\s*ctx/.test(src)) {
    fail("Missing required field in mode: activate");
  }

  // 3) requiredFeature
  if (/requiredFeature\s*:/.test(src)) {
    ok("requiredFeature");
  } else {
    fail("Missing requiredFeature");
  }

  // 4) ensureLicense call inside activate body
  if (/ensureLicense\s*\(\s*ctx\s*,\s*["'`][^"'`]+["'`]\s*\)/.test(src)) {
    ok("ensureLicense()");
  } else {
    fail("Missing ensureLicense() call");
  }

  // 5) import ensureLicense from lunaforge-core
// 4) ensureLicense is imported from lunaforge-core
const hasEnsureImport =
  /import\s*{[^}]*ensureLicense[^}]*}\s*from\s*["']lunaforge-core["']/.test(src);

if (hasEnsureImport) {
  ok("Import ensureLicense from lunaforge-core");
} else {
  fail("Missing import of ensureLicense from lunaforge-core");
}

  if (errors.length === 0) {
    console.log(`✅ [${pkgName}] Passed structural validation\n`);
  } else {
    console.log("");
  }
}

modePackages.forEach(checkMode);

// root sanity
console.log("📘 Validating root package.json...");
if (Array.isArray(rootPkg.workspaces) && rootPkg.scripts && rootPkg.scripts.build) {
  console.log("✔ Root workspaces ✓");
  console.log("✔ Root build script ✓");
} else {
  console.log("❌ Root workspaces / build script look suspicious");
}

console.log("\n✨ Validation complete.\n");