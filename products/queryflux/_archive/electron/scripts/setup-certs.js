#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔐 Setting up development certificates for QueryFlux Desktop...');

const platform = process.platform;

if (platform === 'darwin') {
  console.log('🍎 Setting up macOS development certificates...');

  try {
    // Check if certificates exist
    const result = execSync('security find-identity -v -p codesigning', { encoding: 'utf8' });
    console.log('✅ Found existing code signing certificates:');
    console.log(result);

    // Check for distribution certificate
    if (result.includes('Apple Distribution')) {
      console.log('✅ Apple Distribution certificate found');
    } else {
      console.log('⚠️  No Apple Distribution certificate found');
      console.log('   You will need a distribution certificate for Mac App Store builds');
    }

    // Check for development certificate
    if (result.includes('Apple Development') || result.includes('Mac Developer')) {
      console.log('✅ Development certificate found');
    } else {
      console.log('⚠️  No development certificate found');
      console.log('   You can create one in Xcode → Preferences → Accounts');
    }

  } catch (error) {
    console.error('❌ Failed to check certificates:', error.message);
  }

  // Check for provisioning profiles
  try {
    const profilesPath = path.join(process.env.HOME, 'Library/MobileDevice/Provisioning Profiles');
    if (fs.existsSync(profilesPath)) {
      const profiles = fs.readdirSync(profilesPath);
      console.log(`✅ Found ${profiles.length} provisioning profiles`);
    } else {
      console.log('⚠️  No provisioning profiles directory found');
      console.log('   Create directory:', profilesPath);
    }
  } catch (error) {
    console.error('❌ Failed to check provisioning profiles:', error.message);
  }

} else if (platform === 'win32') {
  console.log('🪟 Setting up Windows code signing certificate...');

  try {
    // Check for code signing certificate
    execSync('powershell Get-ChildItem Cert:\\CurrentUser\\My\\CodeSigning', { stdio: 'inherit' });
    console.log('✅ Code signing certificate found');
  } catch (error) {
    console.log('⚠️  No code signing certificate found');
    console.log('   You can obtain one from a Certificate Authority like DigiCert or Sectigo');
  }

} else {
  console.log(`ℹ️  Certificate setup not required for ${platform}`);
}

console.log('\n📋 Certificate Setup Guide:');
console.log('');
console.log('macOS:');
console.log('1. Create Apple Developer account ($99/year)');
console.log('2. Generate Development certificate in Xcode → Preferences → Accounts');
console.log('3. Generate Distribution certificate for App Store builds');
console.log('4. Download provisioning profiles from Apple Developer Portal');
console.log('');
console.log('Windows:');
console.log('1. Purchase code signing certificate from CA (DigiCert, Sectigo)');
console.log('2. Install certificate in Windows Certificate Manager');
console.log('3. Export as .p12 file with private key');
console.log('');
console.log('Environment Variables to Set:');
console.log('');
console.log('macOS:');
console.log('  CSC_LINK=/path/to/certificate.p12');
console.log('  CSC_KEY_PASSWORD=certificate_password');
console.log('  APPLE_ID=your@apple.id');
console.log('  APPLE_ID_PASSWORD=app_specific_password');
console.log('  APPLE_TEAM_ID=your_team_id');
console.log('');
console.log('Windows:');
console.log('  WIN_CSC_LINK=/path/to/certificate.p12');
console.log('  WIN_CSC_KEY_PASSWORD=certificate_password');
console.log('');
console.log('🔧 To set environment variables, add them to your shell profile (.bashrc, .zshrc, etc.)');