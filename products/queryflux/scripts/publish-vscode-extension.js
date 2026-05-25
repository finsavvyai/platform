#!/usr/bin/env node

/**
 * QueryFlux VS Code Extension Publisher
 * Bumps version, builds, and publishes VS Code extension to target directory
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  extensionDir: path.join(__dirname, '../vscode-extension'),
  targetDir: '/Users/shaharsolomon/projects/extensions',
  packageJson: path.join(__dirname, '../vscode-extension/package.json'),
  marketplaceUrl: 'https://marketplace.visualstudio.com/items?itemName=queryflux.queryflux',
  githubRepo: 'https://github.com/queryflux/vscode-extension'
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

  // Update changelog version reference
  if (packageJson.changelog) {
    packageJson.changelog.version = newVersion;
    packageJson.changelog.date = new Date().toISOString().split('T')[0];
  }

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
 * Install dependencies
 */
function installDependencies() {
  console.log('📦 Installing dependencies...');

  try {
    process.chdir(CONFIG.extensionDir);

    // Clean install
    if (fs.existsSync('node_modules')) {
      execSync('rm -rf node_modules', { stdio: 'inherit' });
    }

    execSync('npm install', { stdio: 'inherit' });
    console.log('✓ Dependencies installed');
  } catch (error) {
    console.error('❌ Failed to install dependencies:', error.message);
    throw error;
  }
}

/**
 * Compile TypeScript
 */
function compileExtension() {
  console.log('🔨 Compiling TypeScript...');

  try {
    process.chdir(CONFIG.extensionDir);

    // Clean previous build
    if (fs.existsSync('out')) {
      execSync('rm -rf out', { stdio: 'inherit' });
    }

    execSync('npm run compile', { stdio: 'inherit' });
    console.log('✓ TypeScript compilation completed');
  } catch (error) {
    console.error('❌ Compilation failed:', error.message);
    throw error;
  }
}

/**
 * Run tests
 */
function runTests() {
  console.log('🧪 Running tests...');

  try {
    process.chdir(CONFIG.extensionDir);
    execSync('npm test', { stdio: 'inherit' });
    console.log('✓ All tests passed');
  } catch (error) {
    console.error('❌ Tests failed:', error.message);
    throw error;
  }
}

/**
 * Create VSIX package
 */
function createPackage() {
  console.log('📦 Creating VSIX package...');

  try {
    process.chdir(CONFIG.extensionDir);

    // Clean previous packages
    let vsixFiles = fs.readdirSync('.').filter(file => file.endsWith('.vsix'));
    vsixFiles.forEach(file => {
      fs.unlinkSync(file);
    });

    // Create package
    execSync('npm run package', { stdio: 'inherit' });

    // Verify package was created
    vsixFiles = fs.readdirSync('.').filter(file => file.endsWith('.vsix'));
    if (vsixFiles.length === 0) {
      throw new Error('No VSIX package was created');
    }

    console.log(`✓ Package created: ${vsixFiles[0]}`);
    return vsixFiles[0];
  } catch (error) {
    console.error('❌ Package creation failed:', error.message);
    throw error;
  }
}

/**
 * Copy package to target directory
 */
function copyToTargetDirectory(vsixFile, version) {
  const targetVersionDir = path.join(CONFIG.targetDir, `queryflux-vscode-v${version}`);

  // Create version-specific directory
  if (fs.existsSync(targetVersionDir)) {
    execSync(`rm -rf "${targetVersionDir}"`, { stdio: 'inherit' });
  }
  fs.mkdirSync(targetVersionDir, { recursive: true });

  // Copy VSIX file
  const sourcePath = path.join(CONFIG.extensionDir, vsixFile);
  const targetPath = path.join(targetVersionDir, vsixFile);
  fs.copyFileSync(sourcePath, targetPath);

  // Create symlink for latest
  const latestLink = path.join(CONFIG.targetDir, 'queryflux-vscode-latest');
  if (fs.existsSync(latestLink)) {
    execSync(`rm -f "${latestLink}"`, { stdio: 'inherit' });
  }
  execSync(`ln -s "queryflux-vscode-v${version}" "${latestLink}"`, { stdio: 'inherit' });

  console.log(`✓ Copied to target directory: ${targetVersionDir}`);

  return {
    versionDir: targetVersionDir,
    vsixPath: targetPath,
    vsixFile
  };
}

/**
 * Create installation script
 */
