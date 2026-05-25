#!/usr/bin/env node

/**
 * Luna Shortcuts - Fixed Version
 * Simple, working shortcut management for Luna agents
 */

const fs = require('fs');
const path = require('path');

class LunaShortcuts {
  constructor() {
    this.configPath = path.join(process.cwd(), '.luna');
    this.shortcutsPath = path.join(this.configPath, 'shortcuts.json');
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
          hig: {
            name: "hig",
            description: "Run Apple HIG analysis",
            command: "luna-agents:luna-hig",
            category: "ui",
            tags: ["apple", "design", "hig"],
            usage_count: 0,
            created: new Date().toISOString()
          },
          "ui-pipeline": {
            name: "ui-pipeline",
            description: "Run complete UI analysis and fixes",
            command: "luna-agents:luna-hig && luna-agents:luna-ui-fix",
            category: "ui",
            tags: ["ui", "pipeline", "analysis"],
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

      fs.writeFileSync(this.shortcutsPath, JSON.stringify(defaultShortcuts, null, 2));
    }
  }

  loadShortcuts() {
    try {
      const data = fs.readFileSync(this.shortcutsPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading shortcuts:', error.message);
      process.exit(1);
    }
  }

  saveShortcuts(data) {
    try {
      fs.writeFileSync(this.shortcutsPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving shortcuts:', error.message);
      process.exit(1);
    }
  }

  showHelp() {
    console.log('🌙 Luna Shortcuts - Quick Access to Luna Agents');
    console.log('');
    console.log('Usage: luna-shortcuts [command] [options]');
    console.log('');
    console.log('Commands:');
    console.log('  list              List all available shortcuts');
    console.log('  show <name>       Show details of a shortcut');
    console.log('  run <name>        Execute a shortcut');
    console.log('  add <n> <c>       Add a new shortcut (same as create)');
    console.log('  create <n> <c>    Create custom shortcut');
    console.log('  delete <name>     Delete custom shortcut');
    console.log('  search <query>    Search shortcuts');
    console.log('  history           Show command history');
    console.log('  help              Show this help message');
    console.log('');
    console.log('Built-in Shortcuts:');
    console.log('  hig             → Apple HIG analysis');
    console.log('  ui-pipeline    → Complete UI analysis pipeline');
    console.log('');
    console.log('Examples:');
    console.log('  luna-shortcuts list');
    console.log('  luna-shortcuts run hig');
    console.log('  luna-shortcuts add "test-deploy" "npm test && npm run deploy"');
    console.log('  luna-shortcuts create "backup-db" "pg_dump mydb > backup.sql"');
    console.log('');
  }

  listShortcuts() {
    const data = this.loadShortcuts();

    console.log('🌙 Available Luna Shortcuts:');
    console.log('');

    // Group shortcuts by category
    const categories = {};
    for (const [name, shortcut] of Object.entries(data.shortcuts)) {
      const category = shortcut.category || 'general';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push({ name, ...shortcut });
    }

    for (const [category, shortcuts] of Object.entries(categories)) {
      console.log(`${category.toUpperCase()}:`);
      for (const shortcut of shortcuts) {
        const tags = shortcut.tags ? ` [${shortcut.tags.join(', ')}]` : '';
        console.log(`  ${shortcut.name.padEnd(15)} → ${shortcut.description}${tags}`);
      }
      console.log('');
    }
  }

  showShortcut(name) {
    const data = this.loadShortcuts();
    const shortcut = data.shortcuts[name];

    if (!shortcut) {
      console.error(`Shortcut '${name}' not found.`);
      console.log('Use "luna-shortcuts list" to see available shortcuts.');
      process.exit(1);
    }

    console.log(`🌙 Shortcut: ${shortcut.name}`);
    console.log(`Description: ${shortcut.description}`);
    console.log(`Command: ${shortcut.command}`);
    console.log(`Category: ${shortcut.category}`);
    if (shortcut.tags && shortcut.tags.length > 0) {
      console.log(`Tags: ${shortcut.tags.join(', ')}`);
    }
    console.log(`Usage Count: ${shortcut.usage_count || 0}`);
    console.log(`Created: ${new Date(shortcut.created).toLocaleString()}`);
  }

  runShortcut(name) {
    const data = this.loadShortcuts();
    const shortcut = data.shortcuts[name];

    if (!shortcut) {
      console.error(`Shortcut '${name}' not found.`);
      console.log('Use "luna-shortcuts list" to see available shortcuts.');
      process.exit(1);
    }

    console.log(`🚀 Executing: ${shortcut.name}`);
    console.log(`Command: ${shortcut.command}`);
    console.log('');

    // Update usage count
    shortcut.usage_count = (shortcut.usage_count || 0) + 1;

    // Add to history
    data.history.unshift({
      shortcut: name,
      command: shortcut.command,
      timestamp: new Date().toISOString()
    });

    // Keep only last 100 history items
    if (data.history.length > 100) {
      data.history = data.history.slice(0, 100);
    }

    this.saveShortcuts(data);

    // Execute the command
    const { spawn } = require('child_process');
    const child = spawn(shortcut.command, { shell: true, stdio: 'inherit' });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Shortcut '${name}' completed successfully.`);
      } else {
        console.error(`❌ Shortcut '${name}' failed with exit code ${code}.`);
        process.exit(code);
      }
    });

    child.on('error', (error) => {
      console.error(`❌ Error executing shortcut '${name}': ${error.message}`);
      process.exit(1);
    });
  }

  createShortcut(name, command, options = {}) {
    const data = this.loadShortcuts();

    if (data.shortcuts[name]) {
      console.error(`Shortcut '${name}' already exists.`);
      console.log('Use a different name or delete the existing one first.');
      process.exit(1);
    }

    const shortcut = {
      name: name,
      description: options.description || `Custom shortcut: ${name}`,
      command: command,
      category: options.category || 'custom',
      tags: options.tags ? options.tags.split(',') : [],
      usage_count: 0,
      created: new Date().toISOString()
    };

    data.shortcuts[name] = shortcut;
    this.saveShortcuts(data);

    console.log(`✅ Created shortcut '${name}'`);
    console.log(`Description: ${shortcut.description}`);
    console.log(`Command: ${command}`);
  }

  deleteShortcut(name) {
    const data = this.loadShortcuts();

    if (!data.shortcuts[name]) {
      console.error(`Shortcut '${name}' not found.`);
      process.exit(1);
    }

    if (['hig', 'ui-pipeline'].includes(name)) {
      console.error(`Cannot delete built-in shortcut '${name}'.`);
      process.exit(1);
    }

    delete data.shortcuts[name];
    this.saveShortcuts(data);

    console.log(`✅ Deleted shortcut '${name}'`);
  }

  searchShortcuts(query) {
    const data = this.loadShortcuts();
    const results = [];
    const lowerQuery = query.toLowerCase();

    for (const [name, shortcut] of Object.entries(data.shortcuts)) {
      const matchesName = name.toLowerCase().includes(lowerQuery);
      const matchesDesc = shortcut.description.toLowerCase().includes(lowerQuery);
      const matchesTags = shortcut.tags && shortcut.tags.some(tag =>
        tag.toLowerCase().includes(lowerQuery)
      );
      const matchesCategory = shortcut.category && shortcut.category.toLowerCase().includes(lowerQuery);

      if (matchesName || matchesDesc || matchesTags || matchesCategory) {
        results.push({ name, ...shortcut });
      }
    }

    if (results.length === 0) {
      console.log(`No shortcuts found for: ${query}`);
    } else {
      console.log(`🔍 Search results for "${query}":`);
      console.log('');
      for (const shortcut of results) {
        const tags = shortcut.tags && shortcut.tags.length > 0 ? ` [${shortcut.tags.join(', ')}]` : '';
        console.log(`  ${shortcut.name.padEnd(15)} → ${shortcut.description}${tags}`);
      }
      console.log('');
    }
  }

  showHistory() {
    const data = this.loadShortcuts();

    if (data.history.length === 0) {
      console.log('No command history yet.');
      return;
    }

    console.log('📜 Command History:');
    console.log('');

    for (let i = 0; i < Math.min(10, data.history.length); i++) {
      const entry = data.history[i];
      const time = new Date(entry.timestamp).toLocaleString();
      console.log(`  ${entry.shortcut.padEnd(15)} → ${time}`);
    }

    if (data.history.length > 10) {
      console.log(`  ... and ${data.history.length - 10} more`);
    }
    console.log('');
  }

  execute(args) {
    const [command, ...rest] = args;

    switch (command) {
      case undefined:
      case 'list':
        return this.listShortcuts();

      case 'show':
        if (!rest[0]) {
          console.error('Usage: luna-shortcuts show <shortcut-name>');
          process.exit(1);
        }
        return this.showShortcut(rest[0]);

      case 'run':
        if (!rest[0]) {
          console.error('Usage: luna-shortcuts run <shortcut-name>');
          process.exit(1);
        }
        return this.runShortcut(rest[0]);

      case 'add':
        if (!rest[0] || !rest[1]) {
          console.error('Usage: luna-shortcuts add <name> <command> [--description="desc"] [--category=cat] [--tags=tag1,tag2]');
          process.exit(1);
        }
        return this.createShortcut(rest[0], rest[1], {
          description: this.extractOption(rest, '--description='),
          category: this.extractOption(rest, '--category=') || 'custom',
          tags: this.extractOption(rest, '--tags=')
        });

      case 'create':
        if (!rest[0] || !rest[1]) {
          console.error('Usage: luna-shortcuts create <name> <command> [--description="desc"] [--category=cat] [--tags=tag1,tag2]');
          process.exit(1);
        }
        return this.createShortcut(rest[0], rest[1], {
          description: this.extractOption(rest, '--description='),
          category: this.extractOption(rest, '--category=') || 'custom',
          tags: this.extractOption(rest, '--tags=')
        });

      case 'delete':
        if (!rest[0]) {
          console.error('Usage: luna-shortcuts delete <shortcut-name>');
          process.exit(1);
        }
        return this.deleteShortcut(rest[0]);

      case 'search':
        if (!rest[0]) {
          console.error('Usage: luna-shortcuts search <query>');
          process.exit(1);
        }
        return this.searchShortcuts(rest[0]);

      case 'history':
        return this.showHistory();

      case 'help':
      case '--help':
      case '-h':
        return this.showHelp();

      default:
        console.error(`Unknown command: ${command}`);
        console.log('Use "luna-shortcuts help" to see available commands.');
        process.exit(1);
    }
  }

  extractOption(args, option) {
    const optionArg = args.find(arg => arg.startsWith(option));
    return optionArg ? optionArg.substring(option.length) : null;
  }
}

// CLI execution
if (require.main === module) {
  const shortcuts = new LunaShortcuts();
  shortcuts.execute(process.argv.slice(2));
}

module.exports = LunaShortcuts;
