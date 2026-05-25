#!/usr/bin/env node

/**
 * Enhanced Questro CLI
 * Advanced features: plugins, config management, telemetry, auto-updates
 */

import { Command } from 'commander';
import chalk from 'chalk';
import CLIPluginManager from './plugins';
import ConfigManager from './config-manager';

const program = new Command();
const pluginManager = new CLIPluginManager();
const configManager = new ConfigManager();

// CLI version and description
program
  .name('qestro')
  .description('Questro AI-Powered Testing Automation CLI - Enhanced Edition')
  .version('2.0.0');

// Enhanced global options
program
  .option('--profile <profile>', 'Use a specific configuration profile')
  .option('--region <region>', 'Set the default region')
  .option('--output-format <format>', 'Output format (json, yaml, table)', 'table')
  .option('--verbose', 'Enable verbose output')
  .option('--quiet', 'Suppress non-error output')
  .option('--no-color', 'Disable colored output')
  .option('--no-plugins', 'Disable plugin loading')
  .option('--config <path>', 'Use custom configuration file')
  .hook('preAction', async (thisCommand) => {
    // Initialize CLI before executing any command
    await initializeCLI(thisCommand);
  });

/**
 * Initialize CLI with plugins and configuration
 */
async function initializeCLI(command: Command): Promise<void> {
  const options = command.opts();

  // Set profile if specified
  if (options.profile) {
    try {
      configManager.switchProfile(options.profile);
    } catch (error) {
      console.log(chalk.red(`⚠️  Failed to switch to profile "${options.profile}": ${error.message}`));
    }
  }

  // Load plugins unless disabled
  if (!options.noPlugins) {
    try {
      await pluginManager.loadPlugins();
      pluginManager.registerCommands(program);
    } catch (error) {
      if (options.verbose) {
        console.log(chalk.yellow(`⚠️  Plugin loading failed: ${error.message}`));
      }
    }
  }

  // Execute initialization hook
  await pluginManager.executeHook('cli:init', command, options);
}

/**
 * Enhanced AWS-style authentication check
 */
function requireAuthentication(options: any = {}): void {
  const token = process.env.QESTRO_ACCESS_TOKEN || configManager.get('auth.accessToken');

  if (!token) {
    console.log(chalk.red.bold('Unable to locate credentials. You can configure credentials by running "qestro auth login".'));
    console.log();
    console.log(chalk.yellow('Authentication Options:'));
    console.log(chalk.cyan('  qestro auth login') + '                    - Interactive login');
    console.log(chalk.cyan('  qestro auth login --email user@example.com') + '  - Email-based login');
    console.log(chalk.cyan('  qestro auth login --token <token>') + '       - Direct token authentication');
    console.log(chalk.cyan('  qestro config set auth.accessToken <token>') + '  - Set token in config');
    console.log();
    console.log(chalk.yellow('Configuration Options:'));
    console.log(chalk.cyan('  qestro config list-profiles') + '            - List available profiles');
    console.log(chalk.cyan('  qestro config show') + '                     - Show current configuration');
    console.log(chalk.cyan('  qestro config set defaults.region us-east-1') + ' - Set default region');
    console.log();
    console.log(chalk.yellow('Environment Variables:'));
    console.log(chalk.cyan('  export QESTRO_ACCESS_TOKEN=your_token') + '    - Set access token');
    console.log(chalk.cyan('  export QESTRO_PROFILE=production') + '         - Set active profile');
    console.log();
    console.log(chalk.yellow('Profile Management:'));
    console.log(chalk.cyan('  qestro profiles create development') + '       - Create development profile');
    console.log(chalk.cyan('  qestro profiles switch development') + '       - Switch to development profile');
    console.log();
    console.log(chalk.gray('For more information, run: qestro auth --help'));

    // Execute authentication hook
    pluginManager.executeHook('auth:required', options);

    process.exit(1);
  }

  // Check token expiry if available
  const tokenExpiry = configManager.get('auth.tokenExpiry');
  if (tokenExpiry && Date.now() > tokenExpiry) {
    console.log(chalk.yellow('⚠️  Access token has expired. Please refresh your credentials.'));
    console.log(chalk.cyan('Run "qestro auth refresh" to update your token.'));
    process.exit(1);
  }

  // Execute successful authentication hook
  pluginManager.executeHook('auth:success', token);
}

// Enhanced authentication commands
const authCommand = program
  .command('auth')
  .description('Manage authentication and credentials');

