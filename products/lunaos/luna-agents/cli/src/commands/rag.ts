/**
 * RAG Command — Intelligent code search & context
 *
 * Usage:
 *   luna rag                          Search your codebase with AI
 *   luna rag "how does auth work?"    Semantic search query
 *   luna rag search <query>           Explicit search
 *   luna rag status                   Account & usage status
 *   luna rag plans                    Compare pricing tiers
 *   luna rag upgrade                  Start Pro upgrade
 *   luna rag billing                  Manage billing
 *   luna rag support                  Get help
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getCloudToken, getApiUrl, loadConfig } from '../utils/config-store.js';
import { ragSearch } from './rag-search.js';
import { registerUpgradeCommands } from './rag-upgrade.js';

const LUNA = chalk.hex('#E8A317');

export const ragCommand = new Command('rag')
    .aliases(['q', 'ask'])
    .description('Intelligent code search & context powered by Luna RAG')
    .addHelpText('after', `
${chalk.dim('Examples:')}
  ${chalk.cyan('luna rag')}                             Interactive RAG search
  ${chalk.cyan('luna rag "how does auth work?"')}       Natural language search
  ${chalk.cyan('luna rag search "payment patterns"')}   Explicit search
  ${chalk.cyan('luna rag status')}                      Account & usage info
  ${chalk.cyan('luna rag plans')}                       Compare pricing tiers
  ${chalk.cyan('luna rag upgrade')}                     Upgrade to Pro
`)
    .argument('[query...]', 'Natural language search query')
    .option('--cloud', 'Force cloud search (requires login)')
    .option('--local', 'Force local index search')
    .option('--limit <n>', 'Max results to return', '10')
    .option('--verbose', 'Show detailed results with code snippets')
    .action(async (queryParts: string[], options) => {
        const query = queryParts.join(' ').trim();

        if (!query) {
            showWelcome();
            return;
        }

        await ragSearch(query, options);
    });

// ─── Subcommands ────────────────────────────────────

ragCommand
    .command('search')
    .description('Semantic code search with natural language')
    .argument('<query...>', 'Search query in natural language')
    .option('--limit <n>', 'Max results', '10')
    .option('--verbose', 'Show code snippets')
    .action(async (queryParts: string[], options) => {
        await ragSearch(queryParts.join(' '), options);
    });

ragCommand
    .command('status')
    .description('Check RAG account status and usage')
    .action(async () => {
        await showRagStatus();
    });

ragCommand
    .command('plans')
    .description('Compare Luna RAG pricing tiers')
    .action(() => {
        showPlans();
    });

// Register upgrade, billing, support, enterprise, demo subcommands
registerUpgradeCommands(ragCommand);

// ─── Welcome ────────────────────────────────────────

function showWelcome(): void {
    console.log('');
    console.log(LUNA('🌙 Luna RAG — Intelligent Code Search'));
    console.log('');
    console.log('  Search your codebase using natural language.');
    console.log('');
    console.log(chalk.dim('  Quick start:'));
    console.log(`    ${chalk.cyan('luna rag "How does authentication work?"')}`);
    console.log(`    ${chalk.cyan('luna rag "Find error handling patterns"')}`);
    console.log(`    ${chalk.cyan('luna rag "Show database connection code"')}`);
    console.log('');
    console.log(chalk.dim('  Commands:'));
    console.log(`    ${chalk.cyan('luna rag search <query>')}   Semantic code search`);
    console.log(`    ${chalk.cyan('luna rag status')}           Account & usage info`);
    console.log(`    ${chalk.cyan('luna rag plans')}            Compare pricing tiers`);
    console.log(`    ${chalk.cyan('luna rag upgrade')}          Start Pro trial`);
    console.log('');
    console.log(chalk.dim('  Tip: Index your project first with ') + chalk.cyan('luna index'));
    console.log('');
}

// ─── Status ─────────────────────────────────────────

async function showRagStatus(): Promise<void> {
    console.log('');
    console.log(LUNA('🌙 Luna RAG Status'));
    console.log('');

    const token = getCloudToken();

    if (!token) {
        console.log(`  ${chalk.dim('Plan:')}      ${chalk.white('Free Tier')}`);
        console.log(`  ${chalk.dim('Cloud:')}     ${chalk.dim('not connected')}`);
        console.log('');
        console.log(chalk.dim('  Log in for usage tracking: ') + chalk.cyan('luna login'));
        console.log(chalk.dim('  Upgrade for unlimited: ') + chalk.cyan('luna rag upgrade'));
        console.log('');
        return;
    }

    const spinner = ora({ text: 'Fetching account info...', color: 'yellow' }).start();
    const API_BASE = getApiUrl();

    try {
        const [meRes, usageRes] = await Promise.all([
            fetch(`${API_BASE}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` },
            }).catch(() => null),
            fetch(`${API_BASE}/rag/usage`, {
                headers: { 'Authorization': `Bearer ${token}` },
            }).catch(() => null),
        ]);

        spinner.stop();

        if (meRes?.ok) {
            const me = await meRes.json() as any;
            const tier = me.user?.tier || 'free';
            const tierLabel = tier === 'pro'
                ? chalk.hex('#A78BFA')('Pro')
                : tier === 'enterprise'
                    ? chalk.hex('#F59E0B')('Enterprise')
                    : chalk.white('Free');
            console.log(`  ${chalk.dim('Account:')}  ${chalk.white(me.user?.email || 'connected')}`);
            console.log(`  ${chalk.dim('Plan:')}     ${tierLabel}`);
        }

        if (usageRes?.ok) {
            const usage = await usageRes.json() as any;
            const searches = usage.searches || 0;
            const searchLimit = usage.searchLimit || 100;
            const files = usage.filesIndexed || 0;
            const fileLimit = usage.fileLimit || 1000;

            console.log('');
            console.log(chalk.dim('  Usage today:'));
            console.log(`    ${chalk.dim('Searches:')}   ${chalk.white(String(searches))}/${searchLimit}`);
            console.log(`    ${chalk.dim('Indexed:')}    ${chalk.white(String(files))}/${fileLimit} files`);

            if (usage.visionEnabled) {
                console.log(`    ${chalk.dim('Vision AI:')} ${chalk.green('enabled')}`);
            }
        } else {
            console.log(`  ${chalk.dim('Usage:')}    ${chalk.dim('could not fetch')}`);
        }
    } catch {
        spinner.fail('Could not reach cloud API');
    }

    console.log('');
}

// ─── Plans ──────────────────────────────────────────

function showPlans(): void {
    console.log('');
    console.log(LUNA('🌙 Luna RAG Plans'));
    console.log('');

    console.log(chalk.white('  FREE — $0/month'));
    console.log(`    ${chalk.green('✓')} 100 searches/day`);
    console.log(`    ${chalk.green('✓')} 1,000 files indexed`);
    console.log(`    ${chalk.green('✓')} Basic semantic search`);
    console.log(`    ${chalk.green('✓')} Community support`);
    console.log('');

    console.log(chalk.hex('#A78BFA')('  PRO — $29/month'));
    console.log(`    ${chalk.green('✓')} Unlimited searches`);
    console.log(`    ${chalk.green('✓')} Unlimited indexing`);
    console.log(`    ${chalk.green('✓')} Luna Vision RAG (screenshot analysis)`);
    console.log(`    ${chalk.green('✓')} GLM Vision (advanced visual AI)`);
    console.log(`    ${chalk.green('✓')} Priority support (24hr response)`);
    console.log(chalk.dim('    14-day free trial'));
    console.log('');

    console.log(chalk.hex('#F59E0B')('  ENTERPRISE — Custom pricing'));
    console.log(`    ${chalk.green('✓')} Everything in Pro`);
    console.log(`    ${chalk.green('✓')} Team collaboration (10+ seats)`);
    console.log(`    ${chalk.green('✓')} SSO integration (SAML, LDAP)`);
    console.log(`    ${chalk.green('✓')} Dedicated support with SLA`);
    console.log(`    ${chalk.green('✓')} Custom AI model training`);
    console.log('');

    console.log(chalk.dim('  Start Pro trial: ') + chalk.cyan('luna rag upgrade'));
    console.log(chalk.dim('  Enterprise info: ') + chalk.cyan('luna rag enterprise'));
    console.log('');
}
