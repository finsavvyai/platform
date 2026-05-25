/**
 * Configuration Commands for Questro CLI
 * Provides configuration management functionality
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { handleError } from '../utils/error-handler';
import { output, success, info, warning, header } from '../utils/output';

const createConfigCommands = (): Command => {
  const configCmd = new Command('config')
    .description('Configuration management commands')
    .alias('conf')
    .alias('cfg');

  // Show current configuration
  configCmd
    .command('show')
    .description('Show current configuration')
    .option('--profile <profile>', 'Show configuration for specific profile')
    .option('--format <format>', 'Output format (table|json|yaml)', 'table')
    .action(async (options) => {
      try {
        if (options.profile) {
          config.setProfile(options.profile);
        }

        const currentConfig = config.export();
        header(`Configuration - Profile: ${config.getCurrentProfile()}`);

        output.setFormat(options.format);
        output.output(currentConfig);
      } catch (err) {
        handleError(err, 'config show');
        process.exit(1);
      }
    });

  // Set configuration value
  configCmd
    .command('set <key> <value>')
    .description('Set a configuration value')
    .option('--profile <profile>', 'Set value for specific profile')
    .action(async (key: string, value: string, options) => {
      try {
        if (options.profile) {
          config.setProfile(options.profile);
        }

        // Parse value as JSON if it looks like JSON or starts with {
        let parsedValue: any = value;
        if (value.startsWith('{') || value.startsWith('[') || value === 'true' || value === 'false') {
          try {
            parsedValue = JSON.parse(value);
          } catch {
            // Keep as string if parsing fails
          }
        }

        config.set(key as any, parsedValue);
        success(`Configuration updated: ${key} = ${JSON.stringify(parsedValue)}`);
      } catch (err) {
        handleError(err, 'config set');
        process.exit(1);
      }
    });

  // Get configuration value
  configCmd
    .command('get <key>')
    .description('Get a configuration value')
    .option('--profile <profile>', 'Get value from specific profile')
    .action(async (key: string, options) => {
      try {
        if (options.profile) {
          config.setProfile(options.profile);
        }

        const value = config.get(key as any);
        console.log(JSON.stringify(value, null, 2));
      } catch (err) {
        handleError(err, 'config get');
        process.exit(1);
      }
    });

  // Validate configuration
  configCmd
    .command('validate')
    .description('Validate current configuration')
    .action(async () => {
      try {
        const validation = config.validate();

        if (validation.valid) {
          success('Configuration is valid');
        } else {
          warning('Configuration has issues:');
          validation.errors.forEach(error => console.log(`  - ${error}`));
          process.exit(1);
        }
      } catch (err) {
        handleError(err, 'config validate');
        process.exit(1);
      }
    });

  // Reset configuration
  configCmd
    .command('reset')
    .description('Reset configuration to defaults')
    .option('--force', 'Skip confirmation')
    .action(async (options) => {
      try {
        if (!options.force) {
          const { confirmed } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirmed',
              message: 'Are you sure you want to reset all configuration to defaults?',
              default: false,
            },
          ]);

          if (!confirmed) {
            info('Configuration reset cancelled');
            return;
          }
        }

        config.reset();
        success('Configuration reset to defaults');
      } catch (err) {
        handleError(err, 'config reset');
        process.exit(1);
      }
    });

  // List profiles
  configCmd
    .command('list-profiles')
    .description('List all configuration profiles')
    .action(async () => {
      try {
        const profiles = config.listProfiles();
        const currentProfile = config.getCurrentProfile();

        header('Configuration Profiles');

        profiles.forEach(profile => {
          const marker = profile === currentProfile ? chalk.green('●') : chalk.gray('○');
          console.log(`${marker} ${profile}`);
        });
      } catch (err) {
        handleError(err, 'config list-profiles');
        process.exit(1);
      }
    });

  return configCmd;
};

export const configCommands = createConfigCommands();