#!/usr/bin/env node

/**
 * Claude Code Dynamic Shortcuts
 * Automatically parses and expands user shortcuts for Claude Code commands
 */

const fs = require('fs');
const path = require('path');

class ClaudeShortcuts {
  constructor() {
    this.configPath = path.join(process.cwd(), '.luna');
    this.shortcutsPath = path.join(this.configPath, 'claude-shortcuts.json');
    this.initializeDefaults();
  }

  initializeDefaults() {
    // Create .luna directory if it doesn't exist
    if (!fs.existsSync(this.configPath)) {
      fs.mkdirSync(this.configPath, { recursive: true });
    }

    // Initialize shortcuts file if it doesn't exist
    if (!fs.existsSync(this.shortcutsPath)) {
      const defaultShortcuts = {
        version: "1.0.0",
        created: new Date().toISOString(),
        shortcuts: {
          // Built-in Claude Code shortcuts
          "le": {
            name: "le",
            command: "/luna-execute",
            description: "Execute Luna agent",
            category: "claude-code",
            builtin: true
          },
          "lr": {
            name: "lr",
            command: "/luna-review",
            description: "Review code with Luna",
            category: "claude-code",
            builtin: true
          },
          "lh": {
            name: "lh",
            command: "/luna-hig",
            description: "Apple HIG analysis",
            category: "claude-code",
            builtin: true
          },
          "ld": {
            name: "ld",
            command: "/luna-deploy",
            description: "Deploy with Luna",
            category: "claude-code",
            builtin: true
          },
          "lp": {
            name: "lp",
            command: "/luna-plan",
            description: "Plan with Luna",
            category: "claude-code",
            builtin: true
          },
          "lt": {
            name: "lt",
            command: "/luna-test",
            description: "Test with Luna",
            category: "claude-code",
            builtin: true
          },
          "ldoc": {
            name: "ldoc",
            command: "/luna-docs",
            description: "Generate documentation",
            category: "claude-code",
            builtin: true
          },
          "lm": {
            name: "lm",
            command: "/luna-monitor",
            description: "Monitor with Luna",
            category: "claude-code",
            builtin: true
          }
        },
        user_shortcuts: {},
        stats: {
          total_uses: 0,
          shortcut_uses: {}
        }
      };

      fs.writeFileSync(this.shortcutsPath, JSON.stringify(defaultShortcuts, null, 2));
    }
  }

