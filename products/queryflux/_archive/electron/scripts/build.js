#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const packageJson = require('../package.json');
const version = packageJson.version;

console.log(`🔨 Building QueryFlux Desktop v${version}...`);

// Clean previous builds
console.log('🧹 Cleaning previous builds...');
if (fs.existsSync('dist')) {
  execSync('rm -rf dist', { stdio: 'inherit' });
}
if (fs.existsSync('release')) {
  execSync('rm -rf release', { stdio: 'inherit' });
}

// Build application
console.log('📦 Building application...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Application built successfully');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

// Get platform information
const platform = process.argv[2] || 'all';
const arch = process.argv[3] || 'all';

console.log(`🎯 Building for platform: ${platform}, architecture: ${arch}`);

// Build distributables
const buildCommands = {
  'mac': 'npm run dist:mac',
  'win': 'npm run dist:win',
  'linux': 'npm run dist:linux',
  'all': 'npm run dist:all'
};

const buildCommand = buildCommands[platform] || buildCommands['all'];

try {
  console.log(`🚀 Creating distributables...`);
  execSync(buildCommand, { stdio: 'inherit' });
  console.log('✅ Distributables created successfully');
} catch (error) {
  console.error('❌ Failed to create distributables:', error.message);
  process.exit(1);
}

// List created files
if (fs.existsSync('release')) {
  console.log('\n📁 Created files:');
  const files = fs.readdirSync('release');
  files.forEach(file => {
    const filePath = path.join('release', file);
    const stats = fs.statSync(filePath);
    const size = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`  • ${file} (${size} MB)`);
  });
}

// Generate checksums
console.log('\n🔐 Generating checksums...');
const crypto = require('crypto');
if (fs.existsSync('release')) {
  const files = fs.readdirSync('release');
  const checksums = {};

  files.forEach(file => {
    const filePath = path.join('release', file);
    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    checksums[file] = hash;
  });

  fs.writeFileSync('release/checksums.txt',
    Object.entries(checksums)
      .map(([file, hash]) => `${hash}  ${file}`)
      .join('\n')
  );

  fs.writeFileSync('release/checksums.json', JSON.stringify(checksums, null, 2));
  console.log('✅ Checksums generated');
}

console.log(`\n🎉 Build completed successfully!`);
console.log(`📂 Output directory: ${path.resolve('release')}`);
console.log(`🔍 Verify builds: ls -la release/`);