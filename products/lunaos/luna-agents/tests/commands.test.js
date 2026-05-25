/**
 * Test Suite for Luna Agent Commands
 * Tests all 19 Luna agent commands for functionality and correctness
 */

const { LunaTestFramework } = require('./framework/luna-test-framework');
const path = require('path');

async function createCommandTests() {
  const framework = new LunaTestFramework();

  // Test Suite: Core Commands
  const coreSuite = framework.createTestSuite('Core Commands');

  // Test luna-shortcuts command
  framework.addTest(coreSuite, 'luna-shortcuts should load and list shortcuts', async () => {
    const shortcutsPath = path.join(__dirname, '../scripts/luna-shortcuts.js');
    const exists = await framework.fileExists(shortcutsPath);
    framework.assert(exists, 'luna-shortcuts.js script should exist');

    // Test script execution
    const result = await framework.executeCommand('node', {
      args: [shortcutsPath, 'list'],
      timeout: 5000
    });

    framework.assertEqual(result.exitCode, 0, 'luna-shortcuts should execute successfully');
    framework.assert(result.stdout.includes('Available shortcuts') || result.stdout.includes('Luna Shortcuts'),
                   'Should display shortcuts information');
  });

  framework.addTest(coreSuite, 'luna-shortcuts should search functionality', async () => {
    const shortcutsPath = path.join(__dirname, '../scripts/luna-shortcuts.js');
    const result = await framework.executeCommand('node', {
      args: [shortcutsPath, 'search', 'hig'],
      timeout: 5000
    });

    framework.assertEqual(result.exitCode, 0, 'Search should execute successfully');
  });

  // Test Suite: Command Documentation
  const docSuite = framework.createTestSuite('Command Documentation');

  const commands = [
    'luna-deploy', 'luna-design', 'luna-docs', 'luna-execute',
    'luna-monitor', 'luna-plan', 'luna-postlaunch', 'luna-requirements',
    'luna-review', 'luna-test', 'luna-hig', 'luna-plan-v2',
    'luna-config', 'luna-ui-convert', 'luna-cloudflare-auto',
    'luna-dockerize', 'luna-rag'
  ];

  commands.forEach(command => {
    framework.addTest(docSuite, `${command} documentation should exist`, async () => {
      const docPath = path.join(__dirname, '../commands', `${command}.md`);
      const exists = await framework.fileExists(docPath);
      framework.assert(exists, `${command}.md documentation should exist`);

      const content = await framework.readFile(docPath);
      framework.assert(content.length > 0, `${command} documentation should not be empty`);
      framework.assertContains(content, '#', `${command} documentation should have headers`);
    });
  });

  // Test Suite: Agent Documentation
  const agentSuite = framework.createTestSuite('Agent Documentation');

  const agents = [
    'luna-docker', 'luna-user-guide', 'luna-lemonsqueezy', 'luna-openai-app',
    'luna-database', 'luna-api-generator', 'luna-auth', 'luna-analytics',
    'luna-seo', 'luna-ui-convert', 'luna-ui-test', 'luna-ui-fix',
    'luna-cloudflare', 'luna-rag'
  ];

  agents.forEach(agent => {
    framework.addTest(agentSuite, `${agent} agent documentation should exist`, async () => {
      const agentPath = path.join(__dirname, '../agents', `${agent}.md`);
      const exists = await framework.fileExists(agentPath);
      framework.assert(exists, `${agent}.md agent documentation should exist`);

      const content = await framework.readFile(agentPath);
      framework.assert(content.length > 0, `${agent} documentation should not be empty`);
      framework.assertContains(content, 'MCP Tool', `${agent} should have MCP tool references`);
      framework.assertContains(content, '#', `${agent} documentation should have headers`);
    });
  });

  // Test Suite: Plugin Validation
  const pluginSuite = framework.createTestSuite('Plugin Validation');

  framework.addTest(pluginSuite, 'validate-plugin script should exist', async () => {
    const scriptPath = path.join(__dirname, '../scripts/validate-plugin.js');
    const exists = await framework.fileExists(scriptPath);
    framework.assert(exists, 'validate-plugin.js should exist');
  });

  framework.addTest(pluginSuite, 'link-plugin script should exist', async () => {
    const scriptPath = path.join(__dirname, '../scripts/link-plugin.js');
    const exists = await framework.fileExists(scriptPath);
    framework.assert(exists, 'link-plugin.js should exist');
  });

  framework.addTest(pluginSuite, 'AGENTS_OVERVIEW.md should be comprehensive', async () => {
    const overviewPath = path.join(__dirname, '../AGENTS_OVERVIEW.md');
    const content = await framework.readFile(overviewPath);

    framework.assertContains(content, '15 Total', 'Should list 15 total agents');
    framework.assertContains(content, 'luna-rag', 'Should include luna-rag agent');
    framework.assertContains(content, 'MCP Tool', 'Should reference MCP tools');
  });

  // Test Suite: MCP Integration
  const mcpSuite = framework.createTestSuite('MCP Integration');

  framework.addTest(mcpSuite, 'MCP server directory structure should exist', async () => {
    const mcpPath = path.join(__dirname, '../mcp-servers');
    const exists = await framework.fileExists(mcpPath);
    framework.assert(exists, 'mcp-servers directory should exist');
  });

  framework.addTest(mcpSuite, 'Luna shortcuts should have proper structure', async () => {
    const shortcutsPath = path.join(__dirname, '../scripts/luna-shortcuts.js');
    const content = await framework.readFile(shortcutsPath);

    framework.assertContains(content, 'class LunaShortcuts', 'Should define LunaShortcuts class');
    framework.assertContains(content, 'execute', 'Should have execute method');
    framework.assertContains(content, 'exports', 'Should export module');
  });

  // Test Suite: Command Functionality
  const functionalitySuite = framework.createTestSuite('Command Functionality');

  framework.addTest(functionalitySuite, 'luna-shortcuts create workflow', async () => {
    const shortcutsPath = path.join(__dirname, '../scripts/luna-shortcuts.js');
    const result = await framework.executeCommand('node', {
      args: [shortcutsPath, 'create', 'test-workflow', 'echo "test"'],
      timeout: 5000
    });

    framework.assertEqual(result.exitCode, 0, 'Should create workflow successfully');
  });

  framework.addTest(functionalitySuite, 'luna-shortcuts should show help', async () => {
    const shortcutsPath = path.join(__dirname, '../scripts/luna-shortcuts.js');
    const result = await framework.executeCommand('node', {
      args: [shortcutsPath, 'help'],
      timeout: 5000
    });

    framework.assertEqual(result.exitCode, 0, 'Should show help successfully');
    framework.assert(result.stdout.length > 0, 'Help should not be empty');
  });

  return framework;
}

module.exports = { createCommandTests };
