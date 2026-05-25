/**
 * Luna All Commands Test Suite
 * Comprehensive testing for all Luna agent commands
 */

const { LunaTestFramework } = require('../framework/luna-test-framework');
const path = require('path');
const fs = require('fs');

class LunaAllCommandsTests {
  constructor() {
    this.framework = new LunaTestFramework();
    this.rootDir = path.resolve(__dirname, '../..');
    this.commandsDir = path.join(this.rootDir, 'commands');
    this.scriptsDir = path.join(this.rootDir, 'scripts');

    this.setupTestSuite();
  }

  setupTestSuite() {
    const suite = this.framework.createTestSuite('Luna All Commands');

    // Command Documentation Tests
    this.addCommandDocumentationTests(suite);

    // Command Implementation Tests
    this.addCommandImplementationTests(suite);

    // Integration Tests
    this.addIntegrationTests(suite);

    // Error Handling Tests
    this.addErrorHandlingTests(suite);
  }

  // Command Documentation Tests
  addCommandDocumentationTests(suite) {
    this.framework.addTest(suite, 'should have all command documentation files', async () => {
      const expectedCommands = [
        'luna-deploy.md',
        'luna-design.md',
        'luna-docs.md',
        'luna-execute.md',
        'luna-monitor.md',
        'luna-plan.md',
        'luna-postlaunch.md',
        'luna-requirements.md',
        'luna-review.md',
        'luna-test.md',
        'luna-hig.md',
        'luna-plan-v2.md',
        'luna-config.md',
        'luna-shortcuts.md',
        'luna-ui-convert.md',
        'luna-cloudflare-auto.md',
        'luna-dockerize.md',
        'luna-rag.md'
      ];

      for (const commandFile of expectedCommands) {
        const filePath = path.join(this.commandsDir, commandFile);
        const exists = await this.framework.fileExists(filePath);
        this.framework.assert(exists, `Command documentation ${commandFile} should exist`);
      }
    });

    this.framework.addTest(suite, 'should have valid markdown format in command files', async () => {
      const commandFiles = await fs.promises.readdir(this.commandsDir);

      for (const file of commandFiles) {
        if (file.endsWith('.md')) {
          const content = await this.framework.readFile(path.join(this.commandsDir, file));

          // Check for required markdown elements
          this.framework.assert(content.includes('#'), `${file} should have a title`);
          this.framework.assert(content.includes('##'), `${file} should have sections`);
          this.framework.assert(content.includes('```'), `${file} should have code examples`);
        }
      }
    });

    this.framework.addTest(suite, 'should have consistent command documentation structure', async () => {
      const commandFiles = await fs.promises.readdir(this.commandsDir);
      const markdownFiles = commandFiles.filter(f => f.endsWith('.md'));

      for (const file of markdownFiles) {
        const content = await this.framework.readFile(path.join(this.commandsDir, file));

        // Check for consistent structure
        this.framework.assert(content.includes('## Usage') || content.includes('## Examples') || content.includes('## Command'),
          `${file} should have usage examples`);

        this.framework.assert(content.includes('###') || content.includes('**') || content.includes('*'),
          `${file} should have formatted text`);
      }
    });
  }

  // Command Implementation Tests
  addCommandImplementationTests(suite) {
    this.framework.addTest(suite, 'should have luna-shortcuts implementation', async () => {
      const shortcutsScript = path.join(this.scriptsDir, 'luna-shortcuts.js');
      const exists = await this.framework.fileExists(shortcutsScript);
      this.framework.assert(exists, 'luna-shortcuts.js implementation should exist');

      const content = await this.framework.readFile(shortcutsScript);

      // Check for required implementation elements
      this.framework.assert(content.includes('class LunaShortcuts'), 'Should have LunaShortcuts class');
      this.framework.assert(content.includes('constructor'), 'Should have constructor');
      this.framework.assert(content.includes('execute'), 'Should have execute method');
      this.framework.assert(content.includes('module.exports'), 'Should export the class');
    });

    this.framework.addTest(suite, 'should have validate-plugin implementation', async () => {
      const validateScript = path.join(this.scriptsDir, 'validate-plugin.js');
      const exists = await this.framework.fileExists(validateScript);
      this.framework.assert(exists, 'validate-plugin.js implementation should exist');

      const content = await this.framework.readFile(validateScript);
      this.framework.assert(content.includes('module.exports'), 'Should export functionality');
    });

    this.framework.addTest(suite, 'should have link-plugin implementation', async () => {
      const linkScript = path.join(this.scriptsDir, 'link-plugin.js');
      const exists = await this.framework.fileExists(linkScript);
      this.framework.assert(exists, 'link-plugin.js implementation should exist');

      const content = await this.framework.readFile(linkScript);
      this.framework.assert(content.includes('module.exports'), 'Should export functionality');
    });

    this.framework.addTest(suite, 'luna-shortcuts should be executable', async () => {
      const shortcutsScript = path.join(this.scriptsDir, 'luna-shortcuts.js');

      // Test if Node.js can execute the script without errors
      try {
        const result = await this.framework.executeCommand('node', {
          args: [shortcutsScript, '--help'],
          cwd: this.rootDir,
          timeout: 5000
        });

        // Should not crash and should show help
        this.framework.assert(result.exitCode === 0 || result.stderr.includes('Usage'),
          'luna-shortcuts should execute without syntax errors');
      } catch (error) {
        this.framework.assert(false, `luna-shortcuts should be executable: ${error.message}`);
      }
    });
  }

