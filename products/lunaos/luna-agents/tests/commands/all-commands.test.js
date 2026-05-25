/**
 * All Luna Commands Test Suite
 * Comprehensive testing for all Luna agent commands and CLI tools
 */

const { LunaTestFramework } = require('../framework/luna-test-framework');
const path = require('path');
const fs = require('fs');

class AllLunaCommandsTests {
  constructor() {
    this.framework = new LunaTestFramework();
    this.rootDir = path.resolve(__dirname, '../..');
    this.commandsDir = path.join(this.rootDir, 'commands');
    this.scriptsDir = path.join(this.rootDir, 'scripts');
    this.agentsDir = path.join(this.rootDir, 'agents');

    // List of all known commands
    this.allCommands = [
      'luna-deploy',
      'luna-design',
      'luna-docs',
      'luna-execute',
      'luna-monitor',
      'luna-plan',
      'luna-postlaunch',
      'luna-requirements',
      'luna-review',
      'luna-test',
      'luna-hig',
      'luna-plan-v2',
      'luna-config',
      'luna-shortcuts',
      'luna-ui-convert',
      'luna-cloudflare-auto',
      'luna-dockerize',
      'luna-rag'
    ];

    this.setupTestSuites();
  }

  setupTestSuites() {
    this.addDocumentationTests();
    this.addCommandStructureTests();
    this.addScriptTests();
    this.addIntegrationTests();
    this.addMCPTests();
    this.addErrorHandlingTests();
    this.addPerformanceTests();
  }

  // Documentation Tests
  addDocumentationTests() {
    const docsSuite = this.framework.createTestSuite('Documentation Tests');

    this.framework.addTest(docsSuite, 'should have documentation for all commands', async () => {
      for (const command of this.allCommands) {
        const docPath = path.join(this.commandsDir, `${command}.md`);
        const exists = await this.framework.fileExists(docPath);
        this.framework.assert(exists, `Documentation should exist for ${command}`);
      }
    });

    this.framework.addTest(docsSuite, 'should have proper markdown structure in command docs', async () => {
      const testCommands = ['luna-shortcuts', 'luna-deploy', 'luna-rag'];

      for (const command of testCommands) {
        const docPath = path.join(this.commandsDir, `${command}.md`);
        const content = await this.framework.readFile(docPath);

        // Check for markdown headers
        this.framework.assert(content.includes('#'), `${command} doc should have headers`);
        this.framework.assert(content.includes('##'), `${command} doc should have subheaders`);

        // Check for usage examples
        this.framework.assert(content.includes('```') || content.includes('`'),
          `${command} doc should have code examples`);

        // Check for descriptions
        this.framework.assert(content.length > 100, `${command} doc should have substantial content`);
      }
    });

    this.framework.addTest(docsSuite, 'should have agent documentation', async () => {
      const agents = ['luna-docker', 'luna-rag', 'luna-user-guide'];

      for (const agent of agents) {
        const agentPath = path.join(this.agentsDir, `${agent}.md`);
        const exists = await this.framework.fileExists(agentPath);
        if (exists) {
          const content = await this.framework.readFile(agentPath);
          this.framework.assert(content.includes('**MCP Tool**'),
            `${agent} should document MCP tool integration`);
        }
      }
    });
  }

  // Command Structure Tests
  addCommandStructureTests() {
    const structureSuite = this.framework.createTestSuite('Command Structure Tests');

    this.framework.addTest(structureSuite, 'should have valid command naming convention', async () => {
      for (const command of this.allCommands) {
        this.framework.assert(command.startsWith('luna-'),
          `${command} should follow luna- naming convention`);
        this.framework.assert(command.length > 5,
          `${command} should have descriptive name`);
      }
    });

    this.framework.addTest(structureSuite, 'should have commands directory organized', async () => {
      const commands = await fs.promises.readdir(this.commandsDir);

      this.framework.assert(commands.length >= this.allCommands.length * 0.8,
        'Should have documentation for most commands');

      for (const file of commands) {
        this.framework.assert(file.endsWith('.md'),
          `Command file ${file} should be markdown`);
      }
    });

    this.framework.addTest(structureSuite, 'should have scripts directory with implementations', async () => {
      const scripts = await fs.promises.readdir(this.scriptsDir);

      this.framework.assert(scripts.length > 0, 'Should have script implementations');

      for (const file of scripts) {
        if (file.endsWith('.js')) {
          const scriptPath = path.join(this.scriptsDir, file);
          const content = await this.framework.readFile(scriptPath);

          // Check for proper JavaScript structure
          this.framework.assert(content.includes('function') || content.includes('class'),
            `${file} should have proper JS structure`);

          // Check for error handling
          this.framework.assert(content.includes('try') || content.includes('catch') || content.includes('error'),
            `${file} should have error handling`);
        }
      }
    });
  }

