#!/usr/bin/env node

import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log('🧪 Running Dashboard Component Tests...\n')

try {
  // Run tests with Jest
  const result = execSync('npx jest --verbose --no-cache', {
    cwd: __dirname,
    stdio: 'inherit',
    encoding: 'utf8'
  })
  
  console.log('\n✅ All tests passed!')
} catch (error) {
  console.error('\n❌ Tests failed:', error.message)
  process.exit(1)
}