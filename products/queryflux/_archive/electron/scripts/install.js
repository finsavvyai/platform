#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const platform = process.platform;
const arch = process.arch;

console.log(`🚀 Installing QueryFlux Desktop for ${platform}-${arch}...`);

// Create installation directory
const installDir = (() => {
  switch (platform) {
    case 'darwin':
      return '/Applications';
    case 'win32':
      return path.join(process.env.LOCALAPPDATA || 'C:\\Program Files', 'QueryFlux');
    case 'linux':
      return path.join(process.env.HOME || '/usr/local', 'bin');
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
})();

console.log(`📁 Installation directory: ${installDir}`);

// Ensure installation directory exists
if (!fs.existsSync(installDir)) {
  try {
    fs.mkdirSync(installDir, { recursive: true });
    console.log('✅ Created installation directory');
  } catch (error) {
    console.error('❌ Failed to create installation directory:', error.message);
    process.exit(1);
  }
}

// Copy application files
const appPath = path.join(__dirname, '..', 'release');
const appFiles = fs.readdirSync(appPath);

const executableFile = appFiles.find(file => {
  switch (platform) {
    case 'darwin':
      return file.endsWith('.app') || file.endsWith('.dmg');
    case 'win32':
      return file.endsWith('.exe');
    case 'linux':
      return file.endsWith('.AppImage') || file.endsWith('.deb') || file.endsWith('.rpm');
    default:
      return false;
  }
});

if (!executableFile) {
  console.error('❌ No executable file found in release directory');
  console.log('Available files:', appFiles);
  process.exit(1);
}

console.log(`📦 Found executable: ${executableFile}`);

// Install based on platform
try {
  switch (platform) {
    case 'darwin':
      if (executableFile.endsWith('.dmg')) {
        console.log('🍎 Installing macOS DMG...');
        execSync(`hdiutil attach "${path.join(appPath, executableFile)}"`, { stdio: 'inherit' });
        execSync('cp -R "/Volumes/QueryFlux/QueryFlux.app" "/Applications/"', { stdio: 'inherit' });
        execSync('hdiutil detach "/Volumes/QueryFlux"', { stdio: 'inherit' });
      } else {
        execSync(`cp -R "${path.join(appPath, executableFile)}" "${installDir}/"`, { stdio: 'inherit' });
      }
      break;

    case 'win32':
      if (executableFile.endsWith('.exe')) {
        console.log('🪟 Running Windows installer...');
        execSync(`"${path.join(appPath, executableFile)}" /S`, { stdio: 'inherit' });
      } else {
        execSync(`xcopy "${path.join(appPath, executableFile)}" "${installDir}\\" /E /I /Y`, { stdio: 'inherit' });
      }
      break;

    case 'linux':
      const execPath = path.join(appPath, executableFile);
      if (executableFile.endsWith('.deb')) {
        console.log('🐧 Installing Debian package...');
        execSync(`sudo dpkg -i "${execPath}"`, { stdio: 'inherit' });
        execSync('sudo apt-get install -f', { stdio: 'inherit' }); // Fix dependencies
      } else if (executableFile.endsWith('.rpm')) {
        console.log('🐧 Installing RPM package...');
        execSync(`sudo rpm -i "${execPath}"`, { stdio: 'inherit' });
      } else if (executableFile.endsWith('.AppImage')) {
        console.log('🐧 Installing AppImage...');
        const appImagePath = path.join(installDir, executableFile);
        execSync(`cp "${execPath}" "${appImagePath}"`, { stdio: 'inherit' });
        execSync(`chmod +x "${appImagePath}"`, { stdio: 'inherit' });

        // Create desktop entry
        const desktopEntry = `[Desktop Entry]
Version=1.0
Type=Application
Name=QueryFlux
Comment=AI-powered database management platform
Exec=${appImagePath}
Icon=queryflux
Terminal=false
Categories=Development;Database;
`;
        const desktopPath = path.join(process.env.HOME, '.local/share/applications/queryflux.desktop');
        fs.writeFileSync(desktopPath, desktopEntry);
        console.log('✅ Created desktop entry');
      }
      break;
  }

  console.log('✅ QueryFlux Desktop installed successfully!');

  // Show launch instructions
  console.log('\n🎯 To launch QueryFlux:');
  switch (platform) {
    case 'darwin':
      console.log('  • Open from Applications folder');
      console.log('  • Or run: open "/Applications/QueryFlux.app"');
      break;
    case 'win32':
      console.log('  • Find in Start Menu');
      console.log('  • Or run from: C:\\Program Files\\QueryFlux');
      break;
    case 'linux':
      console.log('  • Run from applications menu');
      console.log(`  • Or execute: ${installDir}/QueryFlux`);
      break;
  }

} catch (error) {
  console.error('❌ Installation failed:', error.message);
  process.exit(1);
}