/**
 * RAG Upgrade Commands — subscription management subcommands
 *
 * Registers: upgrade, enterprise, demo, billing, support
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getCloudToken, getApiUrl } from '../utils/config-store.js';

const LUNA = chalk.hex('#E8A317');
const CHECKOUT_URL = 'https://lunaos.lemonsqueezy.com/checkout';

export function registerUpgradeCommands(parent: Command): void {
    parent
        .command('upgrade')
        .description('Upgrade to Luna RAG Pro')
        .action(async () => {
            await showUpgrade();
        });

    parent
        .command('enterprise')
        .description('Enterprise plan information')
        .action(() => {
            showEnterprise();
        });

    parent
        .command('demo')
        .description('Schedule an enterprise demo')
        .argument('[team-size]', 'Approximate team size')
        .action((teamSize?: string) => {
            showDemo(teamSize);
        });

    parent
        .command('billing')
        .description('Manage billing and subscription')
        .action(async () => {
            await showBilling();
        });

    parent
        .command('support')
        .description('Get help with Luna RAG')
        .argument('[topic]', 'Support topic (billing, technical, features, account)')
        .action((topic?: string) => {
            showSupport(topic);
        });
}

// ─── Upgrade ────────────────────────────────────────

async function showUpgrade(): Promise<void> {
    console.log('');
    console.log(LUNA('🌙 Upgrade to Luna RAG Pro'));
    console.log('');

    console.log(chalk.white('  Unlock everything:'));
    console.log(`    ${chalk.green('✓')} Unlimited semantic searches`);
    console.log(`    ${chalk.green('✓')} Unlimited file indexing`);
    console.log(`    ${chalk.green('✓')} Luna Vision RAG — screenshot analysis`);
    console.log(`    ${chalk.green('✓')} GLM Vision — advanced visual AI`);
    console.log(`    ${chalk.green('✓')} Priority support (24hr response)`);
    console.log(`    ${chalk.green('✓')} Advanced analytics dashboard`);
    console.log('');
    console.log(`  ${chalk.dim('Price:')}  $29/month`);
    console.log(`  ${chalk.dim('Trial:')}  14-day FREE trial — cancel anytime`);
    console.log('');

    const token = getCloudToken();

    if (!token) {
        console.log(chalk.yellow('  Log in first to upgrade:'));
        console.log(`    ${chalk.cyan('luna login')}`);
        console.log('');
        return;
    }

    console.log(chalk.dim('  Start your free trial:'));
    console.log(`    ${chalk.cyan(CHECKOUT_URL)}`);
    console.log('');
    console.log(chalk.dim('  Compare plans: ') + chalk.cyan('luna rag plans'));
    console.log('');
}

// ─── Enterprise ─────────────────────────────────────

function showEnterprise(): void {
    console.log('');
    console.log(LUNA('🌙 Luna RAG Enterprise'));
    console.log('');

    console.log(chalk.white('  For teams of 10+ users:'));
    console.log(`    ${chalk.green('✓')} Team collaboration with shared workspaces`);
    console.log(`    ${chalk.green('✓')} SSO integration (SAML, LDAP)`);
    console.log(`    ${chalk.green('✓')} Team analytics and usage tracking`);
    console.log(`    ${chalk.green('✓')} Custom AI model training`);
    console.log(`    ${chalk.green('✓')} Dedicated support with SLA`);
    console.log(`    ${chalk.green('✓')} On-premise deployment option`);
    console.log('');

    console.log(chalk.dim('  Pricing:'));
    console.log(`    10–49 users:  $49/user/month`);
    console.log(`    50+ users:    $39/user/month`);
    console.log('');

    console.log(chalk.dim('  Contact:'));
    console.log(`    Email:    ${chalk.cyan('enterprise@lunaos.ai')}`);
    console.log(`    Demo:     ${chalk.cyan('luna rag demo')}`);
    console.log('');
}

// ─── Demo ───────────────────────────────────────────

function showDemo(teamSize?: string): void {
    console.log('');
    console.log(LUNA('🌙 Luna RAG Enterprise Demo'));
    console.log('');

    if (teamSize) {
        console.log(`  Team size: ${chalk.white(teamSize)} users`);
        console.log('');
    }

    console.log(chalk.white('  Demo highlights:'));
    console.log(`    ${chalk.dim('•')} Live code search across complex projects`);
    console.log(`    ${chalk.dim('•')} Vision AI analyzing real UI screenshots`);
    console.log(`    ${chalk.dim('•')} Team collaboration features`);
    console.log(`    ${chalk.dim('•')} Custom integration possibilities`);
    console.log(`    ${chalk.dim('•')} Q&A with solutions architect`);
    console.log('');
    console.log(`  ${chalk.dim('Duration:')} 45 minutes`);
    console.log(`  ${chalk.dim('Format:')}   Video call (Zoom/Teams/Meet)`);
    console.log('');

    console.log(chalk.dim('  Schedule:'));
    console.log(`    Email:  ${chalk.cyan('enterprise@lunaos.ai')}`);
    console.log(`    Web:    ${chalk.cyan('https://agents.lunaos.ai/demo')}`);
    console.log('');
}

// ─── Billing ────────────────────────────────────────

async function showBilling(): Promise<void> {
    console.log('');
    console.log(LUNA('🌙 Luna RAG Billing'));
    console.log('');

    const token = getCloudToken();

    if (!token) {
        console.log(chalk.dim('  Log in to view billing:'));
        console.log(`    ${chalk.cyan('luna login')}`);
        console.log('');
        return;
    }

    const spinner = ora({ text: 'Fetching billing info...', color: 'yellow' }).start();
    const API_BASE = getApiUrl();

    try {
        const res = await fetch(`${API_BASE}/billing/subscription`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json() as any;
        spinner.stop();

        console.log(`  ${chalk.dim('Plan:')}     ${chalk.white(data.plan || 'Free')}`);

        if (data.nextBilling) {
            console.log(`  ${chalk.dim('Next:')}     ${chalk.white(data.nextBilling)}`);
        }
        if (data.paymentMethod) {
            console.log(`  ${chalk.dim('Payment:')}  ${chalk.white(data.paymentMethod)}`);
        }

        console.log('');
        console.log(chalk.dim('  Manage subscription:'));
        console.log(`    ${chalk.cyan('https://agents.lunaos.ai/settings/billing')}`);
    } catch {
        spinner.fail('Could not fetch billing info');
        console.log('');
        console.log(chalk.dim('  Manage online:'));
        console.log(`    ${chalk.cyan('https://agents.lunaos.ai/settings/billing')}`);
    }

    console.log('');
}

// ─── Support ────────────────────────────────────────

function showSupport(topic?: string): void {
    console.log('');
    console.log(LUNA('🌙 Luna RAG Support'));
    console.log('');

    if (topic) {
        console.log(`  ${chalk.dim('Topic:')} ${chalk.white(topic)}`);
        console.log('');
    }

    console.log(chalk.dim('  Resources:'));
    console.log(`    Docs:       ${chalk.cyan('https://docs.lunaos.ai/rag')}`);
    console.log(`    Tutorials:  ${chalk.cyan('https://docs.lunaos.ai/tutorials')}`);
    console.log(`    FAQ:        ${chalk.cyan('https://docs.lunaos.ai/faq')}`);
    console.log('');

    console.log(chalk.dim('  Contact:'));
    console.log(`    Email:  ${chalk.cyan('support@lunaos.ai')}`);
    console.log(`    Chat:   ${chalk.cyan('https://agents.lunaos.ai/support')}`);
    console.log(`    Hours:  Mon–Fri, 9AM–6PM EST`);
    console.log('');
}
