# Publishing Guide for TokenForge

This document contains step-by-step instructions for publishing TokenForge and its SDKs to package registries.

## Pre-Publish Checklist

Before publishing any package, ensure:

- [ ] All tests pass locally (`pnpm test`)
- [ ] TypeScript compiles without errors (`pnpm run typecheck`)
- [ ] Documentation is up-to-date (README.md, CHANGELOG.md)
- [ ] Package version is bumped correctly in package.json (follow semver)
- [ ] CHANGELOG.md has an entry for the new version
- [ ] Git working tree is clean (`git status`)
- [ ] You're on the `main` branch (`git branch --show-current`)
- [ ] All changes are committed and pushed
- [ ] You have appropriate publish permissions for the registry

---

## Publishing the Main Package (@opensyber/tokenforge)

The main TokenForge package is published to npm.

### Prerequisites

```bash
# 1. Ensure you're logged in to npm
npm login --scope=@opensyber

# 2. Verify you have publish access
npm access list packages --scope=@opensyber
```

### Using the Publish Script (Recommended)

The repository includes a comprehensive `publish.sh` script that automates the entire npm publishing pipeline:

```bash
# Navigate to the tokenforge package directory
cd packages/tokenforge/

# View help
./publish.sh --help
```

#### Usage Examples

**Publish current version (0.1.0 → 0.1.0)**

```bash
./publish.sh
```

This publishes the package as-is without bumping the version. Use when you've already updated package.json.

**Bump patch version and publish (0.1.0 → 0.1.1)**

```bash
./publish.sh patch
```

Bumps the patch version, runs tests and build, then publishes.

**Bump minor version and publish (0.1.0 → 0.2.0)**

```bash
./publish.sh minor
```

Bumps the minor version for backward-compatible feature additions.

**Bump major version and publish (0.1.0 → 1.0.0)**

```bash
./publish.sh major
```

Bumps the major version for breaking changes.

**Dry run (preview without publishing)**

```bash
DRY_RUN=1 ./publish.sh patch
```

Runs the entire pipeline but skips the actual npm publish step. Useful for testing.

### What the Publish Script Does

1. **Pre-flight Checks**
   - Verifies npm login
   - Checks git working tree is clean
   - Confirms you're on `main` branch (warns if not)

2. **Testing & Building**
   - Runs full test suite
   - Cleans previous build artifacts
   - Builds TypeScript to `dist/`

3. **Version Management** (if bump specified)
   - Updates `package.json` with new version
   - Logs the new version number

4. **Package Verification**
   - Verifies package contents with `npm pack --dry-run`
   - Ensures no test files leak into package
   - Ensures no environment files leak into package

5. **Publishing**
   - Publishes to npm with `--access public`
   - Displays npm package URL

6. **Git Tagging** (if version was bumped)
   - Commits version bump
   - Creates git tag: `tokenforge-v0.1.1`
   - Instructs you to push with `git push && git push --tags`

### Manual Publishing (If Needed)

If you prefer to publish manually:

```bash
cd packages/tokenforge/

# 1. Verify version in package.json
cat package.json | grep '"version"'

# 2. Run tests
pnpm test

# 3. Build
pnpm run clean && pnpm run build

# 4. (Optional) Dry run first
npm publish --access public --dry-run

# 5. Publish to npm
npm publish --access public

# 6. Tag the release
git add package.json
git commit -m "release(tokenforge): v0.2.0"
git tag tokenforge-v0.2.0
git push && git push --tags
```

### Verify Publication

After publishing, verify the package is available:

```bash
# Check npm registry
npm view @opensyber/tokenforge

# Or visit: https://www.npmjs.com/package/@opensyber/tokenforge
```

---

## Publishing Python SDK

The Python SDK is published to PyPI.

### Prerequisites

```bash
# 1. Install build tools
pip install build twine

# 2. Ensure you have PyPI credentials
# Create/obtain API token from https://pypi.org/account/token/
# Store in ~/.pypirc:
# [pypi]
# username = __token__
# password = pypi_YOUR_TOKEN_HERE

# 3. Verify PyPI access
twine check packages/tokenforge-sdks/python/dist/*
```

### Building the Python Package

```bash
cd packages/tokenforge-sdks/python/

# 1. Update version in setup.py or pyproject.toml
# Match the main package version (0.1.0)

# 2. Update CHANGELOG.md in the Python SDK directory

# 3. Build the distribution
python -m build

# This creates:
# - dist/tokenforge-py-0.1.0.tar.gz (source)
# - dist/tokenforge_py-0.1.0-py3-none-any.whl (wheel)
```

### Publishing to PyPI

```bash
cd packages/tokenforge-sdks/python/

# 1. (Optional) Test upload to TestPyPI first
twine upload --repository testpypi dist/*

# 2. Verify on TestPyPI
# Visit: https://test.pypi.org/project/tokenforge-py/

# 3. Upload to PyPI (production)
twine upload dist/*

# 4. Verify on PyPI
# Visit: https://pypi.org/project/tokenforge-py/
```

### Install from PyPI (Verification)

```bash
pip install tokenforge-py==0.1.0

# Or with extras if defined:
# pip install tokenforge-py[async]==0.1.0
```

