/**
 * Key Management — list, add, remove, and rotate API keys
 *
 * Keys are stored in ~/.luna/credentials.yaml (chmod 600)
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import yaml from 'yaml';
import { createInterface } from 'node:readline';
import { PROVIDERS, type Provider } from '../core/llm-client.js';

const CRED_PATH = path.join(os.homedir(), '.luna', 'credentials.yaml');

function prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

function loadCredentials(): Record<string, string> {
    try {
        if (fs.existsSync(CRED_PATH)) {
            return yaml.parse(fs.readFileSync(CRED_PATH, 'utf-8')) || {};
        }
    } catch { /* ignore */ }
    return {};
}

function saveCredentials(creds: Record<string, string>): void {
    const dir = path.dirname(CRED_PATH);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CRED_PATH, yaml.stringify(creds), 'utf-8');
    fs.chmodSync(CRED_PATH, 0o600);
}

function maskKey(key: string): string {
    if (key.length <= 12) return '***';
    return key.slice(0, 7) + '...' + key.slice(-4);
}

/**
 * Open a URL in the user's default browser
 */
async function openUrl(url: string): Promise<void> {
    const { exec } = await import('node:child_process');
    const platform = process.platform;
    const cmd = platform === 'darwin' ? 'open'
        : platform === 'win32' ? 'start'
            : 'xdg-open';
    exec(`${cmd} "${url}"`);
}

// ─── Keys parent command ─────────────────────────────────────────────────────

export const keysCommand = new Command('keys')
    .alias('k')
    .description('Manage API keys for LLM providers');

// ─── luna keys list ──────────────────────────────────────────────────────────

keysCommand
    .command('list')
    .description('List all configured API keys')
    .action(() => {
        const creds = loadCredentials();
        const providerEntries = Object.entries(PROVIDERS) as [Provider, typeof PROVIDERS[Provider]][];

        console.log('');
        console.log(chalk.hex('#E8A317')('🌙 LunaOS — Configured Keys'));
        console.log('');

        let found = 0;

        for (const [key, info] of providerEntries) {
            const savedKey = creds[info.envVar] || process.env[info.envVar];
            if (savedKey) {
                found++;
                const source = creds[info.envVar] ? 'credentials.yaml' : 'env var';
                console.log(`  ${chalk.green('●')} ${chalk.white(info.name.padEnd(28))} ${chalk.dim(maskKey(savedKey))}  ${chalk.dim(`(${source})`)}`);
            } else {
                console.log(`  ${chalk.dim('○')} ${chalk.dim(info.name.padEnd(28))} ${chalk.dim('not configured')}`);
            }
        }

        // Check cloud token
        if (creds.cloud_token) {
            found++;
            console.log(`  ${chalk.green('●')} ${chalk.white('LunaOS Cloud'.padEnd(28))} ${chalk.dim(maskKey(creds.cloud_token))}  ${chalk.dim('(credentials.yaml)')}`);
        }

        console.log('');
        console.log(chalk.dim(`  ${found} key(s) configured · Stored in ${CRED_PATH}`));
        console.log('');
    });

// ─── luna keys add ───────────────────────────────────────────────────────────

