/**
 * `luna keystore` — manage macOS Keychain secrets and install shell helpers
 * (`list-secrets`, `get-secret`, `set-secret`) into ~/.zshrc or ~/.bashrc.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import {
    isSupported,
    listSecrets,
    getSecret,
    setSecret,
    deleteSecret,
    shellSnippet,
    installShellSnippet,
    parseEnvFile,
} from '../utils/keystore.js';

function prompt(question: string, opts: { silent?: boolean } = {}): Promise<string> {
    return new Promise((resolve) => {
        const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
        if (opts.silent) {
            const stdout = process.stdout as NodeJS.WriteStream & { _writeToOutput?: (s: string) => void };
            (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => {
                if (s.includes(question)) stdout.write(s);
                else stdout.write('*');
            };
        }
        rl.question(question, (answer) => { rl.close(); if (opts.silent) process.stdout.write('\n'); resolve(answer); });
    });
}

function guardPlatform(): void {
    if (!isSupported()) {
        console.log(chalk.red('  ✗ Keystore requires macOS (uses the Keychain `security` CLI).'));
        process.exit(1);
    }
}

export const keystoreCommand = new Command('keystore')
    .alias('ks')
    .description('Manage macOS Keychain secrets + install shell helpers');

keystoreCommand
    .command('list').alias('ls')
    .description('List indexed secret names')
    .action(() => {
        guardPlatform();
        const names = listSecrets();
        if (!names.length) {
            console.log(chalk.dim('  (no secrets indexed — try: luna keystore set <name> <value>)'));
            return;
        }
        console.log('');
        for (const n of names) console.log('  ' + chalk.cyan(n));
        console.log('');
        console.log(chalk.dim(`  ${names.length} secret(s) — values live in macOS Keychain`));
    });

keystoreCommand
    .command('get <name>').alias('g')
    .description('Print a secret value (use carefully — value goes to stdout)')
    .action((name: string) => {
        guardPlatform();
        const v = getSecret(name);
        if (v === null) { console.log(chalk.red(`  ✗ not found: ${name}`)); process.exit(1); }
        process.stdout.write(v + '\n');
    });

keystoreCommand
    .command('set <name> [value]').alias('s')
    .description('Store/update a secret (value prompted hidden if omitted)')
    .action(async (name: string, value?: string) => {
        guardPlatform();
        let v = value;
        if (!v) v = await prompt(`  value for ${chalk.cyan(name)}: `, { silent: true });
        if (!v) { console.log(chalk.yellow('  ⚠ empty value, nothing stored')); return; }
        setSecret(name, v);
        console.log(`  ${chalk.green('✓')} stored ${chalk.cyan(name)} in Keychain`);
    });

keystoreCommand
    .command('remove <name>').alias('rm')
    .description('Delete a secret from the Keychain and index')
    .action(async (name: string) => {
        guardPlatform();
        const ok = deleteSecret(name);
        console.log(ok
            ? `  ${chalk.green('✓')} removed ${chalk.cyan(name)}`
            : chalk.yellow(`  ⚠ ${name} not in Keychain (index pruned anyway)`));
    });

keystoreCommand
    .command('install')
    .description('Install list-secrets / get-secret / set-secret functions into your shell profile')
    .option('--shell <s>', 'zsh|bash (default: auto-detect)')
    .option('--print', 'print the snippet to stdout instead of writing the profile', false)
    .action(async (opts: { shell?: string; print?: boolean }) => {
        guardPlatform();
        if (opts.print) { process.stdout.write(shellSnippet()); return; }
        const shell = (opts.shell as 'zsh' | 'bash' | undefined)
            ?? (process.env.SHELL?.endsWith('bash') ? 'bash' : 'zsh');
        if (shell !== 'zsh' && shell !== 'bash') {
            console.log(chalk.red(`  ✗ --shell must be zsh or bash, got: ${shell}`));
            process.exit(1);
        }
        console.log('');
        console.log(chalk.white.bold('  Will install 3 shell functions:'));
        console.log('    ' + chalk.cyan('list-secrets') + '          show indexed secret names');
        console.log('    ' + chalk.cyan('get-secret <name>') + '     print value from Keychain');
        console.log('    ' + chalk.cyan('set-secret <n> <v>') + '    store value in Keychain');
        console.log('');
        const target = path.join(os.homedir(), shell === 'zsh' ? '.zshrc' : '.bashrc');
        const confirm = await prompt(`  Append to ${chalk.dim(target)}? [Y/n]: `);
        if (confirm.trim().toLowerCase() === 'n') { console.log(chalk.dim('  cancelled')); return; }
        const written = installShellSnippet(shell);
        console.log(`  ${chalk.green('✓')} installed → ${chalk.dim(written)}`);
        console.log(chalk.dim(`  backup: ${written}.luna-backup`));
        console.log(chalk.dim(`  reload: source ${written}`));
    });

keystoreCommand
    .command('import-env <file>')
    .description('Import KEY=VALUE entries from a .env file into the Keychain')
    .option('--prefix <p>', 'optional prefix to prepend to each key (e.g. "myapp-")', '')
    .option('--lower', 'lowercase keys before storing', false)
    .option('--dry-run', 'show what would be imported without writing', false)
    .action(async (file: string, opts: { prefix: string; lower: boolean; dryRun: boolean }) => {
        guardPlatform();
        if (!fs.existsSync(file)) { console.log(chalk.red(`  ✗ file not found: ${file}`)); process.exit(1); }
        const entries = parseEnvFile(fs.readFileSync(file, 'utf-8'));
        if (!entries.length) { console.log(chalk.yellow('  ⚠ no KEY=VALUE entries found')); return; }
        console.log('');
        console.log(chalk.white.bold(`  Importing ${entries.length} entries from ${chalk.dim(file)}`));
        if (opts.dryRun) console.log(chalk.dim('  (dry-run — nothing will be written)'));
        console.log('');
        for (const { key, value } of entries) {
            const name = opts.prefix + (opts.lower ? key.toLowerCase() : key);
            const masked = value.length <= 8 ? '***' : value.slice(0, 3) + '...' + value.slice(-2);
            if (opts.dryRun) {
                console.log(`  ${chalk.dim('•')} ${chalk.cyan(name)} = ${chalk.dim(masked)}`);
            } else {
                setSecret(name, value);
                console.log(`  ${chalk.green('✓')} ${chalk.cyan(name)} (${chalk.dim(masked)})`);
            }
        }
        console.log('');
        if (!opts.dryRun) {
            console.log(chalk.yellow(`  ⚠ delete ${file} or move it out of git after verifying.`));
        }
    });