---

## Publishing Go SDK

The Go SDK is published to Go module registry.

### Prerequisites

- Go 1.18+ installed
- git access to push tags
- Go module already defined in `go.mod`

### Publishing Process

```bash
cd packages/tokenforge-sdks/go/

# 1. Verify go.mod
cat go.mod

# 2. Update version tag in module path if needed (usually not)

# 3. Update CHANGELOG.md

# 4. Run tests
go test ./...

# 5. Create git tag from root of monorepo
cd /path/to/tokenforge/root
git tag tokenforge-go-v0.1.0
git push --tags

# 6. Go proxy will auto-index
# Verify after ~5 minutes: https://pkg.go.dev/github.com/opensyber/tokenforge-go
```

### Install from Go Modules (Verification)

```bash
go get github.com/opensyber/tokenforge-go@v0.1.0
```

### Using the Go SDK

```go
import "github.com/opensyber/tokenforge-go"

client := tokenforge.NewClient(apiKey, apiBase)
result, err := client.Verify(ctx, request)
```

---

## Other SDKs (Kotlin, Swift, React Native)

These SDKs may have platform-specific publication processes:

### Kotlin SDK
- **Target Registry**: Maven Central via Sonatype OSS
- **Process**: Create Sonatype account, publish via Gradle
- **Reference**: https://central.sonatype.org/publish/publish-guide/

### Swift SDK
- **Target Registry**: Swift Package Index (automatic from GitHub releases)
- **Process**: Create GitHub release with tag matching version
- **Reference**: https://www.swiftpackageindex.com

### React Native SDK
- **Target Registry**: npm (same as main package)
- **Process**: Publish to npm under `@opensyber/tokenforge-react-native`
- **Reference**: https://docs.npmjs.com/

---

## Coordinated Release Process

For coordinated releases of all SDKs:

1. **Bump version** in all package.json/setup.py/go.mod files
2. **Update all CHANGELOG.md** files with consistent version entry
3. **Publish main npm package**: Run `./publish.sh patch` in tokenforge/
4. **Publish Python SDK**: `twine upload packages/tokenforge-sdks/python/dist/*`
5. **Publish Go SDK**: `git tag tokenforge-go-v0.1.0 && git push --tags`
6. **Publish other SDKs** (Kotlin, Swift, React Native) to their respective registries
7. **Announce release** with consistent version number across all platforms

### Release Naming Convention

- **npm**: `tokenforge-v0.1.0` (git tag)
- **Python PyPI**: `tokenforge-py==0.1.0`
- **Go**: `tokenforge-go-v0.1.0` (git tag)
- **Kotlin**: `0.1.0` (Maven artifact)
- **Swift**: `0.1.0` (git release tag)
- **React Native**: `tokenforge-react-native@0.1.0` (npm)

---

## Troubleshooting

### npm Publish Issues

**Error: "You must be logged in"**
```bash
npm login --scope=@opensyber
```

**Error: "You do not have permission"**
- Verify you're in the @opensyber npm organization
- Contact a maintainer with publish access

**Error: "This package version already exists"**
- Choose a different version (bump major/minor/patch)
- Use `npm version major|minor|patch` to bump

### PyPI Upload Issues

**Error: "Invalid authentication"**
```bash
# Regenerate token at https://pypi.org/account/token/
# Update ~/.pypirc with new token
```

**Error: "File already exists"**
- PyPI doesn't allow re-uploading the same version
- Bump the version in setup.py

### Git Tag Conflicts

**Error: "tag already exists"**
```bash
# Delete local tag and try again
git tag -d tokenforge-v0.1.0

# Or use a different version
git tag tokenforge-v0.1.1
```

---

## Rollback Procedures

### Yanking npm Package Version

If a critical bug is found, yank the version:

```bash
npm unpublish @opensyber/tokenforge@0.1.0
```

Or use npm's "yank" feature to deprecate without removing:

```bash
npm deprecate @opensyber/tokenforge@0.1.0 "Critical bug — use 0.1.1"
```

### Yanking PyPI Package Version

```bash
pip install twine
twine upload --skip-existing dist/tokenforge_py-0.1.0*  # to yank, use UI: https://pypi.org/project/tokenforge-py/

# Or via web UI: https://pypi.org/project/tokenforge-py/ → Manage Release
```

### Reverting Git Tags

```bash
# Delete local tag
git tag -d tokenforge-v0.1.0

# Delete remote tag
git push origin :refs/tags/tokenforge-v0.1.0
```

---

## Additional Resources

- **npm Documentation**: https://docs.npmjs.com/cli/v10/commands/npm-publish
- **PyPI Publishing**: https://packaging.python.org/tutorials/packaging-projects/
- **Go Modules**: https://go.dev/blog/using-go-modules
- **Keep a Changelog**: https://keepachangelog.com/
- **Semantic Versioning**: https://semver.org/

---

## Questions?

For publishing-related questions, refer to:
- Main repository: https://github.com/opensyber/tokenforge
- Documentation: https://tokenforge.opensyber.cloud
- Issues: https://github.com/opensyber/tokenforge/issues
