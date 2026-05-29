#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function showHeader() {
  log('🚀 SDLC Production System E2E Test Runner', 'cyan');
  log('=' .repeat(50), 'cyan');
  log('');
}

function showUsage() {
  log('Usage: node run-tests.js [options]', 'yellow');
  log('');
  log('Options:');
  log('  --help, -h          Show this help message');
  log('  --landing-page      Run only landing page tests');
  log('  --infrastructure    Run only infrastructure tests');
  log('  --api               Run only API endpoint tests');
  log('  --database          Run only database tests');
  log('  --e2e               Run only end-to-end tests');
  log('  --performance       Run only performance tests');
  log('  --headed            Run tests with browser UI');
  log('  --debug             Run tests in debug mode');
  log('  --report            Show test report after completion');
  log('  --clean             Clean test results before running');
  log('  --install           Install Playwright browsers');
  log('');
  log('Examples:');
  log('  node run-tests.js                    # Run all tests');
  log('  node run-tests.js --landing-page     # Run landing page tests only');
  log('  node run-tests.js --headed           # Run with browser UI');
  log('  node run-tests.js --clean --report   # Clean results and show report');
}

async function checkDependencies() {
  log('🔍 Checking dependencies...', 'yellow');

  const packageJsonPath = path.join(__dirname, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    log('❌ package.json not found. Please run this from the tests directory.', 'red');
    return false;
  }

  const nodeModulesPath = path.join(__dirname, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    log('📦 Dependencies not found. Installing...', 'yellow');
    await runCommand('npm', ['install'], { cwd: __dirname });
  }

  log('✅ Dependencies ready', 'green');
  return true;
}

async function installBrowsers() {
  log('🌐 Installing Playwright browsers...', 'yellow');
  try {
    await runCommand('npx', ['playwright', 'install'], { cwd: __dirname });
    log('✅ Browsers installed successfully', 'green');
    return true;
  } catch (error) {
    log('❌ Failed to install browsers', 'red');
    log(error.message, 'red');
    return false;
  }
}

async function cleanResults() {
  log('🧹 Cleaning test results...', 'yellow');
  const directoriesToClean = ['test-results', 'reports'];

  for (const dir of directoriesToClean) {
    const dirPath = path.join(__dirname, dir);
    if (fs.existsSync(dirPath)) {
      try {
        fs.rmSync(dirPath, { recursive: true, force: true });
        log(`   Cleaned ${dir}`, 'green');
      } catch (error) {
        log(`   Failed to clean ${dir}: ${error.message}`, 'red');
      }
    }
  }
}

function getTestCommand(args) {
  let testPath = 'tests/';
  const playwrightArgs = [];

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--landing-page':
        testPath = 'tests/landing-page/';
        break;
      case '--infrastructure':
        testPath = 'tests/infrastructure/';
        break;
      case '--api':
        testPath = 'tests/api/';
        break;
      case '--database':
        testPath = 'tests/database/';
        break;
      case '--e2e':
        testPath = 'tests/e2e/';
        break;
      case '--performance':
        testPath = 'tests/performance/';
        break;
      case '--headed':
        playwrightArgs.push('--headed');
        break;
      case '--debug':
        playwrightArgs.push('--debug');
        break;
      case '--report':
        // Handle report after tests complete
        break;
    }
  }

  const command = 'npx';
  const commandArgs = ['playwright', 'test', testPath, ...playwrightArgs];

  return { command, commandArgs };
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function showReport() {
  const reportPath = path.join(__dirname, 'test-results', 'html-report', 'index.html');
  if (fs.existsSync(reportPath)) {
    log('📊 Opening test report...', 'yellow');
    try {
      await runCommand('npx', ['playwright', 'show-report'], { cwd: __dirname });
    } catch (error) {
      log(`   Could not open report automatically: ${error.message}`, 'yellow');
      log(`   Report available at: file://${reportPath}`, 'cyan');
    }
  } else {
    log('⚠️ No test report found. Run tests first to generate a report.', 'yellow');
  }
}

async function main() {
  const args = process.argv.slice(2);

  // Show help
  if (args.includes('--help') || args.includes('-h')) {
    showHeader();
    showUsage();
    return;
  }

  showHeader();

  // Check for install flag
  if (args.includes('--install')) {
    await installBrowsers();
    return;
  }

  // Check dependencies
  const depsReady = await checkDependencies();
  if (!depsReady) {
    process.exit(1);
  }

  // Clean results if requested
  if (args.includes('--clean')) {
    cleanResults();
  }

  // Get test command
  const { command, commandArgs } = getTestCommand(args);

  log(`🧪 Running tests: ${commandArgs.join(' ')}`, 'blue');
  log('');

  const startTime = Date.now();

  try {
    // Run tests
    await runCommand(command, commandArgs, { cwd: __dirname });

    const testTime = Date.now() - startTime;
    log(``, 'white');
    log(`✅ Tests completed successfully in ${Math.round(testTime / 1000)}s`, 'green');

    // Show report if requested
    if (args.includes('--report')) {
      await showReport();
    }

    // Show summary
    log('', 'white');
    log('📋 Test Results Summary:', 'cyan');
    log(`   📊 HTML Report: test-results/html-report/index.html`, 'white');
    log(`   📄 JSON Results: test-results/results.json`, 'white');
    log(`   🎥 Videos: test-results/videos/`, 'white');
    log(`   📸 Screenshots: test-results/screenshots/`, 'white');

  } catch (error) {
    const testTime = Date.now() - startTime;
    log(``, 'white');
    log(`❌ Tests failed after ${Math.round(testTime / 1000)}s`, 'red');
    log(`   Error: ${error.message}`, 'red');

    // Still show report if requested even if tests failed
    if (args.includes('--report')) {
      await showReport();
    }

    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  log(`❌ Uncaught error: ${error.message}`, 'red');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`❌ Unhandled promise rejection: ${reason}`, 'red');
  process.exit(1);
});

// Run main function
if (require.main === module) {
  main().catch(error => {
    log(`❌ Fatal error: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { main };