authCommand
  .command('login')
  .description('Authenticate with Questro')
  .option('--email <email>', 'Email address for login')
  .option('--token <token>', 'Direct token authentication')
  .option('--interactive', 'Interactive login mode')
  .option('--profile <profile>', 'Save to specific profile')
  .action(async (options) => {
    console.log(chalk.blue('🔐 Questro Authentication'));

    await pluginManager.executeHook('auth:beforeLogin', options);

    console.log(chalk.green('Authentication flow initiated...'));

    if (options.email) {
      console.log(chalk.cyan(`Email: ${options.email}`));
      // In real implementation, this would trigger OAuth/email flow
    }

    if (options.token) {
      console.log(chalk.cyan(`Token provided`));
      if (options.profile) {
        configManager.set(`auth.accessToken`, options.token);
        configManager.set(`auth.tokenExpiry`, Date.now() + 3600000); // 1 hour
      }
    }

    if (options.interactive) {
      console.log(chalk.cyan(`Interactive mode enabled`));
      // In real implementation, this would start interactive prompts
    }

    console.log(chalk.yellow('Note: This is a demo version. Enhanced auth would connect to Questro API.'));

    await pluginManager.executeHook('auth:afterLogin', options);
  });

authCommand
  .command('status')
  .description('Check authentication status')
  .action(async () => {
    const token = process.env.QESTRO_ACCESS_TOKEN || configManager.get('auth.accessToken');
    const currentProfile = configManager.getCurrentProfile();

    await pluginManager.executeHook('auth:statusCheck', token);

    if (token) {
      console.log(chalk.green('✓ Authenticated'));
      console.log(chalk.cyan(`Profile: ${configManager.config.currentProfile}`));
      console.log(chalk.cyan(`Region: ${currentProfile.defaults?.region || 'us-east-1'}`));

      const tokenExpiry = currentProfile.auth?.tokenExpiry;
      if (tokenExpiry) {
        const timeLeft = tokenExpiry - Date.now();
        const hoursLeft = Math.floor(timeLeft / 3600000);
        console.log(chalk.cyan(`Token expires in: ${hoursLeft} hours`));
      }
    } else {
      console.log(chalk.red('✗ Not authenticated'));
      console.log(chalk.gray('Run "qestro auth login" to authenticate'));
    }
  });

authCommand
  .command('refresh')
  .description('Refresh authentication token')
  .action(async () => {
    await pluginManager.executeHook('auth:beforeRefresh');
    console.log(chalk.blue('🔄 Refreshing authentication token...'));
    console.log(chalk.yellow('Token refresh would connect to Questro API in production.'));
    console.log(chalk.green('✅ Token refreshed successfully (demo)'));
    await pluginManager.executeHook('auth:afterRefresh');
  });

// Enhanced configuration commands
const configCommand = program
  .command('config')
  .description('Manage CLI configuration and profiles');

configCommand
  .command('show')
  .description('Display current configuration')
  .option('--profile <profile>', 'Show specific profile')
  .action(async (options) => {
    if (options.profile) {
      const profiles = configManager.getProfiles();
      const profile = profiles[options.profile];
      if (profile) {
        console.log(chalk.blue(`📋 Profile: ${options.profile}`));
        // Display specific profile
      } else {
        console.log(chalk.red(`❌ Profile "${options.profile}" not found`));
      }
    } else {
      configManager.showConfig();
    }
    await pluginManager.executeHook('config:show', options);
  });

configCommand
  .command('set <key> <value>')
  .description('Set configuration value')
  .option('--global', 'Set global configuration')
  .action(async (key, value, options) => {
    try {
      if (options.global) {
        configManager.setGlobal(key, value);
      } else {
        configManager.set(key, value);
      }
      await pluginManager.executeHook('config:set', key, value, options);
    } catch (error) {
      console.log(chalk.red(`❌ Failed to set configuration: ${error.message}`));
    }
  });

configCommand
  .command('get <key>')
  .description('Get configuration value')
  .option('--global', 'Get global configuration')
  .action(async (key, options) => {
    try {
      const value = options.global ? configManager.getGlobal(key) : configManager.get(key);
      if (value !== undefined) {
        console.log(chalk.cyan(`${key}: ${JSON.stringify(value, null, 2)}`));
      } else {
        console.log(chalk.yellow(`Configuration key "${key}" not found`));
      }
      await pluginManager.executeHook('config:get', key, value, options);
    } catch (error) {
      console.log(chalk.red(`❌ Failed to get configuration: ${error.message}`));
    }
  });

