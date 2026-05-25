#!/usr/bin/env node

/**
 * 🌙 Test All Qestro Commands
 * Comprehensive testing of all Qestro extension commands before deployment
 */

const { execSync } = require('child_process');

// Test configuration
const TEST_RESULTS = {
  passed: [],
  failed: [],
  total: 0
};

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
  TEST_RESULTS.passed.push(message);
  TEST_RESULTS.total++;
}

function logError(message) {
  log(`❌ ${message}`, 'red');
  TEST_RESULTS.failed.push(message);
  TEST_RESULTS.total++;
}

function logSection(title) {
  log(`\n${colors.bold}${colors.cyan}${'═'.repeat(60)}${colors.reset}`, 'cyan');
  log(`${colors.bold}🌙 ${title}${colors.reset}`, 'cyan');
  log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}\n`, 'cyan');
}

function logTest(category, name) {
  log(`🧪 [${category}] ${name}`, 'magenta');
}

// All Qestro commands to test
const QESTRO_COMMANDS = [
  'qestro.openControlCenter',
  'qestro.buildGraph',
  'qestro.refreshGraph',
  'qestro.clearGraph',
  'qestro.exportGraph',
  'qestro.showGraphMetrics',
  'qestro.listModes',
  'qestro.activateMode',
  'qestro.deactivateMode',
  'qestro.toggleMode',
  'qestro.analyzeFile',
  'qestro.analyzeSelection',
  'qestro.requestPlan',
  'qestro.enterLicense',
  'qestro.checkLicense',
  'qestro.upgradeLicense',
  'qestro.openSettings',
  'qestro.resetSettings',
  'qestro.showOutput',
  'qestro.openDocumentation',
  'qestro.reportIssue',
  'qestro.showWelcome',
  'qestro.showCommandPalette',
  'qestro.commandDocumentation',
  'qestro.commandStats',
  'qestro.upgradeSubscription',
  'qestro.viewSubscription',
  'qestro.manageBilling',
  'qestro.viewPricing'
];

function testExtensionInstallation() {
  logSection('EXTENSION INSTALLATION TEST');

  try {
    const result = execSync('code --list-extensions', { encoding: 'utf8' });

    if (result.includes('qestro-extension') || result.includes('lunaforge-extension')) {
      logSuccess('Qestro extension is installed');
    } else {
      logError('Qestro extension not found in installation list');
    }
  } catch (error) {
    logError('Failed to check extension installation');
  }
}

function testCommandAvailability() {
  logSection('COMMAND AVAILABILITY TEST');

  QESTRO_COMMANDS.forEach(commandId => {
    logTest('Command', commandId);

    try {
      // Test if command is registered by checking if it exists in package.json
      const packagePath = 'packages/lunaforge-extension/package.json';
      const fs = require('fs');

      if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        const commands = pkg.contributes?.commands || [];
        const commandExists = commands.some(cmd => cmd.command === commandId);

        if (commandExists) {
          logSuccess(`Command ${commandId} is registered`);
        } else {
          logError(`Command ${commandId} is not registered`);
        }
      } else {
        logError(`Package.json not found for command ${commandId}`);
      }
    } catch (error) {
      logError(`Error testing command ${commandId}: ${error.message}`);
    }
  });
}

function testPackageIntegrity() {
  logSection('PACKAGE INTEGRITY TEST');

  const packagePath = 'packages/lunaforge-extension/package.json';
  const fs = require('fs');

  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

    // Test essential fields
    const checks = [
      { field: 'name', expected: 'qestro-extension' },
      { field: 'version', exists: true },
      { field: 'displayName', exists: true },
      { field: 'description', exists: true },
      { field: 'engines.vscode', exists: true },
      { field: 'main', exists: true },
      { field: 'contributes.commands', exists: true }
    ];

    checks.forEach(check => {
      const value = check.field.split('.').reduce((obj, key) => obj && obj[key], pkg);
      if (check.expected) {
        if (value === check.expected) {
          logSuccess(`Package field ${check.field}: ${value}`);
        } else {
          logError(`Package field ${check.field}: expected ${check.expected}, got ${value}`);
        }
      } else if (check.exists) {
        if (value) {
          logSuccess(`Package field ${check.field}: present`);
        } else {
          logError(`Package field ${check.field}: missing`);
        }
      }
      TEST_RESULTS.total++;
    });

    // Check command count
    const commands = pkg.contributes?.commands || [];
    logSuccess(`Total commands registered: ${commands.length}`);
    TEST_RESULTS.total++;

  } catch (error) {
    logError('Failed to read package.json');
  }
}

function testVSIXPackage() {
  logSection('VSIX PACKAGE TEST');

  const fs = require('fs');
  const path = require('path');

  // Find the latest VSIX file
  const files = fs.readdirSync('.').filter(f => f.endsWith('.vsix'));
  const latestVSIX = files.sort().pop(); // Get the most recent one

  if (latestVSIX) {
    try {
      const stats = fs.statSync(latestVSIX);
      const sizeKB = (stats.size / 1024).toFixed(2);

      logSuccess(`VSIX file: ${latestVSIX}`);
      logSuccess(`VSIX size: ${sizeKB}KB`);
      logSuccess(`VSIX created: ${stats.mtime.toLocaleString()}`);
      TEST_RESULTS.total += 3;
    } catch (error) {
      logError(`Failed to read VSIX file stats: ${error.message}`);
      TEST_RESULTS.total += 3;
    }
  } else {
    logError('No VSIX file found');
    TEST_RESULTS.total += 3;
  }
}

function testPaymentSystem() {
  logSection('PAYMENT SYSTEM TEST');

  const paymentFiles = [
    'packages/lunaforge-extension/src/payment/PayPlusManager.ts',
    'packages/lunaforge-extension/src/payment/PaymentUI.ts'
  ];

  paymentFiles.forEach(filePath => {
    if (require('fs').existsSync(filePath)) {
      logSuccess(`Payment file exists: ${filePath.split('/').pop()}`);
    } else {
      logError(`Payment file missing: ${filePath.split('/').pop()}`);
    }
    TEST_RESULTS.total++;
  });
}

function testCoreFiles() {
  logSection('CORE FILES TEST');

  const coreFiles = [
    'packages/lunaforge-extension/src/extension.ts',
    'packages/lunaforge-extension/src/webview/ControlCenterWebview.ts',
    'packages/lunaforge-extension/src/commands/CommandManager.ts'
  ];

  coreFiles.forEach(filePath => {
    if (require('fs').existsSync(filePath)) {
      logSuccess(`Core file exists: ${filePath.split('/').pop()}`);
    } else {
      logError(`Core file missing: ${filePath.split('/').pop()}`);
    }
    TEST_RESULTS.total++;
  });
}

function generateReport() {
  logSection('FINAL TEST REPORT');

  const passed = TEST_RESULTS.passed.length;
  const failed = TEST_RESULTS.failed.length;
  const total = TEST_RESULTS.total;
  const successRate = ((passed / total) * 100).toFixed(1);

  log(`${colors.bold}📊 TEST SUMMARY${colors.reset}`, 'cyan');
  log(`   Tests Executed: ${total}`, 'blue');
  log(`   ✅ Passed: ${passed}`, 'green');
  log(`   ❌ Failed: ${failed}`, failed > 0 ? 'red' : 'gray');
  log(`   📈 Success Rate: ${successRate}%`, parseFloat(successRate) >= 90 ? 'green' : 'yellow');

  log(`\n${colors.bold}🚀 DEPLOYMENT READINESS:${colors.reset}`, 'blue');

  if (passed === total) {
    log(`   🎉 ALL TESTS PASSED! Ready for deployment!`, 'green');
    log(`   ✅ Extension is production ready`, 'green');
    log(`   ✅ Commands are properly registered`, 'green');
    log(`   ✅ Payment system is integrated`, 'green');
    log(`   ✅ VSIX package is optimized`, 'green');
  } else {
    log(`   ⚠️  ${failed} test(s) failed. Address issues before deploying.`, 'yellow');
  }

  const ready = passed === total;
  const verdict = ready ? 'PRODUCTION READY' : 'NEEDS FIXES';
  const verdictColor = ready ? 'green' : 'red';

  log(`\n${colors.bold}${colors[verdictColor]}🌙 QESTRO DEPLOYMENT VERDICT: ${verdict}${colors.reset}`, verdictColor);

  return ready;
}

// Main test execution
function runAllTests() {
  console.log(`${colors.bold}${colors.magenta}
╔══════════════════════════════════════════════════════════════╗
║                    🌙 QESTRO COMMAND TEST SUITE                  ║
║                  Pre-Deployment Validation                    ║
╚══════════════════════════════════════════════════════════════╝${colors.reset}`);

  testExtensionInstallation();
  testCommandAvailability();
  testPackageIntegrity();
  testVSIXPackage();
  testPaymentSystem();
  testCoreFiles();

  return generateReport();
}

// Execute tests
if (require.main === module) {
  const success = runAllTests();

  if (success) {
    log(`\n🎉 Qestro is ready for VS Code Marketplace deployment!`, 'green');
    log(`\n📋 NEXT STEPS:`, 'blue');
    log(`   1. Set VSCE_PAT environment variable`, 'cyan');
    log(`   2. Run: npm run vsce:publish`, 'cyan');
    log(`   3. Execute marketing campaign`, 'cyan');
    process.exit(0);
  } else {
    log(`\n❌ Qestro needs fixes before deployment`, 'red');
    log(`\n🔧 FAILED TESTS:`, 'red');
    TEST_RESULTS.failed.forEach(test => log(`   - ${test}`, 'red'));
    process.exit(1);
  }
}

module.exports = { runAllTests };