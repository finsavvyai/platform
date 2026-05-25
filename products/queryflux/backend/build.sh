#!/bin/bash
# Build script that excludes problematic adapters temporarily

export CGO_ENABLED=1
export PATH="/opt/homebrew/bin:$PATH"

# Build only with core adapters (exclude problematic ones)
go build \
  -tags="exclude_cloud exclude_aws exclude_search" \
  -o queryflux-backend \
  ./cmd/server/main.go

echo "✅ Backend built successfully"
