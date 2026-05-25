#!/bin/bash

# QueryFlux Backend Build Script
# This script builds the Go backend for multiple platforms

set -e

# Default values
VERSION="dev"
COMMIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
BINARY_NAME="queryflux-backend"
BUILD_DIR="dist"
PLATFORMS="linux/amd64,linux/arm64,darwin/amd64,darwin/arm64,windows/amd64"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -v|--version)
      VERSION="$2"
      shift 2
      ;;
    -b|--binary)
      BINARY_NAME="$2"
      shift 2
      ;;
    -o|--output)
      BUILD_DIR="$2"
      shift 2
      ;;
    -p|--platforms)
      PLATFORMS="$2"
      shift 2
      ;;
    -r|--release)
      VERSION="release"
      ;;
    -h|--help)
      echo "Usage: $0 [options]"
      echo "Options:"
      echo "  -v, --version        Version string [default: dev]"
      echo "  -b, --binary         Binary name [default: queryflux-backend]"
      echo "  -o, --output         Output directory [default: dist]"
      echo "  -p, --platforms      Target platforms (comma-separated)"
      echo "  -r, --release        Build for release (version=release)"
      echo "  -h, --help           Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "🔨 QueryFlux Backend Build"
echo "=========================="
echo "Version: $VERSION"
echo "Commit: $COMMIT_SHA"
echo "Build Time: $BUILD_TIME"
echo "Binary: $BINARY_NAME"
echo "Output: $BUILD_DIR"
echo "Platforms: $PLATFORMS"
echo ""

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf $BUILD_DIR
mkdir -p $BUILD_DIR

# Check Go version
echo "🔍 Checking Go version..."
go version

# Download dependencies
echo "📦 Downloading dependencies..."
go mod download
go mod verify

# Run tests
echo "🧪 Running tests..."
go test -v -race -coverprofile=coverage.out ./...

# Run security check
echo "🔒 Running security check..."
go install golang.org/x/vuln/cmd/govulncheck@latest
govulncheck ./...

# Build for each platform
echo "🏗️  Building binaries..."
IFS=',' read -ra PLATFORM_ARRAY <<< "$PLATFORMS"

for PLATFORM in "${PLATFORM_ARRAY[@]}"; do
    PLATFORM=$(echo $PLATFORM | xargs) # Trim whitespace
    OS=$(echo $PLATFORM | cut -d'/' -f1)
    ARCH=$(echo $PLATFORM | cut -d'/' -f2)

    # Map architecture names
    case $ARCH in
        amd64)
            GOARCH="amd64"
            ;;
        arm64)
            GOARCH="arm64"
            ;;
        *)
            echo "❌ Unsupported architecture: $ARCH"
            continue
            ;;
    esac

    # Set file extension for Windows
    FILE_EXT=""
    if [[ "$OS" == "windows" ]]; then
        FILE_EXT=".exe"
    fi

    # Set output filename
    OUTPUT_NAME="${BINARY_NAME}-${OS}-${GOARCH}${FILE_EXT}"
    OUTPUT_PATH="$BUILD_DIR/$OUTPUT_NAME"

    echo "   Building for $OS/$GOARCH..."

    # Build the binary
    CGO_ENABLED=0 GOOS=$OS GOARCH=$GOARCH go build \
        -ldflags="-X main.version=$VERSION -X main.commit=$COMMIT_SHA -X main.buildTime=$BUILD_TIME -s -w" \
        -o "$OUTPUT_PATH" \
        ./cmd/server

    echo "   ✅ Built $OUTPUT_NAME"
done

# Generate checksums
echo ""
echo "🔐 Generating checksums..."
cd $BUILD_DIR
for file in ${BINARY_NAME}-*; do
    if [[ -f "$file" ]]; then
        sha256sum "$file" > "$file.sha256"
        echo "   ✅ Generated checksum for $file"
    fi
done

# Create release archives
echo ""
echo "📦 Creating release archives..."
for file in ${BINARY_NAME}-*${FILE_EXT}; do
    if [[ -f "$file" ]]; then
        ARCHIVE_NAME="${file%.exe}.tar.gz"
        tar -czf "$ARCHIVE_NAME" "$file"
        echo "   ✅ Created $ARCHIVE_NAME"
    fi
done

# Generate build info
echo ""
echo "📋 Generating build info..."
cat > build-info.json << EOF
{
  "version": "$VERSION",
  "commit_sha": "$COMMIT_SHA",
  "build_time": "$BUILD_TIME",
  "go_version": "$(go version | awk '{print $3}')",
  "platforms": [
    $(echo "${PLATFORM_ARRAY[@]}" | sed 's/ /, /g' | sed 's/,/,\\n    /g')
  ],
  "binaries": [
    $(for file in ${BINARY_NAME}-*.tar.gz; do
      if [[ -f "$file" ]]; then
        echo "    \"$file\","
      fi
    done | sed '$s/,$//')
  ]
}
EOF

echo "✅ Build completed successfully!"
echo ""
echo "📁 Output directory: $(pwd)/$BUILD_DIR"
echo "📄 Build info: $BUILD_DIR/build-info.json"
echo ""
echo "📊 Build summary:"
ls -lh $BUILD_DIR/*.tar.gz 2>/dev/null || echo "No archives created"
echo ""
echo "🚀 To deploy:"
echo "  ./scripts/deploy.sh -e staging -v $VERSION"
echo "  ./scripts/deploy.sh -e production -v $VERSION"