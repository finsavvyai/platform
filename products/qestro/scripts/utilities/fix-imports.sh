#!/bin/bash

# Fix ESM imports by adding .js extensions to relative imports
# This is required for Node.js ESM to work properly

echo "🔧 Fixing ESM imports in TypeScript files..."

# Find all .ts files (excluding test files and node_modules)
find src -name "*.ts" \
  -not -path "*/node_modules/*" \
  -not -path "*/__tests__/*" \
  -not -name "*.test.ts" \
  -not -name "*.spec.ts" \
  -type f | while read file; do
  
  # Check if file has relative imports without .js extension
  if grep -q "from ['\"]\.\./" "$file" || grep -q "from ['\"]\./" "$file"; then
    echo "  Fixing: $file"
    
    # Add .js to relative imports that don't already have it
    # Pattern 1: from '../path' -> from '../path.js'
    # Pattern 2: from './path' -> from './path.js'
    sed -i.bak -E \
      -e "s|from '(\.\./[^']+)'|from '\1.js'|g" \
      -e "s|from \"(\.\./[^\"]+)\"|from \"\1.js\"|g" \
      -e "s|from '(\./[^']+)'|from '\1.js'|g" \
      -e "s|from \"(\./[^\"]+)\"|from \"\1.js\"|g" \
      -e "s|\.js\.js|.js|g" \
      "$file"
    
    # Remove backup file
    rm -f "${file}.bak"
  fi
done

echo "✅ Import fixing complete!"
echo ""
echo "🧪 Testing build..."
npm run build