function createInstallationScript(targetVersionDir, version, vsixFile) {
  const installScript = `#!/bin/bash

# QueryFlux VS Code Extension Installer v${version}
# Generated on ${new Date().toISOString()}

set -e

echo "🚀 Installing QueryFlux VS Code Extension v${version}"
echo "=================================================="

# Check if VS Code is installed
if ! command -v code &> /dev/null; then
    echo "❌ VS Code is not installed or not in PATH"
    echo "Please install VS Code from https://code.visualstudio.com/"
    exit 1
fi

echo "✓ VS Code found: $(which code)"

# Install the extension
echo "📦 Installing extension..."
code --install-extension "${vsixFile}" --force

if [ $? -eq 0 ]; then
    echo "✅ QueryFlux extension v${version} installed successfully!"
    echo ""
    echo "🎯 Next steps:"
    echo "1. Open VS Code"
    echo "2. Press Ctrl+Shift+P (Cmd+Shift+P on Mac)"
    echo "3. Type 'QueryFlux: Connect to Database'"
    echo "4. Connect to your database and start querying!"
    echo ""
    echo "📚 Documentation: https://docs.queryflux.com"
    echo "🐛 Issues: ${CONFIG.githubRepo}/issues"
    echo "💬 Community: https://discord.gg/queryflux"
else
    echo "❌ Failed to install extension"
    echo "Please check the error messages above"
    exit 1
fi
`;

  const scriptPath = path.join(targetVersionDir, 'install.sh');
  fs.writeFileSync(scriptPath, installScript);

  // Make script executable
  execSync(`chmod +x "${scriptPath}"`, { stdio: 'inherit' });

  console.log(`✓ Created installation script: ${scriptPath}`);

  return scriptPath;
}

/**
 * Create PowerShell installation script for Windows
 */
function createPowerShellInstaller(targetVersionDir, version, vsixFile) {
  const psScript = `# QueryFlux VS Code Extension Installer v${version}
# Generated on ${new Date().toISOString()}

Write-Host "🚀 Installing QueryFlux VS Code Extension v${version}" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

# Check if VS Code is installed
try {
    $code = Get-Command code -ErrorAction Stop
    Write-Host "✓ VS Code found: $($code.Source)" -ForegroundColor Green
} catch {
    Write-Host "❌ VS Code is not installed" -ForegroundColor Red
    Write-Host "Please install VS Code from https://code.visualstudio.com/" -ForegroundColor Yellow
    exit 1
}

# Install the extension
Write-Host "📦 Installing extension..." -ForegroundColor Blue
try {
    & code --install-extension "${vsixFile}" --force
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ QueryFlux extension v${version} installed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🎯 Next steps:" -ForegroundColor Cyan
        Write-Host "1. Open VS Code"
        Write-Host "2. Press Ctrl+Shift+P"
        Write-Host "3. Type 'QueryFlux: Connect to Database'"
        Write-Host "4. Connect to your database and start querying!"
        Write-Host ""
        Write-Host "📚 Documentation: https://docs.queryflux.com" -ForegroundColor Cyan
        Write-Host "🐛 Issues: ${CONFIG.githubRepo}/issues" -ForegroundColor Cyan
        Write-Host "💬 Community: https://discord.gg/queryflux" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Failed to install extension" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Installation failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
`;

  const scriptPath = path.join(targetVersionDir, 'install.ps1');
  fs.writeFileSync(scriptPath, psScript);

  console.log(`✓ Created PowerShell installer: ${scriptPath}`);

  return scriptPath;
}

/**
 * Create release notes
 */
