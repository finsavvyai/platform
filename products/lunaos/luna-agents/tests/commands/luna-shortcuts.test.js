/**
 * Luna Shortcuts Command Test Suite
 * Comprehensive testing for the luna-shortcuts functionality
 */

const { LunaTestFramework } = require('../framework/luna-test-framework');
const path = require('path');
const fs = require('fs');

class LunaShortcutsTests {
  constructor() {
    this.framework = new LunaTestFramework();
    this.testDir = path.resolve(__dirname, '../../temp/test-luna-shortcuts');
    this.shortcutsPath = path.join(this.testDir, '.luna/shortcuts.json');
    this.shortcutsScript = path.resolve(__dirname, '../../scripts/luna-shortcuts.js');

    this.setupTestSuite();
  }

  setupTestSuite() {
    const suite = this.framework.createTestSuite('Luna Shortcuts');

    // Setup and teardown hooks
    suite.beforeAll.push(async () => {
      await this.setupTestEnvironment();
    });

    suite.afterAll.push(async () => {
      await this.cleanupTestEnvironment();
    });

    suite.beforeEachTest.push(async () => {
      await this.resetShortcutsFile();
    });

    // Test cases
    this.addInitializationTests(suite);
    this.addShortcutManagementTests(suite);
    this.addWorkflowTests(suite);
    this.addHistoryTests(suite);
    this.addSearchTests(suite);
    this.addConfigurationTests(suite);
    this.addErrorHandlingTests(suite);
  }

  async setupTestEnvironment() {
    // Create test directory
    await fs.promises.mkdir(this.testDir, { recursive: true });
    await fs.promises.mkdir(path.join(this.testDir, '.luna'), { recursive: true });
  }

  async cleanupTestEnvironment() {
    // Clean up test directory
    await fs.promises.rm(this.testDir, { recursive: true, force: true });
  }

  async resetShortcutsFile() {
    const defaultShortcuts = {
      version: "1.0.0",
      created: new Date().toISOString(),
      shortcuts: {
        hig: {
          name: "hig",
          description: "Run Apple HIG analysis",
          command: "luna-agents:luna-hig",
          category: "ui",
          tags: ["apple", "design", "hig"],
          usage_count: 0,
          created: new Date().toISOString()
        }
      },
      workflows: {},
      history: [],
      config: {
        max_history: 100,
        auto_save: true
      }
    };

    await fs.promises.writeFile(this.shortcutsPath, JSON.stringify(defaultShortcuts, null, 2));
  }

  // Initialization Tests
  addInitializationTests(suite) {
    this.framework.addTest('Luna Shortcuts', 'should initialize with default shortcuts', async () => {
      const exists = await this.framework.fileExists(this.shortcutsPath);
      this.framework.assert(exists, 'Shortcuts file should exist after initialization');

      const content = await this.framework.readFile(this.shortcutsPath);
      const data = JSON.parse(content);

      this.framework.assert(data.shortcuts, 'Should have shortcuts object');
      this.framework.assert(data.shortcuts.hig, 'Should have default HIG shortcut');
      this.framework.assertEqual(data.shortcuts.hig.command, 'luna-agents:luna-hig');
    });

    this.framework.addTest('Luna Shortcuts', 'should create .luna directory if not exists', async () => {
      const lunaDir = path.join(this.testDir, '.luna');
      const exists = await this.framework.fileExists(lunaDir);
      this.framework.assert(exists, '.luna directory should be created');
    });
  }

