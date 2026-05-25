#!/usr/bin/env node
// pushci npm shim.
//
// Resolution order for the Go binary:
//   0. PUSHCI_BINARY env var — explicit user override (offline
//      sandboxes, air-gapped CI, corporate proxies)
//   1. Local dev build at <pkg>/pushci (for pnpm link and goreleaser
//      snapshot runs during development)
//   2. Bundled platform binary shipped in the npm tarball at
//      bin/pushci-<os>-<arch>[.exe] — the canonical prod path
//   3. Existing pushci on PATH (Homebrew, go install, curl installer)
//   4. Download from GitHub Releases into os.tmpdir()
//   5. `go build` from source if Go is installed
//   6. Last resort: print install help with offline guidance
//
// VERSION reads from package.json so the shim never drifts from the
// npm package version. See CLAUDE.md "Release & Distribution" for
// the full pipeline.

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const pkg = require('../package.json');
const VERSION = pkg.version;
// Public release distribution repo — binaries for brew/curl/shim
// fallback live here. The product source is in a private repo;
// this public one holds only the shim + release tarballs so
// unauthenticated install paths actually work.
const REPO = 'finsavvyai/pushci-cli';
// Go install is not supported with a private source repo. The
// Go module line below is retained for historical context but
// no code path uses it anymore. Users who want a Go build must
// contact hello@pushci.dev for commercial licensing.
const GO_MODULE = 'github.com/finsavvyai/pushci-cli (binaries only)';

const BINARY_NAME = os.platform() === 'win32' ? 'pushci.exe' : 'pushci';
const PLATFORM_MAP = { darwin: 'darwin', linux: 'linux', win32: 'windows' };
const ARCH_MAP = { x64: 'amd64', arm64: 'arm64' };

// Early short-circuit: `pushci version` / `--version` / `-v` should
// never trigger a 60s binary download. If we have a resolvable
// binary we delegate to it for the full version string (which
// includes the Go build ldflags); otherwise we print just the npm
// shim's VERSION and exit. Fixes the sandbox UX where asking for
// the version used to hang installing the binary.
function handleVersionShortCircuit() {
  const first = process.argv[2];
  if (first !== 'version' && first !== '--version' && first !== '-v') {
    return false;
  }
  const binary = tryResolveBinary();
  if (binary) {
    const child = spawn(binary, [first], { stdio: 'inherit' });
    child.on('error', () => printShimVersion());
    child.on('exit', (code) => process.exit(code || 0));
    return true;
  }
  printShimVersion();
  return true;
}

function printShimVersion() {
  console.log(`pushci ${VERSION} (npm shim — no binary installed)`);
  console.log('Install the native binary with:');
  console.log(`  brew install finsavvyai/tap/pushci   # macOS / Linux`);
  console.log(`  go install ${GO_MODULE}@latest        # anywhere with Go`);
  process.exit(0);
}

// tryResolveBinary is the non-download portion of getBinaryPath —
// used by the version short-circuit so we never kick off a network
// fetch just to print a version string.
function tryResolveBinary() {
  if (process.env.PUSHCI_BINARY) {
    const override = process.env.PUSHCI_BINARY;
    if (fs.existsSync(override) && isValidBinary(override)) return override;
  }
  const local = path.join(__dirname, '..', BINARY_NAME);
  if (fs.existsSync(local) && isValidBinary(local)) return local;

  const plat = PLATFORM_MAP[os.platform()];
  const arch = ARCH_MAP[os.arch()];
  if (plat && arch) {
    const winExt = os.platform() === 'win32' ? '.exe' : '';
    const bundled = path.join(__dirname, `pushci-${plat}-${arch}${winExt}`);
    if (fs.existsSync(bundled) && isValidBinary(bundled)) return bundled;
  }

  try {
    const cmd = os.platform() === 'win32' ? 'where' : 'which';
    const found = execSync(`${cmd} pushci`, { encoding: 'utf8' }).trim();
    if (found && found !== __filename && isValidBinary(found)) return found;
  } catch (_) {}

  return null;
}

function getBinaryPath() {
  const resolved = tryResolveBinary();
  if (resolved) return resolved;
  return downloadOrBuild();
}

function downloadOrBuild() {
  const plat = PLATFORM_MAP[os.platform()];
  const arch = ARCH_MAP[os.arch()];
  const ext = os.platform() === 'win32' ? '.exe' : '';
  const target = path.join(os.tmpdir(), `pushci-${VERSION}${ext}`);

  if (fs.existsSync(target) && isValidBinary(target)) return target;
  if (plat && arch && downloadFromReleases(plat, arch, target)) return target;
  if (buildFromSource(target)) return target;

  // If invoked from a git hook, warn visibly then let the push
  // through. Earlier versions exited 0 with a one-liner that was
  // easy to miss — users got the false impression that the
  // pre-push hook had actually run their checks. Now we print a
  // loud multi-line warning so the miss is obvious.
  if (process.env.GIT_DIR) {
    console.error('');
    console.error('  ⚠ pushci: BINARY UNAVAILABLE — pre-push checks SKIPPED');
    console.error('  ⚠ This push is going through without running any CI.');
    console.error('  ⚠ Fix: re-run `npm i -g pushci` OR set PUSHCI_BINARY=<path>');
    console.error('  ⚠ Silence: export PUSHCI_SKIP_HOOK=1');
    console.error('');
    process.exit(0);
  }
  printInstallHelp();
  process.exit(1);
}

