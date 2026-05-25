#!/usr/bin/env node
const { execSync } = require("child_process");

const packages = [
  "lunaforge-core",
  "lunaforge-autopsy",
  "lunaforge-galaxy",
  "lunaforge-codeflow",
  "lunaforge-timetravel",
  "lunaforge-composer",
  "lunaforge-guardian",
  "lunaforge-prophecy",
  "lunaforge-ritual",
  "lunaforge-mythic",
  "lunaforge-parallel-universe",
  "lunaforge-dream"
];

for (const pkg of packages) {
  console.log(`\n📦 Building ${pkg}...`);
  execSync(`npm run build --workspace ${pkg}`, { stdio: "inherit" });
}
