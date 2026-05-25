#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const packagesDir = path.join(process.cwd(), "packages");
const coreTypes = fs.readFileSync(
  path.join(packagesDir, "lunaforge-core", "src", "types.ts"),
  "utf8"
);

const modeIdRegex = /id:\s*"([^"]+)"/g;

const allFoundIds = new Set();
const definedIds = new Set(
  (coreTypes.match(/"(.*?)"/g) || [])
    .map((v) => v.replace(/"/g, ""))
);

fs.readdirSync(packagesDir).forEach((pkg) => {
  const indexPath = path.join(packagesDir, pkg, "src", "index.ts");
  if (!fs.existsSync(indexPath)) return;

  const src = fs.readFileSync(indexPath, "utf8");

  let m;
  while ((m = modeIdRegex.exec(src))) {
    allFoundIds.add(m[1]);
  }
});

console.log("📦 Mode IDs found:", [...allFoundIds]);
console.log("🧠 Mode IDs defined in core:", [...definedIds]);

const missing = [...allFoundIds].filter((x) => !definedIds.has(x));

if (missing.length > 0) {
  console.error("❌ Missing ModeIds in core:", missing);
  process.exit(1);
} else {
  console.log("✅ All mode IDs are valid");
}
