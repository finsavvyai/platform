/**
 * Luna All Commands Test Suite (Simplified)
 * Basic validation for all Luna agent commands
 */

const { LunaTestFramework } = require('../framework/luna-test-framework');
const path = require('path');
const fs = require('fs');

class LunaAllCommandsSimpleTests {
  constructor() {
    this.framework = new LunaTestFramework();
    this.rootDir = path.resolve(__dirname, '../..');
    this.commandsDir = path.join(this.rootDir, 'commands');
    this.scriptsDir = path.join(this.rootDir, 'scripts');

    this.setupTestSuite();
  }

  setupTestSuite() {
    const suite = this.framework.createTestSuite('Luna All Commands');

    this.framework.addTest('Luna All Commands', 'should have all command documentation files', async () => {
      // Canonical command docs use the `ll-` prefix; bare short names are
      // shortcut redirects. Verify the canonical set exists.
      const expectedCommands = [
        'll-deploy.md',
        'll-design.md',
        'll-docs.md',
        'll-execute.md',
        'll-monitor.md',
        'll-plan.md',
        'll-postlaunch.md',
        'll-requirements.md',
        'll-review.md',
        'll-test.md',
        'll-hig.md',
        'll-plan-v2.md',
        'll-config.md',
        'll-rag.md'
      ];

      for (const commandFile of expectedCommands) {
        const filePath = path.join(this.commandsDir, commandFile);
        const exists = await this.framework.fileExists(filePath);
        this.framework.assert(exists, `Command documentation ${commandFile} should exist`);
      }
    });

    this.framework.addTest('Luna All Commands', 'should have valid markdown format', async () => {
      const commandFiles = await fs.promises.readdir(this.commandsDir);

      // Only enforce structure on canonical `ll-*` docs. Bare-name shortcuts
      // are short redirect stubs and don't need full sections.
      for (const file of commandFiles) {
        if (!file.startsWith('ll-') || !file.endsWith('.md')) continue;
        const content = await this.framework.readFile(path.join(this.commandsDir, file));
        this.framework.assert(content.includes('#'), `${file} should have a title`);
        this.framework.assert(content.includes('##'), `${file} should have sections`);
      }
    });

    this.framework.addTest('Luna All Commands', 'should have luna-shortcuts implementation', async () => {
      const shortcutsScript = path.join(this.scriptsDir, 'luna-shortcuts.js');
      const exists = await this.framework.fileExists(shortcutsScript);
      this.framework.assert(exists, 'luna-shortcuts.js implementation should exist');

      const content = await this.framework.readFile(shortcutsScript);
      this.framework.assert(content.includes('class LunaShortcuts'), 'Should have LunaShortcuts class');
      this.framework.assert(content.includes('module.exports'), 'Should export functionality');
    });

    this.framework.addTest('Luna All Commands', 'should have validate-plugin implementation', async () => {
      const validateScript = path.join(this.scriptsDir, 'validate-plugin.js');
      const exists = await this.framework.fileExists(validateScript);
      this.framework.assert(exists, 'validate-plugin.js should exist');
    });

    this.framework.addTest('Luna All Commands', 'should have link-plugin implementation', async () => {
      const linkScript = path.join(this.scriptsDir, 'link-plugin.js');
      const exists = await this.framework.fileExists(linkScript);
      this.framework.assert(exists, 'link-plugin.js should exist');
    });

    this.framework.addTest('Luna All Commands', 'should have valid README.md', async () => {
      const overviewPath = path.join(this.rootDir, 'README.md');
      const exists = await this.framework.fileExists(overviewPath);
      this.framework.assert(exists, 'README.md should exist');

      const content = await this.framework.readFile(overviewPath);
      this.framework.assert(content.length > 500, 'README.md should have substantive content (>500 bytes)');
      this.framework.assert(/luna/i.test(content), 'README.md should mention Luna');
    });

    this.framework.addTest('Luna All Commands', 'should have agents directory with files', async () => {
      const agentsDir = path.join(this.rootDir, 'agents');
      const exists = await this.framework.fileExists(agentsDir);
      this.framework.assert(exists, 'agents directory should exist');

      const agentFiles = await fs.promises.readdir(agentsDir);
      const markdownFiles = agentFiles.filter(f => f.endsWith('.md'));

      this.framework.assert(markdownFiles.length >= 15,
        `Should have at least 15 agent files, found ${markdownFiles.length}`);
    });

    this.framework.addTest('Luna All Commands', 'should have consistent naming conventions', async () => {
      const commandFiles = await fs.promises.readdir(this.commandsDir);
      const markdownFiles = commandFiles.filter(f => f.endsWith('.md'));

      // Canonical commands use `ll-` prefix; short names are accepted as
      // shortcuts. Reject anything outside this convention.
      for (const file of markdownFiles) {
        const ok = file.startsWith('ll-') || /^[a-z0-9][a-z0-9-]*\.md$/.test(file);
        this.framework.assert(ok, `Command file ${file} should be ll-*.md or a short shortcut name`);
      }
    });

    this.framework.addTest('Luna All Commands', 'should have reasonable file sizes', async () => {
      const commandFiles = await fs.promises.readdir(this.commandsDir);

      // Canonical `ll-*` docs must be substantive (1–50KB). Bare-name shortcuts
      // are redirect stubs and only need to be non-empty and under 50KB.
      for (const file of commandFiles) {
        if (!file.endsWith('.md')) continue;
        const stats = await fs.promises.stat(path.join(this.commandsDir, file));
        const sizeKB = stats.size / 1024;

        if (file.startsWith('ll-')) {
          this.framework.assert(sizeKB >= 1 && sizeKB <= 50,
            `Canonical doc ${file} should be 1–50KB, is ${sizeKB.toFixed(1)}KB`);
        } else {
          this.framework.assert(stats.size > 0 && sizeKB <= 50,
            `Shortcut ${file} should be non-empty and ≤50KB, is ${sizeKB.toFixed(1)}KB`);
        }
      }
    });
  }

  // Run all tests
  async runTests() {
    return await this.framework.runTests();
  }
}

module.exports = { LunaAllCommandsSimpleTests };