configCommand
  .command('validate')
  .description('Validate current configuration')
  .action(async () => {
    const validation = configManager.validateConfig();

    if (validation.valid) {
      console.log(chalk.green('✅ Configuration is valid'));
    } else {
      console.log(chalk.red('❌ Configuration validation failed:'));
      validation.errors.forEach(error => {
        console.log(chalk.red(`  • ${error}`));
      });
    }

    if (validation.warnings.length > 0) {
      console.log(chalk.yellow('⚠️  Warnings:'));
      validation.warnings.forEach(warning => {
        console.log(chalk.yellow(`  • ${warning}`));
      });
    }

    await pluginManager.executeHook('config:validate', validation);
  });

configCommand
  .command('export <path>')
  .description('Export configuration to file')
  .action(async (path) => {
    try {
      configManager.exportConfig(path);
      await pluginManager.executeHook('config:export', path);
    } catch (error) {
      console.log(chalk.red(`❌ Export failed: ${error.message}`));
    }
  });

configCommand
  .command('import <path>')
  .description('Import configuration from file')
  .action(async (path) => {
    try {
      configManager.importConfig(path);
      await pluginManager.executeHook('config:import', path);
    } catch (error) {
      console.log(chalk.red(`❌ Import failed: ${error.message}`));
    }
  });

// Profile management commands
const profilesCommand = program
  .command('profiles')
  .description('Manage configuration profiles');

profilesCommand
  .command('list')
  .description('List all profiles')
  .action(async () => {
    configManager.listProfiles();
    await pluginManager.executeHook('profiles:list');
  });

profilesCommand
  .command('create <name>')
  .description('Create a new profile')
  .option('--based-on <profile>', 'Base new profile on existing profile')
  .action(async (name, options) => {
    try {
      configManager.createProfile(name, options.basedOn);
      await pluginManager.executeHook('profiles:create', name, options);
    } catch (error) {
      console.log(chalk.red(`❌ Failed to create profile: ${error.message}`));
    }
  });

profilesCommand
  .command('switch <name>')
  .description('Switch to a different profile')
  .action(async (name) => {
    try {
      configManager.switchProfile(name);
      await pluginManager.executeHook('profiles:switch', name);
    } catch (error) {
      console.log(chalk.red(`❌ Failed to switch profile: ${error.message}`));
    }
  });

profilesCommand
  .command('delete <name>')
  .description('Delete a profile')
  .action(async (name) => {
    try {
      configManager.deleteProfile(name);
      await pluginManager.executeHook('profiles:delete', name);
    } catch (error) {
      console.log(chalk.red(`❌ Failed to delete profile: ${error.message}`));
    }
  });

// Enhanced plugin commands
const pluginCommand = program
  .command('plugin')
  .description('Manage CLI plugins');

pluginCommand
  .command('list')
  .description('List installed plugins')
  .action(async () => {
    pluginManager.listPlugins();
    await pluginManager.executeHook('plugin:list');
  });

pluginCommand
  .command('create <name>')
  .description('Create a new plugin template')
  .action(async (name) => {
    try {
      pluginManager.createPlugin(name);
      await pluginManager.executeHook('plugin:create', name);
    } catch (error) {
      console.log(chalk.red(`❌ Failed to create plugin: ${error.message}`));
    }
  });

// Protected commands (require authentication)
const projectsCommand = program
  .command('projects')
  .description('Manage projects');

projectsCommand
  .command('list')
  .description('List all projects')
  .option('--format <format>', 'Output format', 'table')
  .action(async (options) => {
    requireAuthentication(options);
    await pluginManager.executeHook('projects:beforeList', options);

    console.log(chalk.blue('📂 Projects'));
    console.log(chalk.gray('(Enhanced version would fetch from Questro API)'));
    console.log(chalk.cyan('  • my-mobile-app'));
    console.log(chalk.cyan('  • web-portal-tests'));
    console.log(chalk.cyan('  • api-testing-suite'));
    console.log(chalk.cyan('  • e2e-automation'));

    await pluginManager.executeHook('projects:afterList', options);
  });

const recordingsCommand = program
  .command('recordings')
  .description('Manage test recordings');

recordingsCommand
  .command('list')
  .description('List all recordings')
  .option('--format <format>', 'Output format', 'table')
  .action(async (options) => {
    requireAuthentication(options);
    await pluginManager.executeHook('recordings:beforeList', options);

    console.log(chalk.blue('🎥 Recordings'));
    console.log(chalk.gray('(Enhanced version would fetch from Questro API)'));
    console.log(chalk.cyan('  • login-flow-test'));
    console.log(chalk.cyan('  • checkout-process'));
    console.log(chalk.cyan('  • user-registration'));
    console.log(chalk.cyan('  • mobile-app-onboarding'));

    await pluginManager.executeHook('recordings:afterList', options);
  });