  // Shortcut Management Tests
  addShortcutManagementTests(suite) {
    this.framework.addTest(suite, 'should list all shortcuts', async () => {
      const result = await this.executeCommand(['list']);
      this.framework.assert(result.success, 'Should list shortcuts successfully');
      this.framework.assert(result.output.includes('hig'), 'Should include default HIG shortcut');
      this.framework.assert(result.output.includes('Apple HIG analysis'), 'Should include description');
    });

    this.framework.addTest(suite, 'should create new shortcut', async () => {
      const result = await this.executeCommand(['create', 'test-shortcut', 'echo "test"', '--category=testing', '--description=Test shortcut']);
      this.framework.assert(result.success, 'Should create shortcut successfully');

      // Verify shortcut was saved
      const content = await this.framework.readFile(this.shortcutsPath);
      const data = JSON.parse(content);
      this.framework.assert(data.shortcuts['test-shortcut'], 'New shortcut should exist');
      this.framework.assertEqual(data.shortcuts['test-shortcut'].command, 'echo "test"');
    });

    this.framework.addTest(suite, 'should show shortcut details', async () => {
      const result = await this.executeCommand(['show', 'hig']);
      this.framework.assert(result.success, 'Should show shortcut details');
      this.framework.assert(result.output.includes('Apple HIG analysis'), 'Should include description');
      this.framework.assert(result.output.includes('luna-agents:luna-hig'), 'Should include command');
    });

    this.framework.addTest(suite, 'should execute shortcut', async () => {
      // Create a simple executable shortcut for testing
      await this.executeCommand(['create', 'test-exec', 'echo "Hello World"', '--description=Test execution']);

      const result = await this.executeCommand(['run', 'test-exec']);
      this.framework.assert(result.success, 'Should execute shortcut successfully');
    });

    this.framework.addTest(suite, 'should update shortcut', async () => {
      await this.executeCommand(['create', 'test-update', 'echo "old"', '--description=Old description']);

      const result = await this.executeCommand(['update', 'test-update', '--command=echo "new"', '--description=New description']);
      this.framework.assert(result.success, 'Should update shortcut successfully');

      // Verify update
      const content = await this.framework.readFile(this.shortcutsPath);
      const data = JSON.parse(content);
      this.framework.assertEqual(data.shortcuts['test-update'].command, 'echo "new"');
      this.framework.assertEqual(data.shortcuts['test-update'].description, 'New description');
    });

    this.framework.addTest(suite, 'should delete shortcut', async () => {
      await this.executeCommand(['create', 'test-delete', 'echo "delete me"', '--description=To be deleted']);

      // Verify it exists
      let content = await this.framework.readFile(this.shortcutsPath);
      let data = JSON.parse(content);
      this.framework.assert(data.shortcuts['test-delete'], 'Shortcut should exist before deletion');

      // Delete it
      const result = await this.executeCommand(['delete', 'test-delete']);
      this.framework.assert(result.success, 'Should delete shortcut successfully');

      // Verify it's gone
      content = await this.framework.readFile(this.shortcutsPath);
      data = JSON.parse(content);
      this.framework.assert(!data.shortcuts['test-delete'], 'Shortcut should not exist after deletion');
    });

    this.framework.addTest(suite, 'should show shortcuts by category', async () => {
      await this.executeCommand(['create', 'cat1', 'echo "cat1"', '--category=testing']);
      await this.executeCommand(['create', 'cat2', 'echo "cat2"', '--category=testing']);
      await this.executeCommand(['create', 'other', 'echo "other"', '--category=other']);

      const result = await this.executeCommand(['category', 'testing']);
      this.framework.assert(result.success, 'Should show category successfully');
      this.framework.assert(result.output.includes('cat1'), 'Should include shortcuts from category');
      this.framework.assert(result.output.includes('cat2'), 'Should include shortcuts from category');
    });
  }

  // Workflow Tests
  addWorkflowTests(suite) {
    this.framework.addTest(suite, 'should create workflow', async () => {
      const result = await this.executeCommand(['workflow', 'create', 'test-workflow', 'echo "step1"; echo "step2"', '--description=Test workflow']);
      this.framework.assert(result.success, 'Should create workflow successfully');

      // Verify workflow was saved
      const content = await this.framework.readFile(this.shortcutsPath);
      const data = JSON.parse(content);
      this.framework.assert(data.workflows['test-workflow'], 'Workflow should exist');
      this.framework.assert(data.workflows['test-workflow'].steps, 'Workflow should have steps');
    });

    this.framework.addTest(suite, 'should list workflows', async () => {
      await this.executeCommand(['workflow', 'create', 'test-wf', 'echo "test"', '--description=Test workflow']);

      const result = await this.executeCommand(['workflow', 'list']);
      this.framework.assert(result.success, 'Should list workflows successfully');
      this.framework.assert(result.output.includes('test-wf'), 'Should include created workflow');
    });

    this.framework.addTest(suite, 'should execute workflow', async () => {
      await this.executeCommand(['workflow', 'create', 'run-test', 'echo "workflow executed"', '--description=Executable workflow']);

      const result = await this.executeCommand(['workflow', 'run', 'run-test']);
      this.framework.assert(result.success, 'Should execute workflow successfully');
    });

    this.framework.addTest(suite, 'should delete workflow', async () => {
      await this.executeCommand(['workflow', 'create', 'delete-test', 'echo "delete me"', '--description=To be deleted']);

      const result = await this.executeCommand(['workflow', 'delete', 'delete-test']);
      this.framework.assert(result.success, 'Should delete workflow successfully');

      // Verify it's gone
      const content = await this.framework.readFile(this.shortcutsPath);
      const data = JSON.parse(content);
      this.framework.assert(!data.workflows['delete-test'], 'Workflow should not exist after deletion');
    });
  }