keysCommand
    .command('add')
    .description('Add or update an API key for a provider')
    .argument('[provider]', 'Provider name (e.g. anthropic, openai, deepseek)')
    .option('--open', 'Open the provider\'s API key page in your browser')
    .action(async (providerArg?: string, options?: { open?: boolean }) => {
        const creds = loadCredentials();
        const providerList = Object.entries(PROVIDERS) as [Provider, typeof PROVIDERS[Provider]][];

        let provider: Provider;
        let providerInfo: typeof PROVIDERS[Provider];

        if (providerArg) {
            // Direct provider specified
            const match = providerList.find(([k]) => k === providerArg);
            if (!match) {
                console.log(chalk.red(`  ✗ Unknown provider: ${providerArg}`));
                console.log(chalk.dim(`  Available: ${providerList.map(([k]) => k).join(', ')}`));
                process.exit(1);
            }
            [provider, providerInfo] = match;
        } else {
            // Interactive selection
            console.log('');
            console.log(chalk.white.bold('  Choose provider:'));
            console.log('');
            providerList.forEach(([key, info], i) => {
                const configured = creds[info.envVar] ? chalk.green(' ✓') : '';
                console.log(`  ${chalk.cyan(String(i + 1).padStart(3))}  ${info.name}${configured}`);
            });
            console.log('');

            const choice = await prompt('  Provider [1]: ');
            const idx = parseInt(choice || '1', 10) - 1;
            const selected = providerList[idx] || providerList[0];
            [provider, providerInfo] = selected;
        }

        console.log('');
        console.log(chalk.white.bold(`  🔑 ${providerInfo.name} API Key`));
        console.log('');

        // Show key guide
        console.log(chalk.dim('  How to get your key:'));
        providerInfo.keyGuide.split('\n').forEach(line => {
            console.log(chalk.dim(`  ${line.trim()}`));
        });
        console.log('');

        // Open URL if requested
        if (options?.open) {
            console.log(`  ${chalk.cyan('→')} Opening ${chalk.cyan(providerInfo.signupUrl)}`);
            await openUrl(providerInfo.signupUrl);
            console.log('');
        } else {
            console.log(chalk.dim(`  URL: ${chalk.cyan(providerInfo.signupUrl)}`));
            console.log(chalk.dim(`  Tip: Use ${chalk.white('--open')} to auto-open in browser`));
            console.log('');
        }

        // Show existing key if configured
        const existing = creds[providerInfo.envVar];
        if (existing) {
            console.log(`  ${chalk.yellow('!')} Existing key: ${chalk.dim(maskKey(existing))}`);
            console.log('');
        }

        const apiKey = await prompt('  API Key: ');
        if (!apiKey) {
            console.log(chalk.yellow('  ⚠ No key entered, nothing changed'));
            return;
        }

        creds[providerInfo.envVar] = apiKey;
        saveCredentials(creds);

        const action = existing ? 'Updated' : 'Saved';
        console.log(`  ${chalk.green('✓')} ${action} ${providerInfo.name} key → ${chalk.dim('~/.luna/credentials.yaml')}`);
        console.log('');
    });

// ─── luna keys remove ────────────────────────────────────────────────────────

keysCommand
    .command('remove')
    .description('Remove an API key for a provider')
    .argument('<provider>', 'Provider name (e.g. anthropic, openai)')
    .action(async (providerArg: string) => {
        const creds = loadCredentials();
        const providerList = Object.entries(PROVIDERS) as [Provider, typeof PROVIDERS[Provider]][];

        const match = providerList.find(([k]) => k === providerArg);
        if (!match) {
            console.log(chalk.red(`  ✗ Unknown provider: ${providerArg}`));
            console.log(chalk.dim(`  Available: ${providerList.map(([k]) => k).join(', ')}`));
            process.exit(1);
        }

        const [, providerInfo] = match;

        if (!creds[providerInfo.envVar]) {
            console.log(chalk.yellow(`  ⚠ No key configured for ${providerInfo.name}`));
            return;
        }

        const confirm = await prompt(`  Remove ${providerInfo.name} key? [y/N]: `);
        if (confirm.toLowerCase() !== 'y') {
            console.log(chalk.dim('  Cancelled'));
            return;
        }

        delete creds[providerInfo.envVar];
        saveCredentials(creds);

        console.log(`  ${chalk.green('✓')} Removed ${providerInfo.name} key`);
        console.log('');
    });

// ─── luna keys rotate ────────────────────────────────────────────────────────