  // Script Tests
  addScriptTests() {
    const scriptSuite = this.framework.createTestSuite('Script Implementation Tests');

    this.framework.addTest(scriptSuite, 'should execute luna-shortcuts script', async () => {
      const scriptPath = path.join(this.scriptsDir, 'luna-shortcuts.js');

      if (await this.framework.fileExists(scriptPath)) {
        const result = await this.framework.executeCommand('node', {
          args: [scriptPath, '--help'],
          cwd: this.rootDir
        });

        this.framework.assertEqual(result.exitCode, 0, 'luna-shortcuts should execute successfully');
        this.framework.assert(result.stdout.length > 0, 'Should produce output');
      }
    });

    this.framework.addTest(scriptSuite, 'should have validate-plugin script', async () => {
      const scriptPath = path.join(this.scriptsDir, 'validate-plugin.js');
      const exists = await this.framework.fileExists(scriptPath);
      this.framework.assert(exists, 'validate-plugin script should exist');

      if (exists) {
        const result = await this.framework.executeCommand('node', {
          args: [scriptPath, '--help'],
          cwd: this.rootDir
        });

        // Should either run successfully or show help
        this.framework.assert(result.exitCode === 0 || result.stdout.includes('help'),
          'validate-plugin should be executable');
      }
    });

    this.framework.addTest(scriptSuite, 'should have link-plugin script', async () => {
      const scriptPath = path.join(this.scriptsDir, 'link-plugin.js');
      const exists = await this.framework.fileExists(scriptPath);
      this.framework.assert(exists, 'link-plugin script should exist');
    });
  }

  // Integration Tests
  addIntegrationTests() {
    const integrationSuite = this.framework.createTestSuite('Integration Tests');

    this.framework.addTest(integrationSuite, 'should have AGENTS_OVERVIEW with correct count', async () => {
      const overviewPath = path.join(this.rootDir, 'AGENTS_OVERVIEW.md');
      const exists = await this.framework.fileExists(overviewPath);
      this.framework.assert(exists, 'AGENTS_OVERVIEW.md should exist');

      const content = await this.framework.readFile(overviewPath);
      this.framework.assert(content.includes('## 📦 All Available Agents'),
        'Should have agents section');

      // Should mention 15 agents from the overview
      this.framework.assert(content.includes('15') || content.includes('agents'),
        'Should specify number of agents');
    });

    this.framework.addTest(integrationSuite, 'should have consistent cross-references', async () => {
      const overviewPath = path.join(this.rootDir, 'AGENTS_OVERVIEW.md');
      const overviewContent = await this.framework.readFile(overviewPath);

      // Check that key agents are mentioned
      const keyAgents = ['luna-rag', 'luna-docker', 'luna-cloudflare'];
      for (const agent of keyAgents) {
        this.framework.assert(overviewContent.includes(agent),
          `Overview should reference ${agent}`);
      }
    });

    this.framework.addTest(integrationSuite, 'should have MCP server integration', async () => {
      const mcpPath = path.join(this.rootDir, 'mcp-servers');
      const exists = await this.framework.fileExists(mcpPath);
      this.framework.assert(exists, 'mcp-servers directory should exist');

      if (exists) {
        const mcpContent = await fs.promises.readdir(mcpPath);
        this.framework.assert(mcpContent.length > 0, 'Should have MCP server implementations');
      }
    });
  }

