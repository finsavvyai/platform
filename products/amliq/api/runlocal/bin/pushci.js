#!/usr/bin/env node
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const VERSION = '0.3.0';
const BINARY_NAME = os.platform() === 'win32' ? 'pushci.exe' : 'pushci';

function getBinaryPath() {
  // Check if Go binary exists locally
  const local = path.join(__dirname, '..', BINARY_NAME);
  if (fs.existsSync(local)) return local;

  // Check PATH
  try {
    const which = os.platform() === 'win32' ? 'where' : 'which';
    return execSync(`${which} pushci`, { encoding: 'utf8' }).trim();
  } catch (_) {}

  // Download pre-built binary
  return downloadBinary();
}

function downloadBinary() {
  const platform = os.platform();
  const arch = os.arch();
  const ext = platform === 'win32' ? '.exe' : '';
  const target = path.join(os.tmpdir(), `pushci${ext}`);

  if (fs.existsSync(target)) return target;

  console.log('Downloading pushci binary...');
  const url = `https://github.com/finsavvyai/pushci/releases/download/v${VERSION}/pushci-${platform}-${arch}${ext}`;

  try {
    execSync(`curl -sL -o "${target}" "${url}"`);
    fs.chmodSync(target, 0o755);
    return target;
  } catch (_) {
    // Fallback: build from source if Go is available
    return buildFromSource();
  }
}

function buildFromSource() {
  console.log('Building pushci from source...');
  const src = path.join(__dirname, '..');
  const out = path.join(os.tmpdir(), BINARY_NAME);
  try {
    execSync(`go build -o "${out}" ./cmd/pushci`, { cwd: src });
    return out;
  } catch (_) {
    console.error('Error: Could not find or build pushci binary.');
    console.error('Install Go (https://go.dev) or download from GitHub.');
    process.exit(1);
  }
}

const binary = getBinaryPath();
const child = spawn(binary, process.argv.slice(2), { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code || 0));
