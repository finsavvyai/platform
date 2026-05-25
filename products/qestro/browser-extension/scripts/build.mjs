import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionRoot = path.resolve(__dirname, '..');
const distRoot = path.join(extensionRoot, 'dist');
const packageJson = JSON.parse(readFileSync(path.join(extensionRoot, 'package.json'), 'utf8'));
const baseManifest = JSON.parse(readFileSync(path.join(extensionRoot, 'manifest.json'), 'utf8'));

const browsers = [
  { name: 'chrome' },
  {
    name: 'firefox',
    extraManifest: {
      browser_specific_settings: {
        gecko: {
          id: 'questro-recorder@questro.io',
          strict_min_version: '121.0',
        },
      },
    },
  },
  { name: 'edge' },
];

function mergeManifest(browserName) {
  const browser = browsers.find((item) => item.name === browserName);
  return {
    ...baseManifest,
    version: packageJson.version,
    name: browserName === 'firefox' ? 'Questro Recorder (Firefox)' : baseManifest.name,
    ...browser?.extraManifest,
  };
}

function copyStaticAssets(targetDir) {
  cpSync(path.join(extensionRoot, 'src'), path.join(targetDir, 'src'), { recursive: true });

  for (const filename of ['README.md', 'version.json', 'api_compatibility.json', 'features.json']) {
    cpSync(path.join(extensionRoot, filename), path.join(targetDir, filename));
  }
}

function ensureZipAvailable() {
  try {
    execFileSync('zip', ['-v'], { stdio: 'ignore' });
  } catch (error) {
    throw new Error('The `zip` command is required to package browser-extension/dist artifacts.');
  }
}

function zipDirectory(sourceDir, zipPath) {
  if (existsSync(zipPath)) {
    rmSync(zipPath, { force: true });
  }

  execFileSync('zip', ['-qr', zipPath, '.'], {
    cwd: sourceDir,
    stdio: 'inherit',
  });
}

function buildBrowser(browserName) {
  const browserRoot = path.join(distRoot, browserName);
  const unpackedRoot = path.join(browserRoot, 'unpacked');
  const zipName = `questro-${browserName}-v${packageJson.version}.zip`;

  rmSync(browserRoot, { recursive: true, force: true });
  mkdirSync(unpackedRoot, { recursive: true });

  copyStaticAssets(unpackedRoot);
  writeFileSync(
    path.join(unpackedRoot, 'manifest.json'),
    JSON.stringify(mergeManifest(browserName), null, 2),
  );

  zipDirectory(unpackedRoot, path.join(browserRoot, zipName));
}

function main() {
  rmSync(distRoot, { recursive: true, force: true });
  mkdirSync(distRoot, { recursive: true });
  ensureZipAvailable();

  for (const browser of browsers) {
    buildBrowser(browser.name);
  }

  console.log(`Built Questro browser extension v${packageJson.version} for chrome, firefox, and edge.`);
}

main();
