# 🧪 Luna Agents Test Suite

Comprehensive testing framework for all Luna agent commands and tools in the marketplace.

## 📋 Overview

This test suite provides complete validation for the Luna Agents marketplace, including:

- **Command Validation**: Testing all 19 Luna agent commands
- **Implementation Testing**: Validating JavaScript implementations
- **Integration Testing**: Ensuring components work together
- **Error Handling**: Testing edge cases and error conditions
- **Performance Testing**: Validating efficiency and speed
- **Documentation Testing**: Ensuring consistency and completeness

## 🚀 Quick Start

### Run All Tests
```bash
cd tests
npm test
# or
node run-tests.js
```

### Run Specific Test Categories
```bash
# Test only shortcuts functionality
npm run test:shortcuts

# Test only command documentation
npm run test:commands

# Run tests and save reports
npm run test:save
```

## 📁 Test Structure

```
tests/
├── framework/
│   └── luna-test-framework.js    # Custom test framework
├── commands/
│   ├── luna-shortcuts.test.js    # Shortcuts command tests
│   └── luna-all-commands.test.js # All commands validation
├── run-tests.js                  # Main test runner
├── package.json                  # Test configuration
└── README.md                     # This file
```

## 🧪 Test Categories

### 1. Luna Shortcuts Tests (`luna-shortcuts.test.js`)

Comprehensive testing for the luna-shortcuts command functionality:

#### Initialization Tests
- ✅ Default shortcuts creation
- ✅ Directory structure setup
- ✅ Configuration file generation

#### Shortcut Management
- ✅ List all shortcuts
- ✅ Create new shortcuts
- ✅ Show shortcut details
- ✅ Execute shortcuts
- ✅ Update shortcuts
- ✅ Delete shortcuts
- ✅ Category filtering

#### Workflow Testing
- ✅ Create workflows
- ✅ List workflows
- ✅ Execute workflows
- ✅ Delete workflows

#### History & Statistics
- ✅ Execution history
- ✅ History clearing
- ✅ Usage statistics

#### Search Functionality
- ✅ Search by name
- ✅ Search by tag
- ✅ Search by description

#### Configuration Management
- ✅ Show configuration
- ✅ Update configuration
- ✅ Export shortcuts
- ✅ Import shortcuts

#### Error Handling
- ✅ Non-existent shortcuts
- ✅ Invalid commands
- ✅ Missing arguments
- ✅ Corrupted files
- ✅ Permission errors

### 2. All Commands Tests (`luna-all-commands.test.js`)

Validation of the entire Luna Agents marketplace:

#### Documentation Testing
- ✅ All 19 command documentation files exist
- ✅ Valid markdown format
- ✅ Consistent structure
- ✅ Required sections present

#### Implementation Testing
- ✅ luna-shortcuts.js implementation
- ✅ validate-plugin.js implementation
- ✅ link-plugin.js implementation
- ✅ Script executability

#### Integration Testing
- ✅ AGENTS_OVERVIEW.md validity
- ✅ Correct agent count (15+ agents)
- ✅ MCP tools integration
- ✅ Agent directory structure

#### Error Handling
- ✅ Missing file handling
- ✅ JSON validation
- ✅ File permissions
- ✅ Naming conventions
- ✅ Command functionality

#### Performance Testing
- ✅ File loading efficiency
- ✅ Reasonable file sizes
- ✅ Memory usage

## 📊 Test Reports

### Console Output
```
🧪 Starting Luna Agents Test Suite
============================================================
📅 Run at: 11/4/2024, 2:30:45 PM
📁 Root Directory: /path/to/luna-agents
============================================================

🧪 Running Luna Shortcuts Tests
----------------------------------------
✅ should initialize with default shortcuts (15ms)
✅ should create .luna directory if not exists (2ms)
✅ should list all shortcuts (8ms)
...
✅ Luna Shortcuts Tests completed (1,234ms)

🧪 Running Luna All Commands Tests
----------------------------------------
✅ should have all command documentation files (45ms)
✅ should have valid markdown format in command files (123ms)
...
✅ Luna All Commands Tests completed (567ms)

============================================================
📊 Luna Agents Test Suite - Final Report
============================================================
✅ PASSED Luna Shortcuts Tests: 45/45 (100.0%)
✅ PASSED Luna All Commands Tests: 23/23 (100.0%)
------------------------------------------------------------
📈 Summary:
   Total Tests: 68
   ✅ Passed: 68
   ❌ Failed: 0
   ⏭️  Skipped: 0
   ⏱️  Duration: 1.80s
   📊 Success Rate: 100.0%

🎯 Overall Status: ✅ ALL TESTS PASSED
============================================================
```

### HTML Report
The test suite generates comprehensive HTML reports with:
- 📊 Visual metrics and charts
- 🎨 Modern, responsive design
- 📱 Mobile-friendly layout
- 🔍 Detailed test results
- ⏱️ Performance metrics

### JSON Report
Machine-readable reports for CI/CD integration:
```json
{
  "summary": {
    "total": 68,
    "passed": 68,
    "failed": 0,
    "skipped": 0,
    "successRate": 100.0,
    "duration": 1800
  },
  "suites": {
    "Luna Shortcuts Tests": {
      "results": {...},
      "duration": 1234,
      "passed": 45,
      "failed": 0,
      "skipped": 0,
      "total": 45
    }
  }
}
```