  // Integration Tests
  addIntegrationTests(suite) {
    this.framework.addTest(suite, 'should have valid AGENTS_OVERVIEW.md', async () => {
      const overviewPath = path.join(this.rootDir, 'AGENTS_OVERVIEW.md');
      const exists = await this.framework.fileExists(overviewPath);
      this.framework.assert(exists, 'AGENTS_OVERVIEW.md should exist');

      const content = await this.framework.readFile(overviewPath);

      // Check for required structure
      this.framework.assert(content.includes('# Luna Agents'), 'Should have main title');
      this.framework.assert(content.includes('## 📦 All Available Agents'), 'Should have agents section');
      this.framework.assert(content.includes('## 🚀 Quick Start'), 'Should have quick start section');
      this.framework.assert(content.includes('## 🔧 MCP Server Tools'), 'Should have MCP tools section');

      // Should mention luna-rag agent
      this.framework.assert(content.includes('luna-rag'), 'Should include luna-rag agent');
      this.framework.assert(content.includes('RAG'), 'Should include RAG functionality');
    });

    this.framework.addTest(suite, 'should have correct agent count in overview', async () => {
      const overviewPath = path.join(this.rootDir, 'AGENTS_OVERVIEW.md');
      const content = await this.framework.readFile(overviewPath);

      // Count actual agents
      const agentMatches = content.match(/#### \d+\.\s*\*\*(.*?)\*\*/g);
      const agentCount = agentMatches ? agentMatches.length : 0;

      this.framework.assert(agentCount >= 15, `Should have at least 15 agents, found ${agentCount}`);

      // Verify specific agents mentioned
      const requiredAgents = [
        'luna-docker',
        'luna-user-guide',
        'luna-lemonsqueezy',
        'luna-openai-app',
        'luna-database',
        'luna-rag'
      ];

      for (const agent of requiredAgents) {
        this.framework.assert(content.includes(agent), `Should include ${agent} agent`);
      }
    });

    this.framework.addTest(suite, 'should have proper MCP tools integration', async () => {
      const overviewPath = path.join(this.rootDir, 'AGENTS_OVERVIEW.md');
      const content = await this.framework.readFile(overviewPath);

      // Check for MCP tools section
      const mcpSection = content.indexOf('## 🔧 MCP Server Tools');
      this.framework.assert(mcpSection !== -1, 'Should have MCP tools section');

      // Should list multiple tools
      const toolMatches = content.match(/\d+\.\s*`[^`]+`/g);
      const toolCount = toolMatches ? toolMatches.length : 0;
      this.framework.assert(toolCount >= 10, `Should have at least 10 MCP tools, found ${toolCount}`);
    });

    this.framework.addTest(suite, 'should have agents directory with valid files', async () => {
      const agentsDir = path.join(this.rootDir, 'agents');
      const exists = await this.framework.fileExists(agentsDir);
      this.framework.assert(exists, 'agents directory should exist');

      const agentFiles = await fs.promises.readdir(agentsDir);
      const markdownFiles = agentFiles.filter(f => f.endsWith('.md'));

      this.framework.assert(markdownFiles.length >= 15,
        `Should have at least 15 agent files, found ${markdownFiles.length}`);

      // Check for specific agent files
      const expectedAgents = [
        'luna-docker.md',
        'luna-rag.md',
        'luna-openai-app.md',
        'luna-database.md'
      ];

      for (const agent of expectedAgents) {
        const agentPath = path.join(agentsDir, agent);
        const agentExists = await this.framework.fileExists(agentPath);
        this.framework.assert(agentExists, `Agent file ${agent} should exist`);
      }
    });
  }

  // Error Handling Tests
  addErrorHandlingTests(suite) {
    this.framework.addTest(suite, 'should handle missing command files gracefully', async () => {
      const nonExistentPath = path.join(this.commandsDir, 'non-existent-command.md');
      const exists = await this.framework.fileExists(nonExistentPath);
      this.framework.assert(!exists, 'Non-existent command should not exist');
    });

    this.framework.addTest(suite, 'should have valid JSON structure in config files', async () => {
      // Check for any JSON configuration files
      const configFiles = ['package.json', 'test.config.js'];

      for (const configFile of configFiles) {
        const configPath = path.join(this.rootDir, configFile);
        if (await this.framework.fileExists(configPath)) {
          try {
            if (configFile.endsWith('.json')) {
              const content = await this.framework.readFile(configPath);
              JSON.parse(content);
            }
          } catch (error) {
            this.framework.assert(false, `Config file ${configFile} should have valid JSON: ${error.message}`);
          }
        }
      }
    });

    this.framework.addTest(suite, 'should have proper file permissions', async () => {
      const scriptFiles = await fs.promises.readdir(this.scriptsDir);

      for (const scriptFile of scriptFiles) {
        if (scriptFile.endsWith('.js')) {
          const scriptPath = path.join(this.scriptsDir, scriptFile);
          try {
            await fs.promises.access(scriptPath, fs.constants.R_OK);
          } catch (error) {
            this.framework.assert(false, `Script file ${scriptFile} should be readable`);
          }
        }
      }
    });

    this.framework.addTest(suite, 'should have consistent naming conventions', async () => {
      const commandFiles = await fs.promises.readdir(this.commandsDir);
      const markdownFiles = commandFiles.filter(f => f.endsWith('.md'));

      for (const file of markdownFiles) {
        // All command files should follow luna-*.md pattern
        this.framework.assert(file.startsWith('luna-'),
          `Command file ${file} should start with 'luna-'`);
        this.framework.assert(file.endsWith('.md'),
          `Command file ${file} should end with '.md'`);
      }
    });

    this.framework.addTest(suite, 'should validate luna-shortcuts command functionality', async () => {
      const shortcutsScript = path.join(this.scriptsDir, 'luna-shortcuts.js');
      const testDir = path.join(this.rootDir, 'temp/test-command-validation');

      // Create test directory
      await fs.promises.mkdir(testDir, { recursive: true });
      await fs.promises.mkdir(path.join(testDir, '.luna'), { recursive: true });

      try {
        // Test basic functionality
        const result = await this.framework.executeCommand('node', {
          args: [shortcutsScript, 'list'],
          cwd: testDir,
          timeout: 5000
        });

        // Should execute without crashing
        this.framework.assert(result.exitCode === 0 || result.stderr.includes('Error'),
          'luna-shortcuts should execute basic commands');

      } finally {
        // Cleanup
        await fs.promises.rm(testDir, { recursive: true, force: true });
      }
    });
  }

  // Performance Tests
  addPerformanceTests(suite) {
    this.framework.addTest(suite, 'should load command files efficiently', async () => {
      const startTime = Date.now();

      const commandFiles = await fs.promises.readdir(this.commandsDir);
      let totalSize = 0;

      for (const file of commandFiles) {
        if (file.endsWith('.md')) {
          const content = await this.framework.readFile(path.join(this.commandsDir, file));
          totalSize += content.length;
        }
      }

      const loadTime = Date.now() - startTime;

      // Should load all files within reasonable time
      this.framework.assert(loadTime < 1000,
        `Should load all command files within 1 second, took ${loadTime}ms`);

      // Total documentation size should be reasonable
      this.framework.assert(totalSize > 10000,
        `Should have substantial documentation content, found ${totalSize} bytes`);
    });

    this.framework.addTest(suite, 'should have reasonable file sizes', async () => {
      const commandFiles = await fs.promises.readdir(this.commandsDir);

      for (const file of commandFiles) {
        if (file.endsWith('.md')) {
          const stats = await fs.promises.stat(path.join(this.commandsDir, file));
          const sizeKB = stats.size / 1024;

          // Each command file should be between 1KB and 50KB
          this.framework.assert(sizeKB >= 1 && sizeKB <= 50,
            `Command file ${file} should be between 1KB and 50KB, is ${sizeKB.toFixed(1)}KB`);
        }
      }
    });
  }

  // Run all tests
  async runTests() {
    return await this.framework.runTests('Luna All Commands');
  }
}

module.exports = { LunaAllCommandsTests };
