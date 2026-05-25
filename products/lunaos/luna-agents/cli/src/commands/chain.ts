import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import yaml from 'yaml';
import { buildContext, formatContext } from '../core/context-builder.js';

const API_BASE = process.env.LUNA_API_URL || 'https://api.lunaos.ai';

const CHAIN_ICONS: Record<string, string> = {
    'full-review': '🔍',
    'new-feature': '✨',
    'deploy': '🚀',
    'security-audit': '🛡️',
    'api-design': '🔌',
};

/**
 * Resolve cloud token from ~/.luna/credentials.yaml
 */
function getCloudToken(): string | null {
    try {
        const credPath = path.join(os.homedir(), '.luna', 'credentials.yaml');
        if (fs.existsSync(credPath)) {
            const creds = yaml.parse(fs.readFileSync(credPath, 'utf-8'));
            return creds?.cloud_token || null;
        }
    } catch { /* ignore */ }
    return null;
}

export const chainCommand = new Command('chain')
    .alias('ch')
    .description('Run a multi-agent chain — agents execute sequentially, piping output forward')
    .argument('[preset]', 'Preset chain to run (e.g., full-review, new-feature, deploy, security-audit, api-design)')
    .addHelpText('after', `
Examples:
  luna chain                              List available chains
  luna chain full-review                  Run full code review chain
  luna chain new-feature                  Plan a new feature
  luna chain deploy -f deploy.yaml        Deploy with specific context
  luna chain security-audit -o report.md  Save audit report
  luna chain --list                       Show all preset chains

Preset chains:
  full-review      Code Review → Testing → Documentation
  new-feature      Requirements → Design → Planning → Execution
  deploy           Code Review → Testing → Deployment
  security-audit   Security Scan → Code Review
  api-design       API Generator → Database → Documentation
`)
    .option('-f, --files <files...>', 'Specific files to include as context')
    .option('--no-context', 'Skip auto-context gathering')
    .option('-o, --output <path>', 'Output file path')
    .option('--list', 'List available preset chains')
    .option('--verbose', 'Show debug info')
    .action(async (preset: string | undefined, options) => {
        const startTime = Date.now();

        // --- LIST MODE ---
        if (options.list || !preset) {
            await listChains();
            return;
        }

        console.log('');
        const icon = CHAIN_ICONS[preset] || '⛓️';
        console.log(chalk.hex('#E8A317')(`🌙 LunaOS Chain — ${icon} ${preset}`));
        console.log('');

        // 1. Get cloud token
        const token = getCloudToken();
        if (!token) {
            console.error(chalk.red('  ✗ No cloud token found'));
            console.error(chalk.dim('    Chains require cloud mode. Run:'));
            console.error(chalk.dim('    ') + chalk.cyan('luna init --cloud'));
            console.error(chalk.dim('    Or login at: ') + chalk.cyan('https://agents.lunaos.ai'));
            process.exit(1);
        }

        // 2. Gather context
        const spinner = ora({ text: 'Gathering project context...', color: 'yellow' }).start();
        let contextStr = '';

        if (options.context !== false) {
            try {
                const ctx = await buildContext(process.cwd());
                contextStr = formatContext(ctx);
                spinner.text = `Scanned ${ctx.files.length} files (${(ctx.files.reduce((a: number, f: { size: number }) => a + f.size, 0) / 1024).toFixed(0)} KB)`;
            } catch (error) {
                if (options.verbose) {
                    console.log(chalk.dim(`\n  Context gathering failed: ${error}`));
                }
            }
        }

        if (options.files && options.files.length > 0) {
            const filesContent = options.files.map((f: string) => {
                const fullPath = path.resolve(process.cwd(), f);
                if (!fs.existsSync(fullPath)) return `# ${f}\n(file not found)`;
                const content = fs.readFileSync(fullPath, 'utf-8');
                const ext = path.extname(f).slice(1);
                return `## ${f}\n\`\`\`${ext}\n${content}\n\`\`\``;
            }).join('\n\n');
            contextStr = `Please analyze the following files:\n\n${filesContent}`;
        }

        if (!contextStr) {
            contextStr = `Please provide guidance for a project in the current directory: ${path.basename(process.cwd())}`;
        }

        spinner.succeed('Context ready');

        // 3. Execute chain via cloud API
        console.log(chalk.dim(`  Mode: ☁️  cloud | Chain: ${preset}`));
        console.log(chalk.dim('─'.repeat(60)));
        console.log('');

        const execSpinner = ora({ text: 'Starting chain execution...', color: 'cyan' }).start();

        try {
            const response = await fetch(`${API_BASE}/chains/execute`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    preset,
                    context: contextStr,
                }),
            });

            if (!response.ok) {
                const err = await response.json() as any;
                throw new Error(err.error || `HTTP ${response.status}`);
            }

            // Parse SSE stream
            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');

            const decoder = new TextDecoder();
            let buffer = '';
            let fullOutput = '';
            let currentNode = '';
            let nodeCount = 0;
            let completedNodes = 0;

            execSpinner.stop();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data:')) continue;
                    const data = line.slice(5).trim();
                    if (!data) continue;

                    try {
                        const parsed = JSON.parse(data);

                        switch (parsed.event) {
                            case 'chain_start':
                                nodeCount = parsed.nodeCount || 0;
                                console.log(chalk.hex('#E8A317')(`  ⛓️  Chain: ${parsed.chainName || preset} (${nodeCount} agents)`));
                                console.log('');
                                break;

                            case 'node_start':
                                currentNode = parsed.label || parsed.nodeId || '';
                                console.log(chalk.cyan(`  ▶ [${completedNodes + 1}/${nodeCount}] ${currentNode}`));
                                break;

                            case 'node_complete': {
                                completedNodes++;
                                const duration = parsed.durationMs
                                    ? chalk.dim(` (${(parsed.durationMs / 1000).toFixed(1)}s)`)
                                    : '';
                                console.log(chalk.green(`  ✓ ${currentNode}${duration}`));

                                if (parsed.output) {
                                    fullOutput += (fullOutput ? '\n\n---\n\n' : '') + `## ${currentNode}\n\n${parsed.output}`;

                                    // Show truncated output
                                    const preview = parsed.output.split('\n').slice(0, 3).join('\n');
                                    if (preview.length < parsed.output.length) {
                                        console.log(chalk.dim(`    ${preview.split('\n')[0].slice(0, 80)}...`));
                                    }
                                }
                                console.log('');
                                break;
                            }

                            case 'chain_complete':
                                if (parsed.finalOutput && !fullOutput) {
                                    fullOutput = parsed.finalOutput;
                                }
                                break;

                            case 'error':
                                throw new Error(parsed.error || 'Chain execution failed');
                        }
                    } catch (parseErr: any) {
                        if (parseErr.message && !parseErr.message.includes('JSON')) {
                            throw parseErr;
                        }
                    }
                }
            }

            // 4. Show summary
            console.log(chalk.dim('─'.repeat(60)));
            console.log('');
            console.log(chalk.green(`  ✓ Chain complete — ${completedNodes}/${nodeCount} agents executed`));

            // 5. Save report
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            const reportDir = path.join(process.cwd(), '.luna', 'reports');
            const dateStr = new Date().toISOString().split('T')[0];
            const reportFilename = `chain-${preset}-${dateStr}.md`;
            const reportPath = options.output || path.join(reportDir, reportFilename);

            try {
                fs.mkdirSync(path.dirname(reportPath), { recursive: true });

                const reportContent = [
                    `# ${icon} ${preset} Chain Report`,
                    ``,
                    `**Date**: ${new Date().toISOString()}`,
                    `**Chain**: ${preset}`,
                    `**Agents**: ${completedNodes}/${nodeCount}`,
                    `**Duration**: ${duration}s`,
                    ``,
                    `---`,
                    ``,
                    fullOutput,
                ].join('\n');

                fs.writeFileSync(reportPath, reportContent, 'utf-8');
                console.log(chalk.green(`  ✓ Report saved: ${path.relative(process.cwd(), reportPath)}`));
            } catch {
                if (options.verbose) {
                    console.log(chalk.dim(`  Could not save report to ${reportPath}`));
                }
            }

            console.log(chalk.dim(`  ⏱ Completed in ${duration}s`));
            console.log('');

        } catch (error: any) {
            execSpinner.stop();
            console.error('');
            console.error(chalk.red(`  ✗ Chain execution failed: ${error.message}`));
            process.exit(1);
        }
    });