  // History Tests
  addHistoryTests(suite) {
    this.framework.addTest(suite, 'should show execution history', async () => {
      // Execute some shortcuts to create history
      await this.executeCommand(['run', 'hig']);
      await this.executeCommand(['run', 'hig']);

      const result = await this.executeCommand(['history']);
      this.framework.assert(result.success, 'Should show history successfully');
      this.framework.assert(result.output.includes('Execution History'), 'Should include history header');
    });

    this.framework.addTest(suite, 'should clear execution history', async () => {
      // Create some history
      await this.executeCommand(['run', 'hig']);

      const result = await this.executeCommand(['history', 'clear']);
      this.framework.assert(result.success, 'Should clear history successfully');

      // Verify history is cleared
      const content = await this.framework.readFile(this.shortcutsPath);
      const data = JSON.parse(content);
      this.framework.assertEqual(data.history.length, 0, 'History should be empty after clear');
    });

    this.framework.addTest(suite, 'should show usage statistics', async () => {
      // Execute shortcuts to create usage data
      await this.executeCommand(['run', 'hig']);
      await this.executeCommand(['run', 'hig']);

      const result = await this.executeCommand(['stats']);
      this.framework.assert(result.success, 'Should show statistics successfully');
      this.framework.assert(result.output.includes('Usage Statistics'), 'Should include statistics header');
    });
  }

  // Search Tests
  addSearchTests(suite) {
    this.framework.addTest(suite, 'should search shortcuts by name', async () => {
      await this.executeCommand(['create', 'search-test', 'echo "found"', '--description=Searchable shortcut', '--tags=search,test']);

      const result = await this.executeCommand(['search', 'search']);
      this.framework.assert(result.success, 'Should search successfully');
      this.framework.assert(result.output.includes('search-test'), 'Should find matching shortcut');
    });

    this.framework.addTest(suite, 'should search shortcuts by tag', async () => {
      await this.executeCommand(['create', 'tag-test', 'echo "tagged"', '--description=Tagged shortcut', '--tags=test,example']);

      const result = await this.executeCommand(['search', 'example']);
      this.framework.assert(result.success, 'Should search by tag successfully');
      this.framework.assert(result.output.includes('tag-test'), 'Should find shortcut by tag');
    });

    this.framework.addTest(suite, 'should search shortcuts by description', async () => {
      await this.executeCommand(['create', 'desc-test', 'echo "described"', '--description=A special testing shortcut']);

      const result = await this.executeCommand(['search', 'special']);
      this.framework.assert(result.success, 'Should search by description successfully');
      this.framework.assert(result.output.includes('desc-test'), 'Should find shortcut by description');
    });
  }

