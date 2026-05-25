#!/usr/bin/env node
const { spawn } = require("child_process");

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
  console.log(`👀 Watching ${pkg}...`);
  spawn("npm", ["run", "watch", "--workspace", pkg], {
    stdio: "inherit",
  });
}