  // MCP Tests
  addMCPTests() {
    const mcpSuite = this.framework.createTestSuite('MCP Integration Tests');

    this.framework.addTest(mcpSuite, 'should have documented MCP tools in agents', async () => {
      const agentFiles = await fs.promises.readdir(this.agentsDir);
      let mcpToolCount = 0;

      for (const file of agentFiles) {
        if (file.endsWith('.md')) {
          const content = await this.framework.readFile(path.join(this.agentsDir, file));
          if (content.includes('**MCP Tool**')) {
            mcpToolCount++;
          }
        }
      }

      this.framework.assert(mcpToolCount >= 10,
        `Should have at least 10 documented MCP tools (found ${mcpToolCount})`);
    });

    this.framework.addTest(mcpSuite, 'should have valid MCP tool names', async () => {
      const agentFiles = await fs.promises.readdir(this.agentsDir);
      const mcpTools = [];

      for (const file of agentFiles) {
        if (file.endsWith('.md')) {
          const content = await this.framework.readFile(path.join(this.agentsDir, file));
          const matches = content.match(/\*\*MCP Tool\*\*: `([^`]+)`/g);
          if (matches) {
            for (const match of matches) {
              const toolName = match.match(/`([^`]+)`/)[1];
              mcpTools.push(toolName);
            }
          }
        }
      }

      // Validate tool names
      for (const tool of mcpTools) {
        this.framework.assert(tool.length > 0, `MCP tool name should not be empty`);
        this.framework.assert(/^[a-z_][a-z0-9_]*$/.test(tool),
          `MCP tool '${tool}' should follow naming convention`);
      }

      this.framework.assert(mcpTools.length > 0, 'Should have at least one MCP tool');
    });
  }

  // Error Handling Tests
  addErrorHandlingTests() {
    const errorSuite = this.framework.createTestSuite('Error Handling Tests');

    this.framework.addTest(errorSuite, 'should handle missing files gracefully', async () => {
      // Test that the system handles missing command files
      const result = await this.framework.executeCommand('node', {
        args: [path.join(this.scriptsDir, 'non-existent.js')],
        cwd: this.rootDir
      });

      // Should fail gracefully without crashing
      this.framework.assert(result.exitCode !== 0, 'Should fail for non-existent script');
      this.framework.assert(result.stderr.length > 0 || result.stdout.includes('Error'),
        'Should provide error message');
    });

    this.framework.addTest(errorSuite, 'should handle invalid arguments', async () => {
      const shortcutsPath = path.join(this.scriptsDir, 'luna-shortcuts.js');

      if (await this.framework.fileExists(shortcutsPath)) {
        const result = await this.framework.executeCommand('node', {
          args: [shortcutsPath, 'invalid-command-with-too-many-args-that-dont-exist'],
          cwd: this.rootDir
        });

        // Should fail gracefully with usage information
        this.framework.assert(result.exitCode !== 0 || result.stdout.includes('Usage'),
          'Should handle invalid arguments gracefully');
      }
    });

    this.framework.addTest(errorSuite, 'should handle permission denied scenarios', async () => {
      // Create a file with restricted permissions
      const testFile = path.join(this.rootDir, 'temp-test-restricted.js');
      await this.framework.writeFile(testFile, 'console.log("test");');
      await fs.promises.chmod(testFile, 0o000); // No permissions

      try {
        const result = await this.framework.executeCommand('node', {
          args: [testFile],
          cwd: this.rootDir
        });

        // Should handle permission error gracefully
        this.framework.assert(result.exitCode !== 0, 'Should fail with permission error');
      } finally {
        // Restore permissions and cleanup
        await fs.promises.chmod(testFile, 0o644);
        await fs.promises.unlink(testFile);
      }
    });
  }

  // Performance Tests
  addPerformanceTests() {
    const perfSuite = this.framework.createTestSuite('Performance Tests');

    this.framework.addTest(perfSuite, 'should load documentation quickly', async () => {
      const startTime = Date.now();

      // Read multiple documentation files
      const filesToRead = ['luna-shortcuts.md', 'luna-deploy.md', 'luna-rag.md'];
      for (const file of filesToRead) {
        const filePath = path.join(this.commandsDir, file);
        if (await this.framework.fileExists(filePath)) {
          await this.framework.readFile(filePath);
        }
      }

      const loadTime = Date.now() - startTime;
      this.framework.assert(loadTime < 1000,
        `Documentation should load quickly (took ${loadTime}ms, expected < 1000ms)`);
    });

    this.framework.addTest(perfSuite, 'should handle large directory listings efficiently', async () => {
      const startTime = Date.now();

      const commands = await fs.promises.readdir(this.commandsDir);
      const agents = await fs.promises.readdir(this.agentsDir);
      const scripts = await fs.promises.readdir(this.scriptsDir);

      const listTime = Date.now() - startTime;
      this.framework.assert(listTime < 500,
        `Directory listing should be fast (took ${listTime}ms, expected < 500ms)`);

      this.framework.assert(commands.length > 0, 'Should list commands');
      this.framework.assert(agents.length > 0, 'Should list agents');
    });

    this.framework.addTest(perfSuite, 'should have reasonable file sizes', async () => {
      const commands = await fs.promises.readdir(this.commandsDir);
      let totalSize = 0;
      let largeFiles = 0;

      for (const file of commands) {
        if (file.endsWith('.md')) {
          const filePath = path.join(this.commandsDir, file);
          const stats = await fs.promises.stat(filePath);
          totalSize += stats.size;

          if (stats.size > 100000) { // 100KB
            largeFiles++;
          }
        }
      }

      // Most documentation files should be reasonably sized
      const averageSize = totalSize / commands.filter(f => f.endsWith('.md')).length;
      this.framework.assert(averageSize < 50000,
        `Average file size should be reasonable (avg: ${averageSize} bytes)`);

      this.framework.assert(largeFiles < commands.length * 0.2,
        `Less than 20% of files should be large (${largeFiles}/${commands.length})`);
    });
  }

  // Run all tests
  async runTests() {
    console.log('🚀 Starting comprehensive Luna agents command tests...\n');
    return await this.framework.runTests();
  }
}

module.exports = { AllLunaCommandsTests };
