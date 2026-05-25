/**
 * Login Command — authenticate CLI with LunaOS cloud
 *
 * Usage:
 *   luna login                  Interactive login
 *   luna login --browser        Open browser for OAuth
 *   luna login --key <key>      Authenticate with API key
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import yaml from 'yaml';
import { createInterface } from 'node:readline';
import { exec } from 'node:child_process';
import { handleError } from '../utils/error-handler.js';
import { getApiUrl, loadCredentials, saveCredentials } from '../utils/config-store.js';

const GLOBAL_DIR = path.join(os.homedir(), '.luna');
const CRED_PATH = path.join(GLOBAL_DIR, 'credentials.yaml');

function prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

function openUrl(url: string): void {
    const platform = process.platform;
    const cmd = platform === 'darwin' ? 'open'
        : platform === 'win32' ? 'start'
            : 'xdg-open';
    exec(`${cmd} "${url}"`);
}

export const loginCommand = new Command('login')
    .alias('auth')
    .description('Authenticate with LunaOS cloud')
    .addHelpText('after', `
Examples:
  luna login                   Interactive email/password login
  luna login --browser         Open browser for OAuth authentication
  luna login --key lnos_live_  Authenticate with an API key
  luna login --status          Check current authentication status
  luna login --logout          Remove stored credentials
`)
    .option('--browser', 'Open browser for OAuth authentication')
    .option('--key <apiKey>', 'Authenticate with an API key')
    .option('--status', 'Check current authentication status')
    .option('--logout', 'Remove stored credentials')
    .action(async (options) => {
        const API_BASE = getApiUrl();
        const creds = loadCredentials();

        console.log('');

        // ─── Status ──────────────────────────────
        if (options.status) {
            console.log(chalk.hex('#E8A317')('🌙 LunaOS Auth Status'));
            console.log('');

            if (creds.cloud_token) {
                // Try to verify token
                try {
                    const res = await fetch(`${API_BASE}/auth/me`, {
                        headers: { 'Authorization': `Bearer ${creds.cloud_token}` },
                    });
                    if (res.ok) {
                        const data = await res.json() as any;
                        console.log(`  ${chalk.green('✓')} Authenticated as ${chalk.white(data.user?.email || 'unknown')}`);
                        console.log(`  ${chalk.dim('Tier:')}  ${chalk.white(data.user?.tier || 'free')}`);
                        console.log(`  ${chalk.dim('Token:')} ${chalk.dim(creds.cloud_token.slice(0, 12) + '...')}`);
                    } else {
                        console.log(`  ${chalk.yellow('!')} Token stored but ${chalk.yellow('expired or invalid')}`);
                        console.log(chalk.dim('  Run: ') + chalk.cyan('luna login') + chalk.dim(' to re-authenticate'));
                    }
                } catch {
                    console.log(`  ${chalk.yellow('!')} Token stored but ${chalk.yellow('could not reach API')}`);
                    console.log(chalk.dim(`  API: ${API_BASE}`));
                }
            } else if (creds.LUNAOS_API_KEY || creds.api_key) {
                console.log(`  ${chalk.green('✓')} API key configured`);
            } else {
                console.log(`  ${chalk.dim('○')} Not authenticated`);
                console.log(chalk.dim('  Run: ') + chalk.cyan('luna login') + chalk.dim(' to get started'));
            }
            console.log('');
            return;
        }

        // ─── Logout ──────────────────────────────
        if (options.logout) {
            delete creds.cloud_token;
            delete creds.api_key;
            saveCredentials(creds);
            console.log(`  ${chalk.green('✓')} Logged out`);
            console.log(chalk.dim('  Credentials removed from ~/.luna/credentials.yaml'));
            console.log('');
            return;
        }

        // ─── API Key Auth ────────────────────────
        if (options.key) {
            const key = options.key as string;
            if (!key.startsWith('lnos_')) {
                console.log(chalk.red('  ✗ Invalid API key format'));
                console.log(chalk.dim('  API keys start with ') + chalk.white('lnos_live_') + chalk.dim(' or ') + chalk.white('lnos_test_'));
                console.log(chalk.dim('  Generate one at: ') + chalk.cyan('https://agents.lunaos.ai/dashboard/api-keys'));
                console.log('');
                return;
            }

            console.log(chalk.dim('  Verifying API key...'));

            try {
                const res = await fetch(`${API_BASE}/auth/me`, {
                    headers: { 'Authorization': `Bearer ${key}` },
                });

                if (res.ok) {
                    creds.cloud_token = key;
                    saveCredentials(creds);
                    const data = await res.json() as any;
                    console.log(`  ${chalk.green('✓')} Authenticated as ${chalk.white(data.user?.email || 'API key user')}`);
                    console.log(`  ${chalk.green('✓')} Key saved to ${chalk.dim('~/.luna/credentials.yaml')}`);
                } else {
                    console.log(chalk.red('  ✗ Invalid API key'));
                    console.log(chalk.dim('  Generate a new key at: ') + chalk.cyan('https://agents.lunaos.ai/dashboard/api-keys'));
                }
            } catch (err) {
                handleError(err, { command: 'login' });
            }
            console.log('');
            return;
        }

        // ─── Browser OAuth ───────────────────────
        if (options.browser) {
            console.log(chalk.hex('#E8A317')('🌙 LunaOS Browser Login'));
            console.log('');
            console.log(chalk.dim('  Opening browser...'));
            openUrl(`${API_BASE.replace('api.', 'agents.')}/auth/login?cli=true`);
            console.log('');
            console.log(chalk.dim('  After logging in, copy the token and paste it here:'));
            console.log('');

            const token = await prompt('  Token: ');
            if (!token) {
                console.log(chalk.yellow('  ⚠ No token entered'));
                console.log('');
                return;
            }

            creds.cloud_token = token;
            saveCredentials(creds);
            console.log(`  ${chalk.green('✓')} Token saved`);
            console.log('');
            return;
        }

        // ─── Interactive Email/Password ──────────
        console.log(chalk.hex('#E8A317')('🌙 LunaOS Login'));
        console.log('');

        if (creds.cloud_token) {
            console.log(`  ${chalk.yellow('!')} Already authenticated. Use ${chalk.cyan('--logout')} to sign out first.`);
            console.log('');
            return;
        }

        const action = await prompt('  [1] Log in  [2] Sign up  [1]: ');
        const isSignup = action === '2';
        console.log('');

        const email = await prompt('  Email: ');
        const password = await prompt('  Password: ');

        if (!email || !password) {
            console.log(chalk.red('  ✗ Email and password are required'));
            console.log('');
            return;
        }

        const endpoint = isSignup ? '/auth/signup' : '/auth/login';
        const body = isSignup
            ? JSON.stringify({ email, password, name: email.split('@')[0] })
            : JSON.stringify({ email, password });

        try {
            console.log('');
            console.log(chalk.dim(`  Connecting to ${API_BASE}...`));

            const response = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            });

            const data = await response.json() as any;

            if (!response.ok) {
                console.log(chalk.red(`  ✗ ${data.error || 'Authentication failed'}`));
                console.log('');
                return;
            }

            creds.cloud_token = data.token;
            saveCredentials(creds);

            console.log(`  ${chalk.green('✓')} ${isSignup ? 'Signed up' : 'Logged in'} as ${chalk.white(data.user?.email || email)}`);
            console.log(`  ${chalk.green('✓')} Token saved to ${chalk.dim('~/.luna/credentials.yaml')}`);
            console.log('');
            console.log(chalk.dim('  Try it now:'));
            console.log(`    ${chalk.cyan('luna run code-review --cloud')}   — run via cloud`);
            console.log(`    ${chalk.cyan('luna status')}                    — check your plan`);
            console.log(`    ${chalk.cyan('luna login --status')}            — verify auth`);
            console.log('');
        } catch (err) {
            handleError(err, { command: 'login' });
        }
    });
