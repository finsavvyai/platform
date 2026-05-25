#!/usr/bin/env node

/**
 * QueryFlux Extension Publisher
 * Bumps version, builds, and publishes extension to target directory
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  electronDir: path.join(__dirname, '../electron'),
  targetDir: '/Users/shaharsolomon/projects/extensions',
  packageJson: path.join(__dirname, '../electron/package.json')
};

/**
 * Extract version from package.json
 */
function getCurrentVersion() {
  const packageJson = JSON.parse(fs.readFileSync(CONFIG.packageJson, 'utf8'));
  return packageJson.version;
}

/**
 * Bump version based on type
 */
function bumpVersion(currentVersion, type = 'patch') {
  const [major, minor, patch] = currentVersion.split('.').map(Number);

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

/**
 * Update package.json with new version
 */
function updatePackageVersion(newVersion) {
  const packageJson = JSON.parse(fs.readFileSync(CONFIG.packageJson, 'utf8'));
  packageJson.version = newVersion;
  fs.writeFileSync(CONFIG.packageJson, JSON.stringify(packageJson, null, 2));
  console.log(`✓ Updated version to ${newVersion}`);
}

/**
 * Ensure target directory exists
 */
function ensureTargetDirectory() {
  if (!fs.existsSync(CONFIG.targetDir)) {
    fs.mkdirSync(CONFIG.targetDir, { recursive: true });
    console.log(`✓ Created target directory: ${CONFIG.targetDir}`);
  }
}

/**
 * Build the extension
 */
function buildExtension() {
  console.log('🔨 Building QueryFlux desktop extension...');

  try {
    // Change to electron directory
    process.chdir(CONFIG.electronDir);

    // Clean previous builds
    if (fs.existsSync('release')) {
      execSync('rm -rf release', { stdio: 'inherit' });
    }

    // Build the application
    execSync('npm run build', { stdio: 'inherit' });

    // Build distribution packages
    execSync('npm run dist:all', { stdio: 'inherit' });

    console.log('✓ Build completed successfully');
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

/**
 * Copy built files to target directory
 */
function copyToTargetDirectory(version) {
  const releaseDir = path.join(CONFIG.electronDir, 'release');
  const targetVersionDir = path.join(CONFIG.targetDir, `queryflux-desktop-v${version}`);

  // Create version-specific directory
  if (fs.existsSync(targetVersionDir)) {
    execSync(`rm -rf "${targetVersionDir}"`, { stdio: 'inherit' });
  }
  fs.mkdirSync(targetVersionDir, { recursive: true });

  // Copy all built files
  const files = fs.readdirSync(releaseDir);
  files.forEach(file => {
    const srcPath = path.join(releaseDir, file);
    const destPath = path.join(targetVersionDir, file);

    if (fs.statSync(srcPath).isDirectory()) {
      execSync(`cp -r "${srcPath}" "${destPath}"`, { stdio: 'inherit' });
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });

  // Create latest symlink
  const latestLink = path.join(CONFIG.targetDir, 'queryflux-desktop-latest');
  if (fs.existsSync(latestLink)) {
    execSync(`rm -f "${latestLink}"`, { stdio: 'inherit' });
  }
  execSync(`ln -s "queryflux-desktop-v${version}" "${latestLink}"`, { stdio: 'inherit' });

  console.log(`✓ Copied to target directory: ${targetVersionDir}`);
}

/**
 * Create release notes
 */
function createReleaseNotes(version, type) {
  const releaseNotes = `# QueryFlux Desktop v${version}

Release Date: ${new Date().toISOString().split('T')[0]}

## Changes
- Version bump (${type})

## Downloads
- queryflux-desktop-v${version}/
  - QueryFlux-${version}.dmg (macOS)
  - QueryFlux Setup ${version}.exe (Windows)
  - queryflux-desktop-${version}.AppImage (Linux)
  - queryflux-desktop_${version}_amd64.deb (Debian/Ubuntu)
  - queryflux-desktop-${version}-1.x86_64.rpm (RedHat/CentOS)

## Installation

### macOS
\`\`\`bash
# Mount the DMG and drag to Applications folder
open QueryFlux-${version}.dmg
\`\`\`

### Windows
\`\`\`bash
# Run the installer
"QueryFlux Setup ${version}.exe"
\`\`\`

### Linux
\`\`\`bash
# AppImage (Recommended)
chmod +x queryflux-desktop-${version}.AppImage
./queryflux-desktop-${version}.AppImage

# Debian/Ubuntu
sudo dpkg -i queryflux-desktop_${version}_amd64.deb

# RedHat/CentOS
sudo rpm -i queryflux-desktop-${version}-1.x86_64.rpm
\`\`\`

## Features
- Secure database connections with OS keychain integration
- Support for 8+ database types (PostgreSQL, MySQL, MongoDB, Redis, SQLite, Cassandra, Oracle, SQL Server)
- Advanced query editor with syntax highlighting and autocomplete
- AI-powered query suggestions and optimization
- Real-time collaboration and sharing
- Export to multiple formats (CSV, JSON, Excel, PDF)
- Voice commands for hands-free operation
- Custom themes and personalization
- Enterprise security features (SSO, team management)
- Subscription management with LemonSqueezy integration

## Security
- End-to-end encryption for sensitive data
- OS keychain storage for credentials
- SQL injection prevention
- Role-based access control
- Audit logging

## Support
- Documentation: https://docs.queryflux.com
- Issues: https://github.com/queryflux/queryflux/issues
- Support: support@queryflux.com
`;

  const releaseNotesPath = path.join(CONFIG.targetDir, `queryflux-desktop-v${version}`, 'RELEASE.md`);
  fs.writeFileSync(releaseNotesPath, releaseNotes);
  console.log(`✓ Created release notes: ${releaseNotesPath}`);
}

/**
 * Create checksums for all files
 */
function createChecksums(version) {
  const targetVersionDir = path.join(CONFIG.targetDir, `queryflux-desktop-v${version}`);
  const crypto = require('crypto');
  const checksums = [];

  function calculateChecksum(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  }

  function processDirectory(dir, relativePath = '') {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const filePath = path.join(dir, file);
      const relativeFilePath = path.join(relativePath, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        processDirectory(filePath, relativeFilePath);
      } else if (file !== 'SHA256SUMS' && file !== 'RELEASE.md') {
        const checksum = calculateChecksum(filePath);
        checksums.push(`${checksum}  ${relativeFilePath}`);
      }
    });
  }

  processDirectory(targetVersionDir);

  const checksumsPath = path.join(targetVersionDir, 'SHA256SUMS');
  fs.writeFileSync(checksumsPath, checksums.join('\n'));
  console.log(`✓ Created checksums: ${checksumsPath}`);
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 QueryFlux Extension Publisher\n');

  // Get version bump type from command line argument
  const versionType = process.argv[2] || 'patch';
  if (!['major', 'minor', 'patch'].includes(versionType)) {
    console.error('❌ Invalid version type. Use: major, minor, or patch');
    process.exit(1);
  }

  try {
    // Get current version
    const currentVersion = getCurrentVersion();
    console.log(`Current version: ${currentVersion}`);

    // Bump version
    const newVersion = bumpVersion(currentVersion, versionType);
    console.log(`New version: ${newVersion} (${versionType} bump)`);

    // Update package.json
    updatePackageVersion(newVersion);

    // Ensure target directory exists
    ensureTargetDirectory();

    // Build the extension
    buildExtension();

    // Copy to target directory
    copyToTargetDirectory(newVersion);

    // Create release notes
    createReleaseNotes(newVersion, versionType);

    // Create checksums
    createChecksums(newVersion);

    // Commit and tag if git repo
    try {
      execSync(`git add package.json`, { stdio: 'inherit' });
      execSync(`git commit -m "chore: bump version to ${newVersion}"`, { stdio: 'inherit' });
      execSync(`git tag v${newVersion}`, { stdio: 'inherit' });
      console.log(`✓ Created git tag v${newVersion}`);
    } catch (error) {
      console.log('⚠️  Git operations skipped (not a git repo or no changes)');
    }

    console.log(`\n🎉 Successfully published QueryFlux Desktop v${newVersion}!`);
    console.log(`📁 Location: ${path.join(CONFIG.targetDir, `queryflux-desktop-v${version}`)}`);
    console.log(`🔗 Latest: ${path.join(CONFIG.targetDir, 'queryflux-desktop-latest')}`);

  } catch (error) {
    console.error('❌ Publishing failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, bumpVersion, getCurrentVersion };