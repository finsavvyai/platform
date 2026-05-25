import { Command } from 'commander';
import chalk from 'chalk';
import { loadAllAgents } from '../core/persona-parser.js';

const CATEGORY_ICONS: Record<string, string> = {
    build: '🏗️',
    quality: '🛡️',
    ship: '🚀',
    intelligence: '🧠',
    design: '🎨',
    meta: '⛓️',
};

const CATEGORY_COLORS: Record<string, string> = {
    build: '#4CAF50',
    quality: '#F44336',
    ship: '#2196F3',
    intelligence: '#9C27B0',
    design: '#FF9800',
    meta: '#607D8B',
};

export const listCommand = new Command('list')
    .alias('ls')
    .description('List all available agents')
    .addHelpText('after', `
Examples:
  luna list                    Show all agents grouped by category
  luna list --json             Output as JSON
  luna list -c security        Filter by category
  luna ls                      Shorthand alias
`)
    .option('-c, --category <category>', 'Filter by category')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
        const agents = await loadAllAgents();

        if (options.json) {
            console.log(JSON.stringify(agents, null, 2));
            return;
        }

        console.log('');
        console.log(chalk.hex('#E8A317')('🌙 LunaOS Agents'));
        console.log(chalk.dim(`  ${agents.length} agents available`));
        console.log('');

        // Group by category
        const grouped = new Map<string, typeof agents>();
        for (const agent of agents) {
            const cat = agent.category || 'other';
            if (options.category && cat !== options.category) continue;
            if (!grouped.has(cat)) grouped.set(cat, []);
            grouped.get(cat)!.push(agent);
        }

        for (const [category, categoryAgents] of grouped) {
            const icon = CATEGORY_ICONS[category] || '📦';
            const color = CATEGORY_COLORS[category] || '#999';
            console.log(chalk.hex(color).bold(`  ${icon} ${category.toUpperCase()}`));

            for (const agent of categoryAgents) {
                const tierBadge = agent.tier === 'free'
                    ? chalk.green(' FREE')
                    : chalk.hex('#E8A317')(' PRO');
                console.log(
                    `    ${chalk.white(agent.name.padEnd(25))} ${chalk.dim(agent.description)}${tierBadge}`
                );
            }
            console.log('');
        }

        console.log(chalk.dim('  Run an agent: ') + chalk.cyan('luna run <agent-name>'));
        console.log('');
    });
