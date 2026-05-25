# Version Manager for Ultimate Universal Database Manager VS Code Extension

This document explains how to use the version management script for creating new plugin versions.

## Quick Start

The version manager script (`version-manager.sh`) automates the entire process of creating new plugin versions, including:

- Version bumping (following semantic versioning)
- Changelog generation/updates
- Building and compiling TypeScript
- Packaging the extension (.vsix file)
- Git commit and tagging
- Publishing to VS Code Marketplace

## Usage

### Basic Commands

```bash
# Bump patch version (bug fixes: 1.0.0 -> 1.0.1)
./version-manager.sh patch

# Bump minor version (new features: 1.0.0 -> 1.1.0)
./version-manager.sh minor

# Bump major version (breaking changes: 1.0.0 -> 2.0.0)
./version-manager.sh major

# Create prerelease version (1.0.0 -> 1.0.1-0)
./version-manager.sh prerelease
```

### NPM Script Shortcuts

For convenience, you can also use these npm commands:

```bash
# Version bumping with full workflow
npm run version:patch
npm run version:minor
npm run version:major
npm run version:prerelease

# Version bumping without publishing
npm run version:patch-no-publish
npm run version:minor-no-publish

# Dry run to see what would happen
npm run version:dry-run
```

### Advanced Options

```bash
# Skip specific steps
./version-manager.sh patch --no-build      # Skip building
./version-manager.sh patch --no-package    # Skip packaging
./version-manager.sh patch --no-git        # Skip git operations
./version-manager.sh patch --no-publish    # Skip publishing

# Dry run (see what would happen without making changes)
./version-manager.sh patch --dry-run

# Combine options
./version-manager.sh minor --no-git --no-publish
```

## What the Script Does

### 1. Version Bumping
- Updates the version in `package.json` using semantic versioning
- Follows npm version standards

### 2. Changelog Management
- Creates `CHANGELOG.md` if it doesn't exist
- Adds new version entry with structured sections:
  - Added
  - Changed
  - Fixed
  - Deprecated
  - Removed
  - Security

### 3. Building
- Installs dependencies if needed
- Compiles TypeScript code
- Runs linting (continues on warnings)

### 4. Packaging
- Creates `.vsix` file using `vsce package`
- Names file as `ultimate-db-manager-vscode-{version}.vsix`

### 5. Git Operations
- Creates commit with version changes
- Creates annotated git tag `v{version}`
- Provides instructions for pushing changes

### 6. Publishing
- Prompts before publishing to marketplace
- Uses `vsce publish` to deploy to VS Code Marketplace

## Prerequisites

Make sure you have the following installed:

- Node.js and npm
- VS Code Extension Manager (`vsce`): `npm install -g vsce`
- Git (for version control operations)

## Configuration

### Marketplace Publishing

To publish to the VS Code Marketplace, you need:

1. A Visual Studio Marketplace publisher account
2. Personal Access Token (PAT) from Azure DevOps
3. Configure vsce with your token: `vsce login <publisher-name>`

### Git Repository

The script works best with a git repository. If not using git, use `--no-git` flag.

## Examples

### Standard Release Workflow

```bash
# 1. Make your changes and commit them
git add .
git commit -m "feat: add new database connection feature"

# 2. Create new version (this will build, package, commit, tag, and publish)
./version-manager.sh minor

# 3. Push changes to remote
git push && git push --tags
```

### Development/Testing Workflow

```bash
# Create version without publishing (for testing)
./version-manager.sh patch --no-publish

# Install locally for testing
code --install-extension ultimate-db-manager-vscode-1.0.1.vsix

# When ready, publish manually
npm run publish
```

### CI/CD Integration

```bash
# In CI/CD pipeline, skip interactive prompts and git operations
./version-manager.sh patch --no-git --no-publish
```

## File Structure After Version Creation

```
pgdesktop-vscode-extension/
├── package.json                           # Updated version
├── CHANGELOG.md                          # Updated with new version
├── ultimate-db-manager-vscode-X.Y.Z.vsix # Packaged extension
├── out/                                  # Compiled TypeScript
└── version-manager.sh                    # This script
```

## Troubleshooting

### Common Issues

1. **Node.js not found**: Make sure Node.js is installed and in your PATH
2. **vsce not found**: Install with `npm install -g vsce`
3. **Git errors**: Ensure you're in a git repository or use `--no-git`
4. **Publishing fails**: Check your marketplace credentials with `vsce login`

### Error Recovery

If the script fails partway through:

1. Check the error message
2. Fix the issue
3. You may need to manually revert version changes in `package.json`
4. Re-run the script

## Security Notes

- The script handles credentials securely through vsce
- No sensitive information is stored in the script
- Git operations respect your existing git configuration

## Contributing

To improve the version manager script:

1. Edit `version-manager.sh`
2. Test with `--dry-run` flag
3. Update this documentation if needed
4. Submit your changes