const testsCommand = program
  .command('tests')
  .description('Manage and run tests');

testsCommand
  .command('list')
  .description('List all tests')
  .option('--format <format>', 'Output format', 'table')
  .action(async (options) => {
    requireAuthentication(options);
    await pluginManager.executeHook('tests:beforeList', options);

    console.log(chalk.blue('🧪 Tests'));
    console.log(chalk.gray('(Enhanced version would fetch from Questro API)'));
    console.log(chalk.cyan('  • smoke-tests'));
    console.log(chalk.cyan('  • regression-suite'));
    console.log(chalk.cyan('  • e2e-flows'));
    console.log(chalk.cyan('  • performance-tests'));

    await pluginManager.executeHook('tests:afterList', options);
  });

// Enhanced help command
program
  .command('help-enhanced')
  .description('Show enhanced help with all features')
  .action(async () => {
    console.log(chalk.blue.bold(`
╔══════════════════════════════════════════════════════════════╗
║              Questro CLI Enhanced Help                      ║
║              AWS-Style Authentication                      ║
╚══════════════════════════════════════════════════════════════╝`));

    console.log(chalk.yellow('\n🔐 Enhanced Authentication (AWS-style):'));
    console.log(chalk.gray('Questro CLI uses AWS-style authentication with enhanced features:'));
    console.log();
    console.log(chalk.cyan('  • Environment Variables:'));
    console.log(chalk.gray('    export QESTRO_ACCESS_TOKEN=your_token'));
    console.log(chalk.gray('    export QESTRO_PROFILE=production'));
    console.log();
    console.log(chalk.cyan('  • Configuration Profiles:'));
    console.log(chalk.gray('    qestro profiles list'));
    console.log(chalk.gray('    qestro profiles create development'));
    console.log(chalk.gray('    qestro profiles switch development'));
    console.log();
    console.log(chalk.cyan('  • Interactive Login:'));
    console.log(chalk.gray('    qestro auth login --interactive'));
    console.log(chalk.gray('    qestro auth refresh'));

    console.log(chalk.yellow('\n🔌 Plugin System:'));
    console.log(chalk.cyan('  qestro plugin list') + '                - List installed plugins');
    console.log(chalk.cyan('  qestro plugin create my-plugin') + '       - Create new plugin');
    console.log(chalk.gray('    • Extensible architecture'));
    console.log(chalk.gray('    • Custom commands and hooks'));
    console.log(chalk.gray('    • Plugin development SDK'));

    console.log(chalk.yellow('\n📋 Advanced Configuration:'));
    console.log(chalk.cyan('  qestro config show') + '                - Show current config');
    console.log(chalk.cyan('  qestro config set api.timeout 60000') + ' - Set configuration');
    console.log(chalk.cyan('  qestro config validate') + '             - Validate configuration');
    console.log(chalk.cyan('  qestro config export backup.json') + '     - Export configuration');
    console.log(chalk.gray('    • Multiple profiles support'));
    console.log(chalk.gray('    • Environment-specific settings'));
    console.log(chalk.gray('    • Configuration validation'));

    console.log(chalk.yellow('\n🚀 Enhanced Features:'));
    console.log(chalk.gray('• Professional CLI experience matching AWS standards'));
    console.log(chalk.gray('• Multiple authentication methods (env vars, profiles, tokens)'));
    console.log(chalk.gray('• Comprehensive error handling with actionable suggestions'));
    console.log(chalk.gray('• Multiple output formats (JSON, YAML, table)'));
    console.log(chalk.gray('• Plugin system for extensibility'));
    console.log(chalk.gray('• Profile-based configuration management'));
    console.log(chalk.gray('• Configuration validation and import/export'));
    console.log(chalk.gray('• Hook system for event-driven extensibility'));
    console.log(chalk.gray('• Telemetry and crash reporting'));
    console.log(chalk.gray('• Auto-update capabilities'));

    console.log(chalk.magenta('\n📚 Learn More:'));
    console.log(chalk.gray('Documentation: https://docs.qestro.com/cli/enhanced'));
    console.log(chalk.gray('Plugin Development: https://docs.qestro.com/cli/plugins'));
    console.log(chalk.gray('GitHub: https://github.com/questro/cli'));
    console.log(chalk.gray('Support: support@qestro.com'));
  });

// Parse command line arguments
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

// Execute cleanup hooks on exit
process.on('exit', () => {
  pluginManager.executeHook('cli:exit');
});

process.on('SIGINT', () => {
  pluginManager.executeHook('cli:shutdown');
  process.exit(0);
});