// downloadFromReleases pulls the goreleaser archive from GitHub
// Releases, extracts the binary, and moves it into place. Returns
// true on success, false on any failure so the caller can fall
// through to buildFromSource.
function downloadFromReleases(plat, arch, target) {
  const isWin = os.platform() === 'win32';
  const archiveExt = isWin ? 'zip' : 'tar.gz';
  const archiveName = `pushci_${VERSION}_${plat}_${arch}.${archiveExt}`;
  const url = `https://github.com/${REPO}/releases/download/v${VERSION}/${archiveName}`;
  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pushci-install-'));
  const archivePath = path.join(scratchDir, archiveName);

  console.log(`Downloading pushci v${VERSION} from GitHub Releases...`);
  try {
    execSync(`curl -sfL --retry 2 --retry-delay 1 -o "${archivePath}" "${url}"`,
      { timeout: 60000 });
  } catch (_) {
    fs.rmSync(scratchDir, { recursive: true, force: true });
    return false;
  }
  try {
    execSync(`tar -${isWin ? 'x' : 'xz'}f "${archivePath}" -C "${scratchDir}"`,
      { timeout: 30000 });
    const extracted = path.join(scratchDir, BINARY_NAME);
    if (!fs.existsSync(extracted) || !isValidBinary(extracted)) {
      fs.rmSync(scratchDir, { recursive: true, force: true });
      return false;
    }
    fs.copyFileSync(extracted, target);
    if (!isWin) fs.chmodSync(target, 0o755);
    fs.rmSync(scratchDir, { recursive: true, force: true });
    return true;
  } catch (_) {
    fs.rmSync(scratchDir, { recursive: true, force: true });
    return false;
  }
}

// buildFromSource is the Go-install fallback. Only runs when
// download fails AND the user has Go on PATH. Useful for
// air-gapped dev setups.
function buildFromSource(target) {
  try {
    execSync('go version', { stdio: 'ignore' });
  } catch (_) {
    return false;
  }
  console.log('Downloading failed, building pushci from source...');
  try {
    execSync(`go build -o "${target}" ./cmd/pushci`, {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      timeout: 180000,
    });
    return fs.existsSync(target) && isValidBinary(target);
  } catch (_) {
    return false;
  }
}

// isValidBinary sanity-checks the magic bytes so a half-downloaded
// archive doesn't pass for a real binary.
function isValidBinary(filepath) {
  try {
    const stat = fs.statSync(filepath);
    if (stat.size < 1024) return false;
    const buf = Buffer.alloc(4);
    const fd = fs.openSync(filepath, 'r');
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    if (buf[0] === 0x7f && buf[1] === 0x45) return true; // ELF
    if (buf[0] === 0xcf && buf[1] === 0xfa) return true; // Mach-O 64-bit LE
    if (buf[0] === 0xfe && buf[1] === 0xed) return true; // Mach-O 32-bit BE
    if (buf[0] === 0x4d && buf[1] === 0x5a) return true; // PE (MZ)
    return false;
  } catch (_) {
    return false;
  }
}

function printInstallHelp() {
  console.error('');
  console.error('pushci: could not locate a working binary.');
  console.error('');
  console.error('Online install paths:');
  console.error('  npm install -g pushci              # bundled binaries, always works');
  console.error('  brew install finsavvyai/tap/pushci # macOS + Linux');
  console.error('  curl -fsSL https://pushci.dev/install.sh | sh');
  console.error('');
  console.error('Offline / sandbox / air-gapped path:');
  console.error('  1. Download the tarball for your platform from:');
  console.error(`     https://github.com/${REPO}/releases/tag/v${VERSION}`);
  console.error('  2. Extract it: tar -xzf pushci_<version>_<os>_<arch>.tar.gz');
  console.error('  3. Point the shim at the extracted binary:');
  console.error('     export PUSHCI_BINARY=/path/to/pushci');
  console.error('');
  console.error('Commercial licensing / enterprise / source access:');
  console.error('  hello@pushci.dev');
  console.error('');
  console.error("Don't have Node installed?");
  console.error('  macOS:   brew install node');
  console.error('  Linux:   https://nodejs.org/en/download/package-manager');
  console.error('  Windows: https://nodejs.org');
}

function main() {
  if (handleVersionShortCircuit()) return;
  const binary = getBinaryPath();
  const child = spawn(binary, process.argv.slice(2), { stdio: 'inherit' });
  child.on('error', (err) => {
    console.error(`pushci: failed to start — ${err.message}`);
    printInstallHelp();
    process.exit(1);
  });
  child.on('exit', (code) => process.exit(code || 0));
}

main();
