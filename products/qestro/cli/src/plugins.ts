/**
 * CLI Plugin System
 * Extensible architecture for adding custom commands and functionality
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  commands?: PluginCommand[];
  hooks?: PluginHook[];
  dependencies?: string[];
}

export interface PluginCommand {
  name: string;
  description: string;
  handler: string; // Function name in the plugin
  options?: PluginOption[];
}

export interface PluginOption {
  flags: string;
  description: string;
  defaultValue?: any;
}

export interface PluginHook {
  event: string;
  handler: string;
  priority?: number;
}

export class CLIPluginManager {
  private plugins: Map<string, any> = new Map();
  private hooks: Map<string, Function[]> = new Map();

  constructor(private pluginDir: string = path.join(process.cwd(), 'plugins')) {
    this.ensurePluginDirectory();
  }

  private ensurePluginDirectory(): void {
    if (!fs.existsSync(this.pluginDir)) {
      fs.mkdirSync(this.pluginDir, { recursive: true });
    }
  }

  /**
   * Load plugins from the plugin directory
   */
  async loadPlugins(): Promise<void> {
    if (!fs.existsSync(this.pluginDir)) {
      return;
    }

    const pluginFolders = fs.readdirSync(this.pluginDir)
      .filter(folder => fs.statSync(path.join(this.pluginDir, folder)).isDirectory());

    for (const folder of pluginFolders) {
      try {
        await this.loadPlugin(folder);
      } catch (error) {
        console.log(chalk.yellow(`⚠️  Failed to load plugin "${folder}": ${error.message}`));
      }
    }
  }

  /**
   * Load a single plugin
   */
  private async loadPlugin(pluginName: string): Promise<void> {
    const pluginPath = path.join(this.pluginDir, pluginName);
    const manifestPath = path.join(pluginPath, 'package.json');

    if (!fs.existsSync(manifestPath)) {
      throw new Error('Plugin manifest not found');
    }

    const manifest: PluginManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const mainPath = path.join(pluginPath, manifest.main);

    if (!fs.existsSync(mainPath)) {
      throw new Error(`Plugin main file not found: ${manifest.main}`);
    }

    // Dynamic import of plugin
    const pluginModule = require(mainPath);

    // Register plugin
    this.plugins.set(pluginName, {
      manifest,
      module: pluginModule,
      path: pluginPath
    });

    // Register hooks
    if (manifest.hooks) {
      for (const hook of manifest.hooks) {
        this.registerHook(hook.event, pluginModule[hook.handler], hook.priority);
      }
    }

    console.log(chalk.green(`✅ Loaded plugin: ${manifest.name} v${manifest.version}`));
  }

  /**
   * Register plugin commands to CLI program
   */
  registerCommands(program: Command): void {
    for (const [pluginName, plugin] of this.plugins) {
      const { manifest, module } = plugin;

      if (manifest.commands) {
        const pluginCommand = program
          .command(pluginName)
          .description(manifest.description);

        for (const command of manifest.commands) {
          const subCommand = pluginCommand
            .command(command.name)
            .description(command.description);

          // Add options
          if (command.options) {
            for (const option of command.options) {
              subCommand.option(option.flags, option.description, option.defaultValue);
            }
          }

          // Register handler
          subCommand.action((...args) => {
            if (module[command.handler]) {
              module[command.handler](...args);
            } else {
              console.log(chalk.red(`❌ Handler "${command.handler}" not found in plugin "${pluginName}"`));
            }
          });
        }
      }
    }
  }

  /**
   * Register event hook
   */
  registerHook(event: string, handler: Function, priority: number = 10): void {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }

    const hooks = this.hooks.get(event)!;
    hooks.push({ handler, priority });

    // Sort by priority (lower number = higher priority)
    hooks.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Execute event hooks
   */
  async executeHook(event: string, ...args: any[]): Promise<void> {
    const hooks = this.hooks.get(event);
    if (hooks) {
      for (const { handler } of hooks) {
        try {
          await handler(...args);
        } catch (error) {
          console.log(chalk.red(`❌ Hook execution failed for event "${event}": ${error.message}`));
        }
      }
    }
  }

  /**
   * List installed plugins
   */
  listPlugins(): void {
    console.log(chalk.blue.bold('🔌 Installed Plugins'));
    console.log('========================');

    if (this.plugins.size === 0) {
      console.log(chalk.gray('No plugins installed.'));
      console.log();
      console.log(chalk.cyan('Install plugins with:'));
      console.log('  qestro plugin install <plugin-name>');
      console.log('  qestro plugin create <plugin-name>');
      return;
    }

    for (const [pluginName, plugin] of this.plugins) {
      const { manifest } = plugin;
      console.log(chalk.green(`✅ ${manifest.name}`));
      console.log(chalk.gray(`   Version: ${manifest.version}`));
      console.log(chalk.gray(`   Description: ${manifest.description}`));
      console.log(chalk.gray(`   Author: ${manifest.author}`));

      if (manifest.commands && manifest.commands.length > 0) {
        console.log(chalk.gray(`   Commands: ${manifest.commands.map(cmd => cmd.name).join(', ')}`));
      }

      console.log();
    }
  }

  /**
   * Get plugin information
   */
  getPluginInfo(pluginName: string): any {
    return this.plugins.get(pluginName);
  }

  /**
   * Create a new plugin template
   */
  createPlugin(pluginName: string): void {
    const pluginPath = path.join(this.pluginDir, pluginName);

    if (fs.existsSync(pluginPath)) {
      throw new Error(`Plugin "${pluginName}" already exists`);
    }

    // Create plugin directory
    fs.mkdirSync(pluginPath, { recursive: true });

    // Create package.json manifest
    const manifest: PluginManifest = {
      name: pluginName,
      version: '1.0.0',
      description: `Questro CLI plugin: ${pluginName}`,
      author: 'Questro CLI User',
      main: 'index.js',
      commands: [
        {
          name: 'hello',
          description: 'Say hello from the plugin',
          handler: 'helloCommand'
        }
      ]
    };

    fs.writeFileSync(
      path.join(pluginPath, 'package.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Create main plugin file
    const pluginCode = `
/**
 * Questro CLI Plugin: ${pluginName}
 */

const chalk = require('chalk');

/**
 * Plugin hello command
 */
function helloCommand(options = {}) {
  console.log(chalk.blue('🔌 Hello from ${pluginName} plugin!'));
  console.log(chalk.gray('This is a sample plugin command.'));

  if (options.verbose) {
    console.log(chalk.cyan('Verbose mode enabled'));
  }
}

/**
 * Plugin initialization hook
 */
function onInit() {
  console.log(chalk.green('${pluginName} plugin initialized'));
}

module.exports = {
  helloCommand,
  onInit
};
`;

    fs.writeFileSync(path.join(pluginPath, 'index.js'), pluginCode);

    // Create README
    const readme = `# ${pluginName} Plugin

A Questro CLI plugin for ${pluginName} functionality.

## Installation

\`\`\`bash
qestro plugin install ${pluginName}
\`\`\`

## Usage

\`\`\`bash
qestro ${pluginName} hello --verbose
\`\`\`

## Development

Modify the files in this directory to add your plugin functionality.
`;

    fs.writeFileSync(path.join(pluginPath, 'README.md'), readme);

    console.log(chalk.green(`✅ Created plugin: ${pluginName}`));
    console.log(chalk.cyan(`Plugin location: ${pluginPath}`));
    console.log(chalk.yellow('Run "qestro plugin list" to see available plugins.'));
  }
}

export default CLIPluginManager;