#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { UdpManager } from './udp-manager';
import { Logger } from './utils/logger';

const program = new Command();

program
  .name('udp')
  .description('Universal Dependency Platform NPM Plugin')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze udp.yml and validate cross-language dependencies')
  .option('-c, --config <file>', 'UDP configuration file', 'udp.yml')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (options) => {
    const logger = new Logger(options.verbose);
    const manager = new UdpManager(logger);

    try {
      await manager.analyze(options.config);
      logger.success('Analysis completed successfully');
    } catch (error) {
      logger.error('Analysis failed:', error);
      process.exit(1);
    }
  });

program
  .command('download')
  .description('Download cross-ecosystem dependencies from UDP service')
  .option('-c, --config <file>', 'UDP configuration file', 'udp.yml')
  .option('-o, --output <dir>', 'Output directory for dependencies', 'node_modules/.udp')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (options) => {
    const logger = new Logger(options.verbose);
    const manager = new UdpManager(logger);

    try {
      await manager.download(options.config, options.output);
      logger.success('Dependencies downloaded successfully');
    } catch (error) {
      logger.error('Download failed:', error);
      process.exit(1);
    }
  });

program
  .command('generate-bridges')
  .description('Generate bridge code for cross-language interoperability')
  .option('-c, --config <file>', 'UDP configuration file', 'udp.yml')
  .option('-o, --output <dir>', 'Output directory for bridge code', 'src/udp-bridges')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (options) => {
    const logger = new Logger(options.verbose);
    const manager = new UdpManager(logger);

    try {
      await manager.generateBridges(options.config, options.output);
      logger.success('Bridge code generated successfully');
    } catch (error) {
      logger.error('Bridge generation failed:', error);
      process.exit(1);
    }
  });

program
  .command('setup')
  .description('Complete UDP setup: analyze, download, and generate bridges')
  .option('-c, --config <file>', 'UDP configuration file', 'udp.yml')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (options) => {
    const logger = new Logger(options.verbose);
    const manager = new UdpManager(logger);

    try {
      await manager.setup(options.config);
      logger.success('UDP setup completed successfully');
    } catch (error) {
      logger.error('Setup failed:', error);
      process.exit(1);
    }
  });

program
  .command('install')
  .description('Install UDP and integrate with package.json scripts')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (options) => {
    const logger = new Logger(options.verbose);
    const manager = new UdpManager(logger);

    try {
      await manager.install();
      logger.success('UDP integration added to package.json');
    } catch (error) {
      logger.error('Installation failed:', error);
      process.exit(1);
    }
  });

program.parse();

export { UdpManager } from './udp-manager';
export { Logger } from './utils/logger';