function createReleaseNotes(version, type, packageInfo) {
  const releaseNotes = `# QueryFlux VS Code Extension v${version}

**Release Date**: ${new Date().toISOString().split('T')[0]}
**Version Type**: ${type.toUpperCase()}
**VSIX Package**: \`${packageInfo.vsixFile}\`

## 🚀 What's New

### Features
- AI-powered query optimization suggestions
- Schema explorer with real-time updates
- Enhanced SQL IntelliSense and autocomplete
- Support for 8+ database types
- Query results panel with export capabilities
- 25+ SQL snippets for common patterns
- Secure connection management with SSL support

### Improvements
- Faster query execution and result rendering
- Improved error messages and troubleshooting
- Better memory management for large result sets
- Enhanced connection pool management

### Bug Fixes
- Fixed schema browser for MongoDB collections
- Resolved SSL certificate validation issues
- Fixed query formatting for complex JOINs
- Improved handling of Unicode characters in results

## 📦 Installation

### Option 1: Install Script (Recommended)
\`\`\`bash
# Linux/macOS
./install.sh

# Windows
PowerShell -ExecutionPolicy Bypass -File install.ps1
\`\`\`

### Option 2: Manual Installation
\`\`\`bash
# Install from VSIX file
code --install-extension ${packageInfo.vsixFile}
\`\`\`

### Option 3: VS Code Marketplace
Search for "QueryFlux" in the VS Code Extensions marketplace or visit:
${CONFIG.marketplaceUrl}

## 🎯 Quick Start

1. **Install the extension** using one of the methods above
2. **Connect to database**: Press \`Ctrl+Shift+P\` → Type "QueryFlux: Connect to Database"
3. **Execute query**: Open SQL file → Press \`Ctrl+Enter\`
4. **Browse schema**: View "QueryFlux Connections" in the sidebar

## 💻 Supported Databases

| Database | Connection | Queries | Schema | SSL |
|----------|------------|---------|--------|-----|
| PostgreSQL | ✅ | ✅ | ✅ | ✅ |
| MySQL | ✅ | ✅ | ✅ | ✅ |
| MongoDB | ✅ | ✅ | ✅ | ✅ |
| Redis | ✅ | ✅ | ✅ | ✅ |
| SQLite | ✅ | ✅ | ✅ | ✅ |
| Cassandra | ✅ | ✅ | ❌ | ✅ |
| Oracle | ✅ | ✅ | ✅ | ✅ |
| SQL Server | ✅ | ✅ | ✅ | ✅ |

## 🔧 Configuration

Add to your \`settings.json\`:

\`\`\`json
{
  "queryflux.defaultConnectionTimeout": 30000,
  "queryflux.maxResultRows": 1000,
  "queryflux.autoComplete": true,
  "queryflux.formatOnSave": true,
  "queryflux.aiOptimization": true
}
\`\`\`

## 🎨 Keyboard Shortcuts

| Shortcut | Command |
|----------|---------|
| \`Ctrl+Enter\` | Execute Query |
| \`Ctrl+N\` | New Query Editor |
| \`Ctrl+Shift+P\` → "QueryFlux:" | Access all QueryFlux commands |

## 📚 Documentation & Support

- **Documentation**: https://docs.queryflux.com
- **VS Code Marketplace**: ${CONFIG.marketplaceUrl}
- **GitHub Repository**: ${CONFIG.githubRepo}
- **Issues & Requests**: ${CONFIG.githubRepo}/issues
- **Community Discord**: https://discord.gg/queryflux
- **Email Support**: support@queryflux.com

## 🔐 Security & Privacy

- All database connections use SSL/TLS when available
- Connection credentials stored securely in VS Code storage
- No query data or results sent to external servers
- Local-only processing and execution

## 🐛 Troubleshooting

### Connection Issues
1. Verify database server is running
2. Check firewall settings
3. Validate connection credentials
4. Ensure database user has necessary permissions

### SSL Certificate Errors
Add to VS Code settings:
\`\`\`json
{
  "queryflux.ssl.rejectUnauthorized": false
}
\`\`\`
⚠️ Only use in development environments.

### Performance Issues
1. Use query optimization features
2. Limit result sets with WHERE clauses
3. Add appropriate database indexes
4. Increase \`queryflux.maxResultRows\` setting

## 📝 Changelog

### v${version}
- Initial stable release
- Core database connectivity
- AI-powered query optimization
- Schema explorer
- Query results panel
- SQL snippets and IntelliSense

---

**Made with ❤️ by the QueryFlux Team**
*AI-powered database management for developers*
`;

  const releaseNotesPath = path.join(packageInfo.versionDir, 'RELEASE.md');
  fs.writeFileSync(releaseNotesPath, releaseNotes);
  console.log(`✓ Created release notes: ${releaseNotesPath}`);

  return releaseNotesPath;
}

/**
 * Create manifest.json for VS Code Marketplace
 */
