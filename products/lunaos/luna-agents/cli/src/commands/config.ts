/**
 * Config Command — view and set configuration values
 *
 * Usage:
 *   luna config                         — show all config (merged)
 *   luna config get <key>               — get a single value
 *   luna config set <key> <value>       — set a value (global)
 *   luna config set <key> <value> -p    — set a value (project)
 *   luna config list                    — same as `luna config` with no args
 *   luna config path                    — show config file paths
 *
 * Examples:
 *   luna config set provider openai
 *   luna config set model gpt-4o
 *   luna config set cloud.apiUrl https://api.lunaos.ai
 *   luna config get provider
 */

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import {
    loadConfig,
    loadGlobalConfig,
    loadProjectConfig,
    setGlobalConfig,
    setProjectConfig,
    getConfig,
    flattenConfig,
    KNOWN_KEYS,
} from '../utils/config-store.js';

const GLOBAL_DIR = path.join(os.homedir(), '.luna');
const GLOBAL_CONFIG = path.join(GLOBAL_DIR, 'config.yaml');
const CRED_PATH = path.join(GLOBAL_DIR, 'credentials.yaml');

export const configCommand = new Command('config')
    .alias('cfg')
    .description('View and manage LunaOS configuration')
    .action(() => {
        showConfig();
    });

// ─── luna config list ────────────────────────────────

configCommand
    .command('list')
    .description('List all configuration values')
    .option('--global', 'Show global config only')
    .option('--project', 'Show project config only')
    .action((options) => {
        if (options.global) {
            showSection('Global Config', loadGlobalConfig(), GLOBAL_CONFIG);
        } else if (options.project) {
            const projPath = path.join(process.cwd(), '.luna', 'config.yaml');
            showSection('Project Config', loadProjectConfig(), projPath);
        } else {
            showConfig();
        }
    });

// ─── luna config get ─────────────────────────────────

configCommand
    .command('get')
    .description('Get a configuration value')
    .argument('<key>', 'Config key (e.g. provider, model, cloud.apiUrl)')
    .action((key: string) => {
        const value = getConfig(key);

        if (value === undefined) {
            console.log(chalk.dim(`  (not set)`));
        } else if (typeof value === 'object') {
            console.log(JSON.stringify(value, null, 2));
        } else {
            console.log(String(value));
        }
    });

// ─── luna config set ─────────────────────────────────

configCommand
    .command('set')
    .description('Set a configuration value')
    .argument('<key>', `Config key (e.g. ${KNOWN_KEYS.join(', ')})`)
    .argument('<value>', 'Value to set')
    .option('-p, --project', 'Set in project config instead of global')
    .action((key: string, value: string, options: { project?: boolean }) => {
        console.log('');

        if (options.project) {
            setProjectConfig(key, value);
            console.log(`  ${chalk.green('✓')} Set ${chalk.white(key)} = ${chalk.cyan(value)} ${chalk.dim('(project)')}`);
        } else {
            setGlobalConfig(key, value);
            console.log(`  ${chalk.green('✓')} Set ${chalk.white(key)} = ${chalk.cyan(value)} ${chalk.dim('(global)')}`);
        }

        console.log('');
    });

// ─── luna config set-key (shortcut for keys add) ─────

configCommand
    .command('set-key')
    .description('Quick shortcut to set a provider API key (alias for `luna keys add`)')
    .argument('[provider]', 'Provider name (e.g. anthropic, openai, deepseek)')
    .action(async (provider?: string) => {
        console.log('');
        console.log(chalk.dim('  Redirecting to: ') + chalk.cyan(`luna keys add ${provider || ''}`));
        console.log(chalk.dim('  For full key management, use: ') + chalk.cyan('luna keys'));
        console.log('');

        // Dynamically import and execute the keys add command
        const { keysCommand } = await import('./keys.js');
        const addCmd = keysCommand.commands.find(c => c.name() === 'add');
        if (addCmd) {
            await addCmd.parseAsync(provider ? ['node', 'luna', provider] : ['node', 'luna'], { from: 'user' });
        }
    });

// ─── luna config path ────────────────────────────────

configCommand
    .command('path')
    .description('Show configuration file paths')
    .action(() => {
        const projectConfig = path.join(process.cwd(), '.luna', 'config.yaml');

        console.log('');
        console.log(chalk.hex('#E8A317')('🌙 LunaOS Config Paths'));
        console.log('');
        console.log(`  ${chalk.dim('Global config:')}      ${chalk.white(GLOBAL_CONFIG)}   ${fs.existsSync(GLOBAL_CONFIG) ? chalk.green('✓') : chalk.dim('(not created)')}`);
        console.log(`  ${chalk.dim('Project config:')}     ${chalk.white(projectConfig)}   ${fs.existsSync(projectConfig) ? chalk.green('✓') : chalk.dim('(not created)')}`);
        console.log(`  ${chalk.dim('Credentials:')}        ${chalk.white(CRED_PATH)}   ${fs.existsSync(CRED_PATH) ? chalk.green('✓') : chalk.dim('(not created)')}`);
        console.log('');
        console.log(chalk.dim('  Resolution: project config > global config > defaults'));
        console.log('');
    });

// ─── Helpers ─────────────────────────────────────────

function showConfig(): void {
    const config = loadConfig();

    console.log('');
    console.log(chalk.hex('#E8A317')('🌙 LunaOS Configuration'));
    console.log('');

    const items = flattenConfig(config);

    if (items.length === 0) {
        console.log(chalk.dim('  No configuration set'));
        console.log(chalk.dim('  Run: ') + chalk.cyan('luna init') + chalk.dim(' or ') + chalk.cyan('luna config set <key> <value>'));
    } else {
        const maxKeyLen = Math.max(...items.map(i => i.key.length), 10);
        for (const { key, value } of items) {
            // Mask sensitive values
            const displayValue = key.includes('key') || key.includes('token') || key.includes('secret')
                ? chalk.dim(maskValue(value))
                : chalk.white(value);
            console.log(`  ${chalk.cyan(key.padEnd(maxKeyLen + 2))} ${displayValue}`);
        }
    }

    console.log('');
}

function showSection(title: string, config: Record<string, any>, filePath: string): void {
    console.log('');
    console.log(chalk.hex('#E8A317')(`🌙 ${title}`));
    console.log(chalk.dim(`  ${filePath}`));
    console.log('');

    const items = flattenConfig(config);

    if (items.length === 0) {
        console.log(chalk.dim('  (empty)'));
    } else {
        const maxKeyLen = Math.max(...items.map(i => i.key.length), 10);
        for (const { key, value } of items) {
            console.log(`  ${chalk.cyan(key.padEnd(maxKeyLen + 2))} ${chalk.white(value)}`);
        }
    }

    console.log('');
}

function maskValue(value: string): string {
    if (value.length <= 12) return '***';
    return value.slice(0, 7) + '...' + value.slice(-4);
}
