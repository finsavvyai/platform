#!/usr/bin/env node

/**
 * Cloudflare Pages Build Script for Questro Backend
 * Handles workspace isolation and dependency management for Cloudflare deployment
 *
 * This script automatically:
 * 1. Creates proper .npmrc configuration for deployment
 * 2. Installs dependencies without workspace conflicts
 * 3. Builds the application for Cloudflare Pages Functions
 * 4. Optimizes for serverless deployment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Cloudflare Pages build process...');
console.log(`📍 Working directory: ${__dirname}`);
console.log(`📍 Node version: ${process.version}`);
console.log(`📍 Environment: ${process.env.NODE_ENV || 'production'}`);

// Step 1: Create deployment-specific .npmrc
console.log('\n📝 Creating Cloudflare-specific .npmrc configuration...');
const npmrcContent = `
workspaces=false
legacy-peer-deps=true
package-lock=false
auto-install-peers=true
strict-peer-deps=false
`;

fs.writeFileSync(path.join(__dirname, '.npmrc'), npmrcContent.trim());
console.log('✅ .npmrc configured for Cloudflare deployment');

// Step 2: Clean previous build
console.log('\n🧹 Cleaning previous build...');
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  try {
    fs.rmSync(distDir, { recursive: true, force: true });
    console.log('✅ Previous build cleaned');
  } catch (err) {
    console.warn('⚠️  Could not clean dist directory:', err.message);
  }
}

// Step 3: Ensure dependencies are installed correctly
console.log('\n📦 Installing dependencies for Cloudflare deployment...');
try {
  // Remove node_modules to ensure clean install
  const nodeModulesDir = path.join(__dirname, 'node_modules');
  if (fs.existsSync(nodeModulesDir)) {
    fs.rmSync(nodeModulesDir, { recursive: true, force: true });
  }

  // Install dependencies with our configuration
  execSync('npm install --production=false --no-audit --no-fund', {
    stdio: 'inherit',
    cwd: __dirname
  });
  console.log('✅ Dependencies installed successfully');
} catch (error) {
  console.error('❌ Dependency installation failed:', error.message);
  process.exit(1);
}

// Step 4: Verify critical dependencies
console.log('\n🔍 Verifying critical dependencies...');
const criticalDeps = ['express', 'pg', 'socket.io', 'aws-sdk'];
let missingDeps = [];

for (const dep of criticalDeps) {
  try {
    require.resolve(dep);
    console.log(`✅ ${dep} is available`);
  } catch (error) {
    console.log(`❌ ${dep} is missing`);
    missingDeps.push(dep);
  }
}

if (missingDeps.length > 0) {
  console.error('❌ Critical dependencies missing:', missingDeps.join(', '));
  process.exit(1);
}

// Step 5: Build the application
console.log('\n🔨 Building application for Cloudflare...');
try {
  // Run TypeScript compilation
  console.log('📦 Compiling TypeScript...');
  execSync('npx tsc --skipLibCheck --noEmitOnError false', {
    stdio: 'inherit',
    cwd: __dirname
  });
  console.log('✅ TypeScript compilation completed');
} catch (error) {
  console.warn('⚠️  TypeScript compilation had warnings (continuing...)');
}

// Step 6: Create Cloudflare Functions structure
console.log('\n⚡ Creating Cloudflare Functions structure...');
const functionsDir = path.join(__dirname, 'functions');
if (!fs.existsSync(functionsDir)) {
  fs.mkdirSync(functionsDir, { recursive: true });
}

// Copy built backend to functions directory
if (fs.existsSync(distDir)) {
  const copyRecursive = (src, dest) => {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
      fs.mkdirSync(dest, { recursive: true });
      fs.readdirSync(src).forEach(childItemName => {
        copyRecursive(path.join(src, childItemName), path.join(dest, childItemName));
      });
    } else {
      fs.copyFileSync(src, dest);
    }
  };

  copyRecursive(distDir, path.join(functionsDir, 'api'));
  console.log('✅ Backend functions prepared for Cloudflare');
}

// Step 7: Create _worker.js for Cloudflare Pages Functions
console.log('\n📄 Creating Cloudflare Pages Functions entry point...');
const workerContent = `
// Cloudflare Pages Functions entry point for Questro API
import { createServer } from './api/index.js';

export async function onRequest(context) {
  return createServer(context.request, context.env);
}
`;

fs.writeFileSync(path.join(__dirname, 'functions', '_worker.js'), workerContent.trim());
console.log('✅ Cloudflare Functions entry point created');

// Step 8: Final verification
console.log('\n🔍 Final build verification...');
const indexPath = path.join(distDir, 'index.js');
if (fs.existsSync(indexPath)) {
  const stats = fs.statSync(indexPath);
  console.log('✅ Main entry file created successfully');
  console.log(`📊 File size: ${stats.size} bytes`);
  console.log('🎉 Cloudflare Pages build completed successfully!');
} else {
  console.error('❌ Main entry file not found');
  process.exit(1);
}

console.log('\n🚀 Questro is ready for Cloudflare Pages deployment!');
console.log('📋 Next steps:');
console.log('   1. Push this code to your repository');
console.log('   2. Connect your repository to Cloudflare Pages');
console.log('   3. Set build command: npm run build:cloudflare');
console.log('   4. Set build output directory: functions');
console.log('   5. Configure environment variables');