  loadShortcuts() {
    try {
      const data = fs.readFileSync(this.shortcutsPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading shortcuts:', error.message);
      return { shortcuts: {}, user_shortcuts: {} };
    }
  }

  saveShortcuts(data) {
    try {
      fs.writeFileSync(this.shortcutsPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving shortcuts:', error.message);
    }
  }

  /**
   * Parse user input and expand shortcuts
   * This is the main function for dynamic shortcut parsing
   */
  parseInput(input) {
    const data = this.loadShortcuts();
    const allShortcuts = { ...data.shortcuts, ...data.user_shortcuts };

    // Check if input starts with a known shortcut
    for (const [shortcut, info] of Object.entries(allShortcuts)) {
      if (input.startsWith(`/${shortcut}`)) {
        // Extract the rest of the command after the shortcut
        const rest = input.substring(shortcut.length + 1); // +1 for the /
        const expandedCommand = info.command + rest;

        // Update usage stats
        this.updateUsageStats(shortcut);

        return {
          original: input,
          expanded: expandedCommand,
          shortcut: shortcut,
          description: info.description
        };
      }
    }

    // Return original if no shortcut found
    return {
      original: input,
      expanded: input,
      shortcut: null,
      description: null
    };
  }

  updateUsageStats(shortcut) {
    const data = this.loadShortcuts();
    data.stats.total_uses = (data.stats.total_uses || 0) + 1;
    data.stats.shortcut_uses[shortcut] = (data.stats.shortcut_uses[shortcut] || 0) + 1;
    this.saveShortcuts(data);
  }

  /**
   * Add a user-defined shortcut
   */
  addShortcut(shortcut, command, description = "") {
    const data = this.loadShortcuts();

    if (data.shortcuts[shortcut]) {
      console.error(`Cannot override built-in shortcut: ${shortcut}`);
      return false;
    }

    data.user_shortcuts[shortcut] = {
      name: shortcut,
      command: command,
      description: description || `User shortcut: ${shortcut}`,
      category: "user",
      created: new Date().toISOString()
    };

    this.saveShortcuts(data);
    console.log(`✅ Added user shortcut: ${shortcut} → ${command}`);
    return true;
  }

  /**
   * Remove a user-defined shortcut
   */
  removeShortcut(shortcut) {
    const data = this.loadShortcuts();

    if (data.shortcuts[shortcut]) {
      console.error(`Cannot remove built-in shortcut: ${shortcut}`);
      return false;
    }

    if (data.user_shortcuts[shortcut]) {
      delete data.user_shortcuts[shortcut];
      this.saveShortcuts(data);
      console.log(`✅ Removed user shortcut: ${shortcut}`);
      return true;
    }

    console.log(`Shortcut not found: ${shortcut}`);
    return false;
  }

  /**
   * List all shortcuts
   */
  listShortcuts() {
    const data = this.loadShortcuts();
    const allShortcuts = { ...data.shortcuts, ...data.user_shortcuts };

    console.log('🌙 Claude Code Dynamic Shortcuts:');
    console.log('');

    // Group by category
    const categories = {};
    for (const [name, info] of Object.entries(allShortcuts)) {
      const category = info.category || 'other';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push({ name, ...info });
    }

    for (const [category, shortcuts] of Object.entries(categories)) {
      console.log(`${category.toUpperCase()}:`);
      for (const shortcut of shortcuts) {
        const builtin = shortcut.builtin ? ' [built-in]' : '';
        const usage = data.stats.shortcut_uses[shortcut.name] || 0;
        console.log(`  /${shortcut.name.padEnd(6)} → ${shortcut.command.padEnd(20)} (${usage} uses)${builtin}`);
      }
      console.log('');
    }
  }

  /**
   * Show usage statistics
   */
  showStats() {
    const data = this.loadShortcuts();
    const allShortcuts = { ...data.shortcuts, ...data.user_shortcuts };

    console.log('📊 Shortcut Usage Statistics:');
    console.log(`Total uses: ${data.stats.total_uses || 0}`);
    console.log('');

    // Sort by usage
    const sortedShortcuts = Object.entries(data.stats.shortcut_uses || {})
      .sort((a, b) => b[1] - a[1]);

    if (sortedShortcuts.length > 0) {
      console.log('Most used shortcuts:');
      for (const [name, count] of sortedShortcuts.slice(0, 10)) {
        const info = allShortcuts[name];
        console.log(`  /${name.padEnd(6)} → ${count} uses (${info.description})`);
      }
    } else {
      console.log('No shortcuts used yet.');
    }
    console.log('');
  }

  /**
   * Test shortcut parsing with examples
   */
  testParser() {
    console.log('🧪 Testing Dynamic Shortcut Parser:');
    console.log('');

    const testInputs = [
      '/le',
      '/lr',
      '/lh',
      '/ld',
      '/le deploy-to-production',
      '/lr --fix --all',
      '/lh my-component.tsx',
      '/nonexistent'
    ];

    for (const input of testInputs) {
      const result = this.parseInput(input);
      if (result.shortcut) {
        console.log(`✅ ${input.padEnd(25)} → ${result.expanded.padEnd(30)} [/${result.shortcut}]`);
      } else {
        console.log(`➡️  ${input.padEnd(25)} → ${result.expanded.padEnd(30)} [no change]`);
      }
    }
    console.log('');
  }

  showHelp() {
    console.log('🌙 Claude Code Dynamic Shortcuts');
    console.log('');
    console.log('Usage:');
    console.log('  claude-shortcuts parse <input>     Parse and expand input');
    console.log('  claude-shortcuts add <name> <cmd> Add user shortcut');
    console.log('  claude-shortcuts remove <name>    Remove user shortcut');
    console.log('  claude-shortcuts list             List all shortcuts');
    console.log('  claude-shortcuts stats            Show usage statistics');
    console.log('  claude-shortcuts test             Test parser');
    console.log('  claude-shortcuts help             Show this help');
    console.log('');
    console.log('Built-in Shortcuts:');
    console.log('  /le    → /luna-execute');
    console.log('  /lr    → /luna-review');
    console.log('  /lh    → /luna-hig');
    console.log('  /ld    → /luna-deploy');
    console.log('  /lp    → /luna-plan');
    console.log('  /lt    → /luna-test');
    console.log('  /ldoc  → /luna-docs');
    console.log('  /lm    → /luna-monitor');
    console.log('');
    console.log('Examples:');
    console.log('  claude-shortcuts parse "/le deploy"');
    console.log('  claude-shortcuts add "mycmd" "/luna-execute --custom"');
    console.log('  claude-shortcuts test');
  }

  execute(args) {
    const [command, ...rest] = args;

    switch (command) {
      case 'parse':
        if (!rest[0]) {
          console.error('Usage: claude-shortcuts parse <input>');
          process.exit(1);
        }
        const result = this.parseInput(rest[0]);
        if (result.shortcut) {
          console.log(`✅ Expanded: ${result.original} → ${result.expanded}`);
          console.log(`   Shortcut: /${result.shortcut} (${result.description})`);
        } else {
          console.log(`➡️  No shortcut found: ${result.original}`);
        }
        break;

      case 'add':
        if (!rest[0] || !rest[1]) {
          console.error('Usage: claude-shortcuts add <name> <command>');
          process.exit(1);
        }
        this.addShortcut(rest[0], rest[1], rest[2]);
        break;

      case 'remove':
        if (!rest[0]) {
          console.error('Usage: claude-shortcuts remove <name>');
          process.exit(1);
        }
        this.removeShortcut(rest[0]);
        break;

      case 'list':
        this.listShortcuts();
        break;

      case 'stats':
        this.showStats();
        break;

      case 'test':
        this.testParser();
        break;

      case 'help':
      case '--help':
      case '-h':
        this.showHelp();
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.log('Use "claude-shortcuts help" to see available commands.');
        process.exit(1);
    }
  }
}

// CLI execution
if (require.main === module) {
  const shortcuts = new ClaudeShortcuts();
  shortcuts.execute(process.argv.slice(2));
}

module.exports = ClaudeShortcuts;
