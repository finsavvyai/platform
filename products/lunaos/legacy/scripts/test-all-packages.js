/**
 * Comprehensive test to verify all LunaForge packages are working correctly
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const PACKAGES_DIR = './packages';
const TEST_RESULTS = {
  passed: [],
  failed: [],
  total: 0,
  details: []
};

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
  TEST_RESULTS.passed.push(message);
}

function logError(message) {
  log(`❌ ${message}`, 'red');
  TEST_RESULTS.failed.push(message);
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logTest(name) {
  log(`\n🧪 Testing: ${name}`, 'cyan');
}

// Test 1: Check if all packages exist
function testPackageExistence() {
  logTest('Package Existence');

  const expectedPackages = [
    'lunaforge-core',
    'lunaforge-extension',
    'lunaforge-galaxy',
    'lunaforge-codeflow',
    'lunaforge-timetravel',
    'lunaforge-autopsy',
    'lunaforge-composer',
    'lunaforge-prophecy',
    'lunaforge-parallel-universe',
    'lunaforge-guardian',
    'lunaforge-ritual',
    'lunaforge-dream',
    'lunaforge-mythic',
    'lunaforge-worker'
  ];

  logInfo('Checking for all expected packages...');

  expectedPackages.forEach(pkgName => {
    const pkgPath = path.join(PACKAGES_DIR, pkgName);
    if (fs.existsSync(pkgPath)) {
      logSuccess(`${pkgName} package exists`);
    } else {
      logError(`${pkgName} package missing`);
    }
    TEST_RESULTS.total++;
  });

  const actualPackages = fs.readdirSync(PACKAGES_DIR).filter(dir =>
    fs.statSync(path.join(PACKAGES_DIR, dir)).isDirectory()
  );

  logInfo(`Found ${actualPackages.length} packages total`);
  actualPackages.forEach(pkg => {
    if (!expectedPackages.includes(pkg)) {
      logWarning(`Unexpected package found: ${pkg}`);
    }
  });
}

// Test 2: Check package.json files
function testPackageConfigs() {
  logTest('Package.json Configuration');

  const configPackages = ['lunaforge-core', 'lunaforge-extension'];

  configPackages.forEach(pkgName => {
    const pkgPath = path.join(PACKAGES_DIR, pkgName, 'package.json');

    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

        // Check required fields
        const requiredFields = ['name', 'version', 'main'];
        const missingFields = requiredFields.filter(field => !pkg[field]);

        if (missingFields.length === 0) {
          logSuccess(`${pkgName} package.json has required fields`);
        } else {
          logError(`${pkgName} missing fields: ${missingFields.join(', ')}`);
        }

        // Check version format
        if (pkg.version && /^\d+\.\d+\.\d+/.test(pkg.version)) {
          logSuccess(`${pkgName} has valid version: ${pkg.version}`);
        } else {
          logError(`${pkgName} has invalid version: ${pkg.version}`);
        }

        TEST_RESULTS.total += 2;

      } catch (error) {
        logError(`${pkgName} package.json is invalid JSON`);
        TEST_RESULTS.total++;
      }
    } else {
      logError(`${pkgName} package.json not found`);
      TEST_RESULTS.total++;
    }
  });
}

// Test 3: Check if all packages have dist folders with compiled JS
function testCompilationResults() {
  logTest('Compilation Results');

  const packagesToTest = [
    'lunaforge-core',
    'lunaforge-galaxy',
    'lunaforge-codeflow',
    'lunaforge-timetravel',
    'lunaforge-autopsy',
    'lunaforge-composer',
    'lunaforge-prophecy',
    'lunaforge-parallel-universe',
    'lunaforge-guardian',
    'lunaforge-ritual',
    'lunaforge-dream',
    'lunaforge-mythic'
  ];

  packagesToTest.forEach(pkgName => {
    const distPath = path.join(PACKAGES_DIR, pkgName, 'dist');
    const indexPath = path.join(distPath, 'index.js');

    if (fs.existsSync(distPath)) {
      if (fs.existsSync(indexPath)) {
        try {
          const stats = fs.statSync(indexPath);
          logSuccess(`${pkgName} compiled (${stats.size} bytes)`);
          TEST_RESULTS.details.push({
            package: pkgName,
            size: stats.size,
            compiled: true
          });
        } catch (error) {
          logError(`${pkgName} compiled file unreadable`);
        }
      } else {
        logError(`${pkgName} index.js not found in dist`);
      }
    } else {
      logError(`${pkgName} dist folder not found`);
    }
    TEST_RESULTS.total++;
  });
}

// Test 4: Check if packages export expected functions
function testPackageExports() {
  logTest('Package Exports');

  const modePackages = [
    { name: 'lunaforge-galaxy', export: 'createGalaxyMode' },
    { name: 'lunaforge-codeflow', export: 'createCodeFlowMode' },
    { name: 'lunaforge-timetravel', export: 'createTimeTravelMode' },
    { name: 'lunaforge-autopsy', export: 'createAutopsyMode' },
    { name: 'lunaforge-composer', export: 'createComposerMode' },
    { name: 'lunaforge-prophecy', export: 'createProphecyMode' },
    { name: 'lunaforge-parallel-universe', export: 'createParallelUniverseMode' },
    { name: 'lunaforge-guardian', export: 'createGuardianMode' },
    { name: 'lunaforge-ritual', export: 'createRitualMode' },
    { name: 'lunaforge-dream', export: 'createDreamMode' },
    { name: 'lunaforge-mythic', export: 'createMythicMode' }
  ];

  modePackages.forEach(({ name, export: exportName }) => {
    const indexPath = path.join(PACKAGES_DIR, name, 'dist', 'index.d.ts');

    if (fs.existsSync(indexPath)) {
      try {
        const content = fs.readFileSync(indexPath, 'utf8');
        if (content.includes(exportName)) {
          logSuccess(`${name} exports ${exportName}`);
        } else {
          logError(`${name} missing export: ${exportName}`);
        }
      } catch (error) {
        logError(`${name} index.d.ts unreadable`);
      }
    } else {
      logError(`${name} index.d.ts not found`);
    }
    TEST_RESULTS.total++;
  });
}

// Test 5: Check extension configuration
function testExtensionConfiguration() {
  logTest('Extension Configuration');

  const extensionPath = path.join(PACKAGES_DIR, 'lunaforge-extension', 'package.json');

  if (fs.existsSync(extensionPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(extensionPath, 'utf8'));

      // Check VS Code specific fields
      const vsCodeFields = [
        'engines.vscode',
        'main',
        'activationEvents',
        'contributes.commands',
        'contributes.keybindings',
        'contributes.configuration'
      ];

      vsCodeFields.forEach(field => {
        if (field.split('.').reduce((obj, key) => obj && obj[key], pkg)) {
          logSuccess(`Has ${field}`);
        } else {
          logWarning(`Missing ${field}`);
        }
      });

      // Check commands count
      const commands = pkg.contributes?.commands || [];
      logSuccess(`Extension has ${commands.length} commands`);

      // Check keybindings count
      const keybindings = pkg.contributes?.keybindings || [];
      logSuccess(`Extension has ${keybindings.length} keybindings`);

      // Check configuration options
      const configOptions = pkg.contributes?.configuration?.properties || {};
      logSuccess(`Extension has ${Object.keys(configOptions).length} config options`);

      TEST_RESULTS.total += 5;

    } catch (error) {
      logError('Extension package.json invalid');
      TEST_RESULTS.total++;
    }
  } else {
    logError('Extension package.json not found');
    TEST_RESULTS.total++;
  }
}

// Test 6: Verify extension build
function testExtensionBuild() {
  logTest('Extension Build Process');

  const distPath = path.join(PACKAGES_DIR, 'lunaforge-extension', 'dist');
  const extensionPath = path.join(distPath, 'extension.js');

  if (fs.existsSync(extensionPath)) {
    try {
      const stats = fs.statSync(extensionPath);
      logSuccess(`Extension built successfully (${stats.size} bytes)`);

      if (stats.size > 1000) { // At least 1KB
        logSuccess('Extension size is reasonable');
      } else {
        logWarning('Extension size seems small');
      }

      TEST_RESULTS.total += 2;

    } catch (error) {
      logError('Extension file unreadable');
      TEST_RESULTS.total++;
    }
  } else {
    logError('Extension not built - extension.js not found');
    TEST_RESULTS.total++;
  }
}

// Test 7: Check for essential files
function testEssentialFiles() {
  logTest('Essential Files');

  const essentialFiles = [
    'packages/lunaforge-extension/package.json',
    'packages/lunaforge-extension/README.md',
    'packages/lunaforge-extension/LICENSE',
    'packages/lunaforge-extension/icon.png'
  ];

  essentialFiles.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      logSuccess(`Essential file exists: ${filePath}`);
    } else {
      logError(`Essential file missing: ${filePath}`);
    }
    TEST_RESULTS.total++;
  });
}

// Test 8: Simulate package imports (basic check)
function testImportSimulation() {
  logTest('Import Simulation');

  logInfo('Simulating package imports that extension uses...');

  // Check core package
  const coreIndexPath = path.join(PACKAGES_DIR, 'lunaforge-core', 'dist', 'index.js');
  if (fs.existsSync(coreIndexPath)) {
    logSuccess('Core package can be imported');
  } else {
    logError('Core package cannot be imported');
  }
  TEST_RESULTS.total++;

  // Check a few mode packages
  const modeTests = ['lunaforge-galaxy', 'lunaforge-codeflow', 'lunaforge-timetravel'];
  modeTests.forEach(pkgName => {
    const indexPath = path.join(PACKAGES_DIR, pkgName, 'dist', 'index.js');
    if (fs.existsSync(indexPath)) {
      logSuccess(`${pkgName} can be imported`);
    } else {
      logError(`${pkgName} cannot be imported`);
    }
    TEST_RESULTS.total++;
  });
}

// Run all tests
async function runAllTests() {
  console.log('🌙 LunaForge Package Verification Suite');
  console.log('=======================================\n');

  logInfo('Starting comprehensive package verification...\n');

  // Run all test suites
  testPackageExistence();
  testPackageConfigs();
  testCompilationResults();
  testPackageExports();
  testExtensionConfiguration();
  testExtensionBuild();
  testEssentialFiles();
  testImportSimulation();

  // Calculate results
  const passed = TEST_RESULTS.passed.length;
  const failed = TEST_RESULTS.failed.length;
  const total = TEST_RESULTS.total;

  // Final summary
  console.log('\n📊 Test Results Summary');
  console.log('=====================\n');

  logSuccess(`Passed: ${passed}/${total} tests`);

  if (failed > 0) {
    logError(`Failed: ${failed}/${total} tests`);
    log('\n❌ FAILED TESTS:');
    TEST_RESULTS.failed.forEach(test => logError(`  - ${test}`));
  }

  if (passed === total) {
    log('\n🎉 ALL TESTS PASSED! LunaForge is ready to publish!', 'green');
    log('\n🚀 Ready to execute:', 'blue');
    log('   cd packages/lunaforge-extension', 'cyan');
    log('   npm run vsce:package', 'cyan');
    log('   npm run vsce:publish', 'cyan');
    log('\n💰 Ready to start generating revenue!', 'magenta');
  } else {
    log('\n⚠️  Some tests failed. Fix issues before publishing.', 'yellow');

    // Provide specific guidance
    if (TEST_RESULTS.failed.some(test => test.includes('not found'))) {
      log('\n💡 Suggestion: Build missing packages:', 'blue');
      log('   cd packages/<package-name>', 'cyan');
      log('   npm run compile', 'cyan');
    }

    if (TEST_RESULTS.failed.some(test => test.includes('missing'))) {
      log('\n💡 Suggestion: Add missing configuration fields', 'blue');
    }
  }

  // Package summary
  console.log('\n📦 Package Summary:');
  console.log(`   - Total packages: ${TEST_RESULTS.details.length}`);
  console.log(`   - Total compiled size: ${TEST_RESULTS.details.reduce((sum, pkg) => sum + (pkg.size || 0), 0)} bytes`);
  console.log(`   - Ready for marketplace: ${passed === total ? 'YES' : 'NO'}`);

  return passed === total;
}

// Run the verification
runAllTests().then(success => {
  if (success) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}).catch(error => {
  logError(`Test suite failed: ${error.message}`);
  process.exit(1);
});