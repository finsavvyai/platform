#!/bin/bash

# Check if gofmt would make any changes to Go files
# Exit with non-zero status if files need formatting

echo "Checking Go code formatting..."

# Get list of unformatted files
UNFORMATTED=$(gofmt -l .)

if [ -z "$UNFORMATTED" ]; then
    echo "✓ All Go files are properly formatted"
    exit 0
else
    echo "✗ The following Go files need formatting:"
    echo "$UNFORMATTED"
    echo ""
    echo "Please run 'gofmt -w .' to fix formatting issues"
    exit 1
fi
