/**
 * Create Agent — scaffold a custom AI agent persona from template
 *
 * Usage:
 *   luna create-agent "my-reviewer"
 *   luna create-agent "security-scanner" --category="security"
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';

function prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

const CATEGORIES = [
    'code-quality',
    'security',
    'testing',
    'deployment',
    'documentation',
    'design',
    'data',
    'devops',
    'general',
] as const;

function generateTemplate(name: string, description: string, category: string): string {
    const displayName = name
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

    return `# Luna ${displayName}

> **Category**: ${category}
> **Version**: 1.0.0
> **Author**: Custom Agent

## Role

You are **Luna ${displayName}**, a specialized AI agent.

${description}

## Responsibilities

1. Analyze the provided codebase context thoroughly
2. Focus on your area of expertise: ${category}
3. Provide actionable, specific recommendations
4. Reference exact file paths and line numbers when possible
5. Prioritize findings by severity (critical → high → medium → low)

## Output Format

Structure your response as follows:

### Summary
A 2-3 sentence overview of your findings.

### Findings

#### Critical
- List critical issues that must be fixed immediately

#### High
- List important issues that should be addressed soon

#### Medium
- List issues to address in the next sprint

#### Low
- List minor improvements and suggestions

### Recommendations
Numbered list of specific actions to take, ordered by priority.

## Context Requirements

- **Language**: Analyze any programming language
- **Framework**: Framework-agnostic
- **Scope**: Full project or specific files
- **Depth**: Thorough analysis with code examples

## Guidelines

- Be specific — cite files, functions, and line numbers
- Be constructive — explain WHY something is an issue
- Be practical — suggest concrete fixes, not vague advice
- Be thorough — don't skip edge cases
- Be concise — avoid unnecessary filler
`;
}

export const createAgentCommand = new Command('create-agent')
    .aliases(['new', 'mk'])
    .description('Create a custom AI agent persona')
    .argument('<name>', 'Agent name (kebab-case, e.g. "my-reviewer")')
    .option('-d, --description <desc>', 'Short description of what the agent does')
    .option('-c, --category <cat>', `Category: ${CATEGORIES.join(', ')}`, 'general')
    .option('--global', 'Create in ~/.luna/agents/ (available everywhere)')
    .action(async (name: string, options: { description?: string; category?: string; global?: boolean }) => {
        // Validate name
        if (!/^[a-z][a-z0-9-]*$/.test(name)) {
            console.log(chalk.red(`  ✗ Agent name must be kebab-case (e.g. "my-reviewer")`));
            process.exit(1);
        }

        // Validate category
        const category = options.category || 'general';
        if (!CATEGORIES.includes(category as any)) {
            console.log(chalk.red(`  ✗ Invalid category: ${category}`));
            console.log(chalk.dim(`  Available: ${CATEGORIES.join(', ')}`));
            process.exit(1);
        }

        console.log('');
        console.log(chalk.hex('#E8A317')('🌙 Create Custom Agent'));
        console.log('');

        // Get description if not provided
        let description = options.description;
        if (!description) {
            description = await prompt(`  What does this agent do? `);
            if (!description) {
                description = `A custom ${category} agent for specialized analysis.`;
            }
        }

        // Determine output path
        const baseDir = options.global
            ? path.join(process.env.HOME || '~', '.luna', 'agents')
            : path.join(process.cwd(), '.luna', 'agents');

        fs.mkdirSync(baseDir, { recursive: true });

        const filename = `luna-${name}.md`;
        const filepath = path.join(baseDir, filename);

        // Check if exists
        if (fs.existsSync(filepath)) {
            const overwrite = await prompt(`  Agent "${name}" already exists. Overwrite? [y/N]: `);
            if (overwrite.toLowerCase() !== 'y') {
                console.log(chalk.dim('  Cancelled'));
                return;
            }
        }

        // Generate and write template
        const content = generateTemplate(name, description, category);
        fs.writeFileSync(filepath, content, 'utf-8');

        const displayName = name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const location = options.global ? 'global' : 'project';

        console.log('');
        console.log(`  ${chalk.green('✓')} Created ${chalk.white(`Luna ${displayName}`)}`);
        console.log(`  ${chalk.dim('File:')}  ${filepath}`);
        console.log(`  ${chalk.dim('Scope:')} ${location}`);
        console.log('');
        console.log(chalk.dim('  Run your agent:'));
        console.log(`    ${chalk.cyan(`luna run ${name}`)}`);
        console.log('');
        console.log(chalk.dim('  Edit the persona:'));
        console.log(`    ${chalk.cyan(`$EDITOR ${filepath}`)}`);
        console.log('');
    });
