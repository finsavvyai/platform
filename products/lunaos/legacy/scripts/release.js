#!/usr/bin/env node
const { execSync } = require("child_process");

const version = process.argv[2];
if (!version) {
  console.error("Usage: npm run release <version>");
  process.exit(1);
}

execSync(`git tag v${version}`);
execSync(`git push origin v${version}`);

console.log(`🚀 Released version v${version}`);