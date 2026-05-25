import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import yaml from 'yaml';
import { createInterface } from 'node:readline';
import { exec } from 'node:child_process';
import { PROVIDERS, type Provider } from '../core/llm-client.js';

/**
 * Open a URL in the user's default browser
 */
function openUrl(url: string): void {
    const platform = process.platform;
    const cmd = platform === 'darwin' ? 'open'
        : platform === 'win32' ? 'start'
            : 'xdg-open';
    exec(`${cmd} "${url}"`);
}

function prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

const PROVIDER_LIST: Array<{ key: Provider; label: string; tag?: string }> = [
    { key: 'anthropic', label: 'Anthropic (Claude)', tag: '← recommended' },
    { key: 'openai', label: 'OpenAI (GPT-4o)' },
    { key: 'deepseek', label: 'DeepSeek', tag: '💰 cheapest' },
    { key: 'google', label: 'Google (Gemini)', tag: '🆓 free tier' },
    { key: 'xai', label: 'xAI (Grok)' },
    { key: 'groq', label: 'Groq', tag: '⚡ fastest' },
    { key: 'mistral', label: 'Mistral AI' },
    { key: 'cohere', label: 'Cohere (Command R+)' },
    { key: 'perplexity', label: 'Perplexity (Sonar)' },
    { key: 'together', label: 'Together AI' },
    { key: 'fireworks', label: 'Fireworks AI' },
    { key: 'openrouter', label: 'OpenRouter', tag: '🌐 200+ models' },
];

