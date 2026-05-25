import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionRoot = path.resolve(__dirname, '..');
const packageJson = JSON.parse(readFileSync(path.join(extensionRoot, 'package.json'), 'utf8'));

const requiredSourceFiles = [
  'manifest.json',
  'src/background.js',
  'src/content.js',
  'src/popup.html',
  'src/popup.js',
  'src/popup.css',
  'version.json',
  'api_compatibility.json',
  'features.json',
];

const browsers = ['chrome', 'firefox', 'edge'];

function assertExists(relativePath) {
  const absolutePath = path.join(extensionRoot, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
}

function main() {
  for (const relativePath of requiredSourceFiles) {
    assertExists(relativePath);
  }

  for (const browser of browsers) {
    assertExists(`dist/${browser}/unpacked/manifest.json`);
    assertExists(`dist/${browser}/unpacked/src/background.js`);
    assertExists(`dist/${browser}/unpacked/src/content.js`);
    assertExists(`dist/${browser}/unpacked/src/popup.html`);
    assertExists(`dist/${browser}/questro-${browser}-v${packageJson.version}.zip`);
  }

  console.log(`Browser extension health-check passed for version ${packageJson.version}.`);
}

main();