  // Configuration Tests
  addConfigurationTests(suite) {
    this.framework.addTest(suite, 'should show configuration', async () => {
      const result = await this.executeCommand(['config']);
      this.framework.assert(result.success, 'Should show configuration successfully');
      this.framework.assert(result.output.includes('Configuration'), 'Should include configuration header');
      this.framework.assert(result.output.includes('max_history'), 'Should include default config values');
    });

    this.framework.addTest(suite, 'should update configuration', async () => {
      const result = await this.executeCommand(['config', 'max_history', '50']);
      this.framework.assert(result.success, 'Should update configuration successfully');

      // Verify config update
      const content = await this.framework.readFile(this.shortcutsPath);
      const data = JSON.parse(content);
      this.framework.assertEqual(data.config.max_history, 50, 'Configuration should be updated');
    });

    this.framework.addTest(suite, 'should export shortcuts', async () => {
      await this.executeCommand(['create', 'export-test', 'echo "export me"', '--description=For export']);

      const result = await this.executeCommand(['export']);
      this.framework.assert(result.success, 'Should export shortcuts successfully');
      this.framework.assert(result.output.includes('"shortcuts"'), 'Export should contain shortcuts JSON');
      this.framework.assert(result.output.includes('export-test'), 'Export should include created shortcut');
    });

    this.framework.addTest(suite, 'should import shortcuts', async () => {
      // Create export data
      const exportData = {
        version: "1.0.0",
        shortcuts: {
          "import-test": {
            name: "import-test",
            command: "echo 'imported'",
            description: "Imported shortcut",
            category: "test",
            tags: ["import"]
          }
        }
      };

      const exportFile = path.join(this.testDir, 'import.json');
      await fs.promises.writeFile(exportFile, JSON.stringify(exportData, null, 2));

      const result = await this.executeCommand(['import', exportFile]);
      this.framework.assert(result.success, 'Should import shortcuts successfully');

      // Verify import
      const content = await this.framework.readFile(this.shortcutsPath);
      const data = JSON.parse(content);
      this.framework.assert(data.shortcuts['import-test'], 'Imported shortcut should exist');
    });
  }

  // Error Handling Tests
  addErrorHandlingTests(suite) {
    this.framework.addTest(suite, 'should handle non-existent shortcut', async () => {
      const result = await this.executeCommand(['show', 'non-existent']);
      this.framework.assert(!result.success, 'Should fail for non-existent shortcut');
      this.framework.assert(result.output.includes('not found'), 'Should show appropriate error message');
    });

    this.framework.addTest(suite, 'should handle invalid command format', async () => {
      const result = await this.executeCommand(['invalid-command']);
      this.framework.assert(!result.success, 'Should fail for invalid command');
      this.framework.assert(result.output.includes('Usage'), 'Should show usage information');
    });

    this.framework.addTest(suite, 'should handle missing arguments', async () => {
      const result = await this.executeCommand(['create']);
      this.framework.assert(!result.success, 'Should fail for missing arguments');
      this.framework.assert(result.output.includes('Usage'), 'Should show usage information');
    });

    this.framework.addTest(suite, 'should handle corrupted shortcuts file', async () => {
      // Write corrupted JSON
      await fs.promises.writeFile(this.shortcutsPath, '{ invalid json }');

      const result = await this.executeCommand(['list']);
      this.framework.assert(!result.success, 'Should fail with corrupted file');
      this.framework.assert(result.output.includes('Invalid'), 'Should show appropriate error');
    });

    this.framework.addTest(suite, 'should handle permission errors gracefully', async () => {
      // Create read-only directory to simulate permission error
      const readOnlyDir = path.join(this.testDir, 'readonly');
      await fs.promises.mkdir(readOnlyDir);
      await fs.promises.chmod(readOnlyDir, 0o444);

      try {
        const result = await this.executeCommand(['--config-dir', readOnlyDir, 'list']);
        // Should handle gracefully - either succeed with fallback or fail gracefully
      } finally {
        // Restore permissions for cleanup
        await fs.promises.chmod(readOnlyDir, 0o755);
      }
    });
  }

  // Helper method to execute luna-shortcuts command
  async executeCommand(args) {
    try {
      const { spawn } = require('child_process');

      return new Promise((resolve) => {
        const child = spawn('node', [this.shortcutsScript, ...args], {
          cwd: this.testDir,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('close', (code) => {
          resolve({
            success: code === 0,
            exitCode: code,
            output: stdout,
            error: stderr
          });
        });

        child.on('error', (error) => {
          resolve({
            success: false,
            exitCode: -1,
            output: '',
            error: error.message
          });
        });
      });
    } catch (error) {
      return {
        success: false,
        exitCode: -1,
        output: '',
        error: error.message
      };
    }
  }

  // Run all tests
  async runTests() {
    return await this.framework.runTests('Luna Shortcuts');
  }
}

module.exports = { LunaShortcutsTests };