export const initCommand = new Command('init')
    .alias('i')
    .description('Initialize LunaOS in your project')
    .addHelpText('after', `
Examples:
  luna init                    Interactive setup — choose provider & enter API key
  luna init --skip-keys        Skip API key setup (set later with luna keys add)
  luna init --cloud            Connect to LunaOS cloud for remote execution
  luna init --open             Auto-open provider's API key page in browser
`)
    .option('--skip-keys', 'Skip API key setup')
    .option('--cloud', 'Configure cloud mode (sign up / log in to LunaOS)')
    .option('--open', 'Auto-open provider\'s API key page in browser')
    .option('--auto-key', 'Auto-extract API key using browser automation')
    .action(async (options) => {
        const projectName = path.basename(process.cwd());
        const lunaDir = path.join(process.cwd(), '.luna');
        const configPath = path.join(lunaDir, 'config.yaml');
        const reportsDir = path.join(lunaDir, 'reports');
        const globalDir = path.join(os.homedir(), '.luna');
        const credentialsPath = path.join(globalDir, 'credentials.yaml');

        console.log('');
        console.log(chalk.hex('#E8A317')('🌙 LunaOS Setup'));
        console.log(chalk.dim(`  Project: ${projectName}`));
        console.log('');

        // --- CLOUD MODE ---
        if (options.cloud) {
            console.log(chalk.white.bold('  ☁️  Cloud Mode Setup'));
            console.log(chalk.dim('  Connect to api.lunaos.ai for cloud agent execution'));
            console.log('');

            const API_BASE = process.env.LUNA_API_URL || 'https://api.lunaos.ai';

            // Check for existing token
            let existingCreds: Record<string, string> = {};
            if (fs.existsSync(credentialsPath)) {
                try {
                    existingCreds = yaml.parse(fs.readFileSync(credentialsPath, 'utf-8')) || {};
                } catch { /* ignore */ }
            }

            if (existingCreds.cloud_token) {
                console.log(`  ${chalk.green('✓')} Cloud token already configured`);
                console.log(chalk.dim('    To re-authenticate, delete ~/.luna/credentials.yaml and run again'));
                console.log('');
                return;
            }

            const choice = await prompt('  [1] Sign up  [2] Log in  [1]: ');
            const isSignup = (choice || '1') === '1';
            console.log('');

            const email = await prompt('  Email: ');
            const password = await prompt('  Password: ');

            if (!email || !password) {
                console.log(chalk.red('  ✗ Email and password are required'));
                process.exit(1);
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
                    process.exit(1);
                }

                // Save token
                fs.mkdirSync(globalDir, { recursive: true });
                existingCreds.cloud_token = data.token;
                fs.writeFileSync(credentialsPath, yaml.stringify(existingCreds), 'utf-8');
                fs.chmodSync(credentialsPath, 0o600);

                console.log(`  ${chalk.green('✓')} ${isSignup ? 'Signed up' : 'Logged in'} as ${chalk.white(data.user.email)}`);
                console.log(`  ${chalk.green('✓')} Token saved to ${chalk.dim('~/.luna/credentials.yaml')}`);
                console.log('');
                console.log(chalk.dim('  Try it now:'));
                console.log(`    ${chalk.cyan('luna run code-review --cloud')}   — run via cloud API`);
                console.log('');
            } catch (err: any) {
                console.log(chalk.red(`  ✗ Connection failed: ${err.message}`));
                console.log(chalk.dim(`    Make sure ${API_BASE} is reachable`));
                process.exit(1);
            }

            return;
        }

        // --- LOCAL MODE (existing flow) ---

        // Step 1: Choose provider
        console.log(chalk.white.bold('  Choose your LLM provider:'));
        console.log('');
        PROVIDER_LIST.forEach((p, i) => {
            const num = chalk.cyan(`  ${String(i + 1).padStart(2)}`);
            const tag = p.tag ? chalk.dim(` ${p.tag}`) : '';
            console.log(`${num}  ${p.label}${tag}`);
        });
        console.log('');

        const providerChoice = await prompt('  Provider [1]: ');
        const choiceIndex = parseInt(providerChoice || '1', 10) - 1;
        const selectedProvider = PROVIDER_LIST[choiceIndex] || PROVIDER_LIST[0];
        const provider = selectedProvider.key;
        const providerInfo = PROVIDERS[provider];
        const model = providerInfo.defaultModel;

        console.log(`  ${chalk.green('✓')} Selected: ${chalk.white(providerInfo.name)} (${chalk.dim(model)})`);

        // Step 2: API Key
        let existingCreds: Record<string, string> = {};
        if (fs.existsSync(credentialsPath)) {
            try {
                existingCreds = yaml.parse(fs.readFileSync(credentialsPath, 'utf-8')) || {};
            } catch { /* ignore */ }
        }

        const existingKey = existingCreds[providerInfo.envVar] || process.env[providerInfo.envVar];

        if (!options.skipKeys) {
            if (existingKey) {
                const masked = existingKey.slice(0, 7) + '...' + existingKey.slice(-4);
                console.log(`  ${chalk.green('✓')} API key found: ${chalk.dim(masked)}`);
            } else {
                console.log('');
                console.log(chalk.white.bold(`  🔑 ${providerInfo.name} API Key Setup`));

                let apiKey: string | null = null;

                if (options.autoKey) {
                    // Dynamic import to avoid loading heavy dependencies unless needed
                    const { KeyProvisioner } = await import('../core/key-provisioner.js');
                    const { OpenAIExtractor, AnthropicExtractor } = await import('../core/extractors/index.js');

                    let extractor = null;
                    if (provider === 'openai') extractor = new OpenAIExtractor();
                    else if (provider === 'anthropic') extractor = new AnthropicExtractor();

                    if (extractor) {
                        apiKey = await KeyProvisioner.provision(extractor);
                    } else {
                        console.log(chalk.yellow(`  ⚠ Auto-key not yet supported for ${providerInfo.name}. Please enter key manually.`));
                    }
                }

                if (!apiKey) {
                    console.log('');
                    console.log(chalk.dim(`  How to get your key:`));
                    providerInfo.keyGuide.split('\n').forEach(line => {
                        console.log(chalk.dim(`  ${line.trim()}`));
                    });
                    console.log('');
                    console.log(chalk.dim(`  URL: ${chalk.cyan(providerInfo.signupUrl)}`));
                    if (options.open && !options.autoKey) { // Don't open if auto-key failed or not used, unless explicit
                        console.log(`  ${chalk.cyan('→')} Opening in browser...`);
                        openUrl(providerInfo.signupUrl);
                    } else if (!options.autoKey) {
                        console.log(chalk.dim(`  Tip: Use ${chalk.white('--open')} to auto-open in browser`));
                        console.log(chalk.dim(`       Use ${chalk.white('--auto-key')} to auto-extract key`));
                    }
                    console.log('');

                    apiKey = await prompt(`  API Key: `);
                }

                if (apiKey) {
                    fs.mkdirSync(globalDir, { recursive: true });
                    existingCreds[providerInfo.envVar] = apiKey;
                    fs.writeFileSync(credentialsPath, yaml.stringify(existingCreds), 'utf-8');
                    fs.chmodSync(credentialsPath, 0o600);
                    console.log(`  ${chalk.green('✓')} Key saved to ${chalk.dim('~/.luna/credentials.yaml')}`);
                } else {
                    console.log(chalk.yellow(`  ⚠ No key provided. Set ${providerInfo.envVar} env var before running agents.`));
                }
            }
        }

        // Step 3: Create project .luna/ dir
        fs.mkdirSync(lunaDir, { recursive: true });
        fs.mkdirSync(reportsDir, { recursive: true });

        const config = {
            version: '1.0',
            project: projectName,
            provider,
            model,
            agents: {
                free: [
                    'code-review', 'testing-validation', 'documentation',
                    'deployment', 'requirements-analyzer', 'design-architect',
                ],
            },
            output: { dir: '.luna/reports', format: 'markdown' },
        };

        fs.writeFileSync(configPath, yaml.stringify(config), 'utf-8');
        fs.writeFileSync(path.join(lunaDir, '.gitignore'), 'reports/\n*.log\n', 'utf-8');

        console.log('');
        console.log(chalk.hex('#E8A317')('🌙 LunaOS initialized!'));
        console.log('');
        console.log(chalk.dim('  Created:'));
        console.log(`    ${chalk.green('✓')} .luna/config.yaml  ${chalk.dim(`(${providerInfo.name}, ${model})`)}`);
        console.log(`    ${chalk.green('✓')} .luna/reports/`);
        console.log('');
        console.log(chalk.dim('  Try it now:'));
        console.log(`    ${chalk.cyan('luna list')}              — see all 140+ commands`);
        console.log(`    ${chalk.cyan(`luna run code-review`)}   — review your code`);
        console.log('');
    });