keysCommand
    .command('rotate')
    .description('Rotate a provider API key (opens provider page, enter new key)')
    .argument('<provider>', 'Provider name (e.g. anthropic, openai)')
    .action(async (providerArg: string) => {
        const creds = loadCredentials();
        const providerList = Object.entries(PROVIDERS) as [Provider, typeof PROVIDERS[Provider]][];

        const match = providerList.find(([k]) => k === providerArg);
        if (!match) {
            console.log(chalk.red(`  ✗ Unknown provider: ${providerArg}`));
            process.exit(1);
        }

        const [, providerInfo] = match;

        console.log('');
        console.log(chalk.white.bold(`  🔄 Rotate ${providerInfo.name} Key`));
        console.log('');

        const oldKey = creds[providerInfo.envVar];
        if (oldKey) {
            console.log(`  ${chalk.dim('Current key:')} ${maskKey(oldKey)}`);
        } else {
            console.log(chalk.dim('  No existing key — this will add a new key'));
        }

        console.log('');
        console.log(`  ${chalk.cyan('→')} Opening ${chalk.cyan(providerInfo.signupUrl)}`);
        await openUrl(providerInfo.signupUrl);
        console.log(chalk.dim('  1. Create a new API key in your provider dashboard'));
        console.log(chalk.dim('  2. Paste the new key below'));
        if (oldKey) {
            console.log(chalk.dim('  3. After confirming, revoke the old key in your dashboard'));
        }
        console.log('');

        const newKey = await prompt('  New API Key: ');
        if (!newKey) {
            console.log(chalk.yellow('  ⚠ No key entered, rotation cancelled'));
            return;
        }

        if (oldKey && newKey === oldKey) {
            console.log(chalk.yellow('  ⚠ New key is the same as the old key'));
            return;
        }

        creds[providerInfo.envVar] = newKey;
        saveCredentials(creds);

        console.log('');
        console.log(`  ${chalk.green('✓')} Key rotated successfully`);
        if (oldKey) {
            console.log(`  ${chalk.yellow('!')} Old key: ${maskKey(oldKey)}`);
            console.log(chalk.yellow('  ⚠ Remember to revoke the old key in your provider dashboard!'));
        }
        console.log('');
    });

// ─── luna keys test ──────────────────────────────────────────────────────────

keysCommand
    .command('test')
    .description('Test an API key by making a minimal API call')
    .argument('[provider]', 'Provider to test (defaults to configured provider)')
    .action(async (providerArg?: string) => {
        const creds = loadCredentials();
        const providerList = Object.entries(PROVIDERS) as [Provider, typeof PROVIDERS[Provider]][];

        // Find provider to test
        let provider: Provider;
        let providerInfo: typeof PROVIDERS[Provider];

        if (providerArg) {
            const match = providerList.find(([k]) => k === providerArg);
            if (!match) {
                console.log(chalk.red(`  ✗ Unknown provider: ${providerArg}`));
                process.exit(1);
            }
            [provider, providerInfo] = match;
        } else {
            // Try to find from .luna/config.yaml
            try {
                const configPath = path.join(process.cwd(), '.luna', 'config.yaml');
                const config = yaml.parse(fs.readFileSync(configPath, 'utf-8'));
                provider = config.provider;
                providerInfo = PROVIDERS[provider];
            } catch {
                console.log(chalk.yellow('  ⚠ No provider specified. Use: luna keys test <provider>'));
                process.exit(1);
            }
        }

        const apiKey = creds[providerInfo.envVar] || process.env[providerInfo.envVar];
        if (!apiKey) {
            console.log(chalk.red(`  ✗ No API key for ${providerInfo.name}`));
            console.log(chalk.dim(`  Run: luna keys add ${provider}`));
            process.exit(1);
        }

        console.log('');
        console.log(`  Testing ${chalk.white(providerInfo.name)} (${providerInfo.defaultModel})...`);

        const start = Date.now();

        try {
            let response: Response;

            if (providerInfo.apiStyle === 'anthropic') {
                response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                    },
                    body: JSON.stringify({
                        model: providerInfo.defaultModel,
                        max_tokens: 10,
                        messages: [{ role: 'user', content: 'Say "ok"' }],
                    }),
                });
            } else {
                response = await fetch(`${providerInfo.baseUrl}/v1/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        model: providerInfo.defaultModel,
                        max_tokens: 10,
                        messages: [{ role: 'user', content: 'Say "ok"' }],
                    }),
                });
            }

            const elapsed = Date.now() - start;

            if (response.ok) {
                console.log(`  ${chalk.green('✓')} ${providerInfo.name} — ${chalk.green('working')} (${elapsed}ms)`);
            } else {
                const body = await response.text();
                console.log(`  ${chalk.red('✗')} ${providerInfo.name} — HTTP ${response.status}`);
                console.log(chalk.dim(`  ${body.slice(0, 200)}`));
            }
        } catch (err: any) {
            console.log(`  ${chalk.red('✗')} ${providerInfo.name} — ${err.message}`);
        }

        console.log('');
    });