## 🔧 Configuration

### Test Configuration Options
```javascript
// test.config.js (optional)
module.exports = {
  timeout: 30000,        // Test timeout in ms
  retries: 3,            // Number of retries for failed tests
  parallel: false,       // Run tests in parallel
  slowThreshold: 1000,   // Slow test threshold in ms
  reporters: ['console', 'html', 'json']
};
```

### Environment Variables
```bash
LUNA_TEST_TIMEOUT=30000      # Test timeout
LUNA_TEST_RETRIES=3          # Retry attempts
LUNA_TEST_SLOW=1000          # Slow test threshold
LUNA_TEST_REPORTS_DIR=./reports # Reports directory
```

## 🎯 Usage Examples

### Basic Usage
```bash
# Run all tests
node run-tests.js

# Run with saved reports
node run-tests.js --save

# Filter tests
node run-tests.js --filter=shortcuts
```

### Advanced Usage
```bash
# Run specific test category
npm run test:shortcuts

# CI/CD integration
npm run ci

# Development with watch mode
npm run test:watch
```

### Programmatic Usage
```javascript
const { LunaTestRunner } = require('./run-tests');

const runner = new LunaTestRunner();
const results = await runner.runAllTests({
  filter: 'shortcuts',
  saveResults: true
});

console.log(`Success rate: ${results.summary.successRate}%`);
```

## 🐛 Debugging

### Running Individual Tests
```bash
# Debug shortcuts tests
node --inspect-brk run-tests.js --filter=shortcuts

# Debug with additional logging
DEBUG=* node run-tests.js --filter=shortcuts
```

### Test Output Analysis
- ✅ **Green**: Test passed
- ❌ **Red**: Test failed with error
- ⏭️ **Yellow**: Test skipped
- ⚠️ **Orange**: Warning (test passed but with issues)

### Common Issues
1. **Permission Errors**: Ensure test directory has write permissions
2. **Node Version**: Requires Node.js 16.0.0 or higher
3. **Memory Usage**: Some tests may require increased Node.js memory limit
4. **Timeouts**: Increase timeout for slow systems

## 🔄 CI/CD Integration

### GitHub Actions
```yaml
name: Luna Agents Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd tests && npm ci
      - run: cd tests && npm run ci
      - uses: actions/upload-artifact@v3
        with:
          name: test-reports
          path: tests/test-reports/
```

### Jenkins Pipeline
```groovy
pipeline {
  agent any
  stages {
    stage('Test') {
      steps {
        sh 'cd tests && npm ci'
        sh 'cd tests && npm run ci'
      }
      post {
        always {
          publishHTML([
            allowMissing: false,
            alwaysLinkToLastBuild: true,
            keepAll: true,
            reportDir: 'tests/test-reports',
            reportFiles: '*.html',
            reportName: 'Luna Test Report'
          ])
        }
      }
    }
  }
}
```

## 📈 Performance Metrics

### Baseline Performance
- **Total Tests**: 68 tests
- **Execution Time**: ~2 seconds
- **Memory Usage**: <50MB
- **Success Rate**: 100% (target)

### Performance Benchmarks
- Fast Test Suite: <500ms
- Medium Test Suite: <1s
- Slow Test Suite: <2s
- Overall Suite: <3s

## 🤝 Contributing

### Adding New Tests
1. Create test file in appropriate directory
2. Use LunaTestFramework for consistency
3. Follow naming conventions
4. Add documentation
5. Update README if needed

### Test Writing Guidelines
```javascript
// Use descriptive test names
this.framework.addTest(suite, 'should validate specific functionality', async () => {
  // Arrange
  const testData = setupTestData();
  
  // Act
  const result = await executeTest(testData);
  
  // Assert
  this.framework.assert(result.success, 'Test should succeed');
  this.framework.assertEqual(result.value, expected, 'Values should match');
});
```

### Code Quality
- Use clear, descriptive test names
- Test one thing per test
- Use setup/teardown hooks appropriately
- Handle async/await correctly
- Provide meaningful error messages

## 📚 API Reference

### LunaTestFramework
```javascript
class LunaTestFramework {
  createTestSuite(name)        // Create test suite
  addTest(suite, name, fn)     // Add test to suite
  runTests(filter)             // Run all tests
  assert(condition, message)   // Assertion helper
  executeCommand(cmd, options) // Execute shell command
  fileExists(path)             // Check file existence
  readFile(path)               // Read file content
}
```

### LunaTestRunner
```javascript
class LunaTestRunner {
  runAllTests(options)         // Run all test suites
  generateFinalReport()        // Generate final report
  saveResults()                // Save results to files
}
```

## 📄 License

MIT License - see [LICENSE](../LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/luna-agents/luna-agents-marketplace/issues)
- **Discussions**: [GitHub Discussions](https://github.com/luna-agents/luna-agents-marketplace/discussions)
- **Documentation**: [Luna Agents Docs](https://docs.luna-agents.com)

---

🧪 **Built with ❤️ by the Luna Agents Team**

*Comprehensive testing for reliable Luna agent functionality*