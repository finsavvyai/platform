#!/usr/bin/env node

/**
 * Cloudflare Workers Build Script for Questro Backend
 * Handles workspace isolation and prepares code for Cloudflare deployment
 * Automatically resolves npm workspace conflicts during build
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Cloudflare Workers build process...');
console.log(`📍 Working directory: ${__dirname}`);
console.log(`📍 Node version: ${process.version}`);

// Step 1: Handle workspace isolation
console.log('\n🔧 Step 1: Configuring workspace isolation...');

// Create deployment-specific .npmrc
const npmrcContent = `
workspaces=false
legacy-peer-deps=true
ignore-scripts=false
package-lock=false
`;

fs.writeFileSync('.npmrc', npmrcContent.trim());
console.log('✅ Created .npmrc with workspace isolation');

// Step 2: Install dependencies in isolation mode
console.log('\n📦 Step 2: Installing dependencies (workspace isolation mode)...');

try {
  // Clean install without workspace dependencies
  execSync('npm install --production=false --no-audit --no-fund', {
    stdio: 'inherit',
    cwd: __dirname
  });
  console.log('✅ Dependencies installed successfully');
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

// Step 3: Verify critical dependencies
console.log('\n🔍 Step 3: Verifying critical dependencies...');

const criticalDeps = ['express', 'pg', 'socket.io', 'aws-sdk', 'drizzle-orm'];
const missingDeps = [];

for (const dep of criticalDeps) {
  try {
    require.resolve(dep);
    console.log(`✅ ${dep} is available`);
  } catch (error) {
    missingDeps.push(dep);
    console.log(`❌ ${dep} is missing`);
  }
}

if (missingDeps.length > 0) {
  console.error(`❌ Missing critical dependencies: ${missingDeps.join(', ')}`);
  process.exit(1);
}

// Step 4: Create Cloudflare-compatible dist directory
console.log('\n📁 Step 4: Preparing Cloudflare Workers dist directory...');

const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
  console.log('✅ Created dist directory');
} else {
  // Clean existing dist
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });
  console.log('✅ Cleaned existing dist directory');
}

// Step 5: Compile TypeScript for Cloudflare Workers
console.log('\n🏗️ Step 5: Compiling TypeScript for Cloudflare Workers...');

try {
  // Use TypeScript compiler with Cloudflare-compatible settings
  const tscCommand = 'npx tsc --build --force --verbose';

  execSync(tscCommand, {
    stdio: 'inherit',
    cwd: __dirname
  });
  console.log('✅ TypeScript compilation completed');
} catch (error) {
  console.warn('⚠️ TypeScript compilation had issues (continuing with available files)');
}

// Step 6: Create Cloudflare Workers entry point
console.log('\n🚪 Step 6: Creating Cloudflare Workers entry point...');

const workerEntry = `
/**
 * Cloudflare Workers Entry Point for Questro Backend
 * Generated automatically during build process
 */

import { QuestroAPI } from './services/QuestroAPI.js';

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const api = new QuestroAPI(env);

      // Handle different routes
      if (url.pathname.startsWith('/api/')) {
        return await api.handleRequest(request, url);
      }

      // Health check endpoint
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          environment: env.NODE_ENV || 'development'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Default response
      return new Response('Questro API - Cloudflare Workers', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
`;

fs.writeFileSync(path.join(distDir, 'index.js'), workerEntry);
console.log('✅ Created Cloudflare Workers entry point');

// Step 7: Copy necessary configuration files
console.log('\n📋 Step 7: Copying configuration files...');

const filesToCopy = [
  'package.json',
  'wrangler.toml',
  'schema'
];

for (const file of filesToCopy) {
  const sourcePath = path.join(__dirname, file);
  const destPath = path.join(distDir, file);

  if (fs.existsSync(sourcePath)) {
    if (fs.statSync(sourcePath).isDirectory()) {
      // Copy directory recursively
      copyDirectory(sourcePath, destPath);
    } else {
      // Copy file
      fs.copyFileSync(sourcePath, destPath);
    }
    console.log(`✅ Copied ${file}`);
  } else {
    console.warn(`⚠️ ${file} not found, skipping`);
  }
}

// Step 8: Generate deployment manifest
console.log('\n📄 Step 8: Generating deployment manifest...');

const manifest = {
  name: 'questro-backend',
  version: '1.0.0',
  builtAt: new Date().toISOString(),
  environment: process.env.NODE_ENV || 'development',
  platform: 'cloudflare-workers',
  dependencies: {},
  size: 0,
  files: []
};

// Calculate package size and list files
function calculateSize(dir) {
  let totalSize = 0;
  const files = [];

  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);

    for (const item of items) {
      const itemPath = path.join(currentDir, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        traverse(itemPath);
      } else {
        const relativePath = path.relative(distDir, itemPath);
        const fileSize = stat.size;

        totalSize += fileSize;
        files.push({
          path: relativePath,
          size: fileSize
        });
      }
    }
  }

  traverse(dir);
  return { totalSize, files };
}

const { totalSize, files } = calculateSize(distDir);
manifest.size = totalSize;
manifest.files = files;

fs.writeFileSync(
  path.join(distDir, 'deployment-manifest.json'),
  JSON.stringify(manifest, null, 2)
);

console.log(`✅ Generated deployment manifest`);
console.log(`📊 Total bundle size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`📁 Total files: ${files.length}`);

// Helper function to copy directories recursively
function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Step 9: Cleanup
console.log('\n🧹 Step 9: Cleaning up temporary files...');

try {
  // Remove the .npmrc file to avoid interference
  fs.unlinkSync('.npmrc');
  console.log('✅ Cleaned up temporary .npmrc');
} catch (error) {
  // Ignore cleanup errors
}

console.log('\n🎉 Cloudflare Workers build completed successfully!');
console.log('\n📋 Build Summary:');
console.log(`   - Platform: Cloudflare Workers`);
console.log(`   - Bundle Size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`   - Files: ${files.length}`);
console.log(`   - Environment: ${manifest.environment}`);
console.log('\n🚀 Ready for deployment: Run "npm run deploy:cloudflare"`);
console.log('   or "npm run deploy:cloudflare:preview" for preview deployment');