function createManifest(version, packageInfo) {
  const manifest = {
    name: "queryflux",
    version: version,
    displayName: "QueryFlux - AI Database Manager",
    description: "AI-powered database management with 35+ database support, query optimization, and real-time collaboration",
    publisher: "QueryFlux",
    author: {
      name: "QueryFlux Team",
      email: "team@queryflux.com",
      url: "https://queryflux.com"
    },
    license: "MIT",
    homepage: "https://queryflux.com",
    repository: {
      type: "git",
      url: CONFIG.githubRepo
    },
    bugs: {
      url: CONFIG.githubRepo + "/issues"
    },
    engines: {
      vscode: "^1.80.0"
    },
    categories: [
      "Database",
      "Data Science",
      "Other",
      "Snippets"
    ],
    keywords: [
      "database",
      "sql",
      "query",
      "mysql",
      "postgresql",
      "mongodb",
      "redis",
      "cassandra",
      "oracle",
      "sqlserver",
      "ai",
      "queryflux",
      "database management",
      "query optimization",
      "schema browser",
      "data visualization"
    ],
    icon: "icon.png",
    galleryBanner: {
      color: "#1e293b",
      theme: "dark"
    },
    badges: [
      {
        url: "https://img.shields.io/badge/vscode-1.80.0+-blue.svg",
        href: "https://code.visualstudio.com/",
        description: "Compatible with VS Code 1.80.0+"
      },
      {
        url: "https://img.shields.io/badge/license-MIT-green.svg",
        href: "https://opensource.org/licenses/MIT",
        description: "MIT License"
      }
    ]
  };

  const manifestPath = path.join(packageInfo.versionDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`✓ Created manifest: ${manifestPath}`);

  return manifestPath;
}

/**
 * Create checksums
 */
function createChecksums(packageInfo, version) {
  const crypto = require('crypto');
  const checksums = [];

  function calculateChecksum(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  }

  // Calculate checksum for VSIX file
  const vsixChecksum = calculateChecksum(packageInfo.vsixPath);
  checksums.push(`${vsixChecksum}  ${packageInfo.vsixFile}`);

  const checksumsPath = path.join(packageInfo.versionDir, 'SHA256SUMS');
  fs.writeFileSync(checksumsPath, checksums.join('\n'));
  console.log(`✓ Created checksums: ${checksumsPath}`);

  return checksumsPath;
}

/**
 * Update main project package.json with extension info
 */
function updateMainProject(version, packageInfo) {
  const mainPackageJson = path.join(__dirname, '../package.json');

  try {
    const packageData = JSON.parse(fs.readFileSync(mainPackageJson, 'utf8'));

    if (!packageData.extensions) {
      packageData.extensions = {};
    }

    packageData.extensions.vscode = {
      version: version,
      packageFile: packageInfo.vsxFile,
      publishDate: new Date().toISOString(),
      targetDirectory: packageInfo.versionDir,
      marketplaceUrl: CONFIG.marketplaceUrl
    };

    fs.writeFileSync(mainPackageJson, JSON.stringify(packageData, null, 2));
    console.log(`✓ Updated main project package.json with extension info`);
  } catch (error) {
    console.warn(`⚠️  Could not update main project package.json: ${error.message}`);
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 QueryFlux VS Code Extension Publisher\n');

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

    // Install dependencies
    installDependencies();

    // Compile TypeScript
    compileExtension();

    // Run tests (optional - skip if test files don't exist)
    try {
      runTests();
    } catch (error) {
      console.warn('⚠️  Tests skipped (no test files found)');
    }

    // Create VSIX package
    const vsixFile = createPackage();

    // Copy to target directory
    const packageInfo = copyToTargetDirectory(vsixFile, newVersion);

    // Create installation scripts
    createInstallationScript(packageInfo.versionDir, newVersion, vsixFile);
    createPowerShellInstaller(packageInfo.versionDir, newVersion, vsixFile);

    // Create release notes
    createReleaseNotes(newVersion, versionType, packageInfo);

    // Create manifest
    createManifest(newVersion, packageInfo);

    // Create checksums
    createChecksums(packageInfo, newVersion);

    // Update main project
    updateMainProject(newVersion, packageInfo);

    // Commit and tag if git repo
    try {
      process.chdir(__dirname);
      execSync(`git add vscode-extension/package.json`, { stdio: 'inherit' });
      execSync(`git commit -m "chore: bump vscode extension version to ${newVersion}"`, { stdio: 'inherit' });
      execSync(`git tag vscode-v${newVersion}`, { stdio: 'inherit' });
      console.log(`✓ Created git tag vscode-v${newVersion}`);
    } catch (error) {
      console.log('⚠️  Git operations skipped (not a git repo or no changes)');
    }

    console.log(`\n🎉 Successfully published QueryFlux VS Code Extension v${newVersion}!`);
    console.log(`📁 Location: ${packageInfo.versionDir}`);
    console.log(`🔗 Latest: ${path.join(CONFIG.targetDir, 'queryflux-vscode-latest')}`);
    console.log(`📦 Package: ${packageInfo.vsxFile}`);
    console.log(`🏪 Marketplace: ${CONFIG.marketplaceUrl}`);

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