/**
 * List available preset chains
 */
async function listChains() {
    console.log('');
    console.log(chalk.hex('#E8A317')('🌙 LunaOS Chains'));
    console.log(chalk.dim('  Multi-agent workflows — agents run in sequence'));
    console.log('');

    const spinner = ora({ text: 'Loading chains...', color: 'yellow' }).start();

    try {
        const token = getCloudToken();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_BASE}/chains`, { headers });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json() as any;
        const presets = data.presets || [];

        spinner.stop();

        if (presets.length === 0) {
            console.log(chalk.dim('  No preset chains available'));
            console.log('');
            return;
        }

        for (const chain of presets) {
            const icon = CHAIN_ICONS[chain.slug] || '⛓️';
            console.log(`  ${icon} ${chalk.white.bold(chain.name)} ${chalk.dim(`(${chain.slug})`)}`);
            console.log(`    ${chalk.dim(chain.description)}`);
            console.log(`    ${chalk.dim('Agents:')} ${chain.agents.map((a: string) => chalk.cyan(a)).join(chalk.dim(' → '))}`);
            console.log('');
        }

        console.log(chalk.dim('  Run a chain: ') + chalk.cyan('luna chain <preset>'));
        console.log(chalk.dim('  Example:     ') + chalk.cyan('luna chain full-review'));
        console.log('');

    } catch (error: any) {
        spinner.fail(chalk.red(`Failed to fetch chains: ${error.message}`));

        // Fallback: show hardcoded list
        console.log('');
        console.log(chalk.dim('  Available presets (offline):'));
        const fallbackChains = [
            { slug: 'full-review', name: 'Full Review', agents: 'code-review → testing-validation → documentation' },
            { slug: 'new-feature', name: 'New Feature', agents: 'requirements-analyzer → design-architect → task-planner → task-executor' },
            { slug: 'deploy', name: 'Deploy', agents: 'code-review → testing-validation → deployment' },
            { slug: 'security-audit', name: 'Security Audit', agents: '365-security → code-review' },
            { slug: 'api-design', name: 'API Design', agents: 'api-generator → database → documentation' },
        ];

        for (const chain of fallbackChains) {
            const icon = CHAIN_ICONS[chain.slug] || '⛓️';
            console.log(`    ${icon} ${chalk.white(chain.name)} ${chalk.dim(`(${chain.slug})`)}`);
            console.log(`      ${chalk.dim(chain.agents)}`);
        }
        console.log('');
    }
}
