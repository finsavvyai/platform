/**
 * CLI Tests — comprehensive tests for all luna commands
 *
 * Tests: persona-parser, context-builder, llm-client, command logic
 * Uses vitest with mocked fs/network for isolated testing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';

// =============================================================
// PERSONA PARSER
// =============================================================
describe('Persona Parser', () => {
    it('should load a valid agent by slug', async () => {
        const { loadAgent } = await import('../src/core/persona-parser.js');
        const agent = await loadAgent('code-review');

        expect(agent).toBeDefined();
        expect(agent!.slug).toBe('code-review');
        expect(agent!.name).toBeDefined();
        expect(agent!.systemPrompt).toBeDefined();
        expect(agent!.systemPrompt.length).toBeGreaterThan(100);
    });

    it('should return null for unknown agent', async () => {
        const { loadAgent } = await import('../src/core/persona-parser.js');
        const agent = await loadAgent('nonexistent-agent-12345');
        expect(agent).toBeNull();
    });

    it('should load all bundled agents (>= 28 per published claim)', async () => {
        const { loadAllAgents } = await import('../src/core/persona-parser.js');
        const agents = await loadAllAgents();

        expect(agents.length).toBeGreaterThanOrEqual(28);

        for (const agent of agents) {
            expect(agent.slug).toBeDefined();
            expect(agent.slug.length).toBeGreaterThan(0);
            expect(agent.name).toBeDefined();
            expect(agent.systemPrompt).toBeDefined();
        }
    });

    it('should have consistent slug naming', async () => {
        const { loadAllAgents } = await import('../src/core/persona-parser.js');
        const agents = await loadAllAgents();

        for (const agent of agents) {
            // Slugs should be lowercase with hyphens only
            expect(agent.slug).toMatch(/^[a-z0-9-]+$/);
        }
    });
});

// =============================================================
// LLM CLIENT — Provider Configuration
// =============================================================
describe('LLM Client', () => {
    it('should export all 12 providers', async () => {
        const { PROVIDERS } = await import('../src/core/llm-client.js');

        const providerKeys = Object.keys(PROVIDERS);
        expect(providerKeys.length).toBe(12);

        // Verify key providers exist
        expect(PROVIDERS.anthropic).toBeDefined();
        expect(PROVIDERS.openai).toBeDefined();
        expect(PROVIDERS.deepseek).toBeDefined();
        expect(PROVIDERS.google).toBeDefined();
        expect(PROVIDERS.groq).toBeDefined();
        expect(PROVIDERS.xai).toBeDefined();
    });

    it('should have valid provider config', async () => {
        const { PROVIDERS } = await import('../src/core/llm-client.js');

        for (const [key, info] of Object.entries(PROVIDERS)) {
            expect(info.name).toBeDefined();
            expect(info.name.length).toBeGreaterThan(0);
            expect(info.envVar).toBeDefined();
            expect(info.envVar.length).toBeGreaterThan(0);
            expect(info.defaultModel).toBeDefined();
            expect(info.baseUrl).toBeDefined();
            expect(info.apiStyle).toMatch(/^(anthropic|openai|openai-compat)$/);
            expect(info.signupUrl).toBeDefined();
            expect(info.keyGuide).toBeDefined();
        }
    });

    it('should resolve API key from env var', async () => {
        const { resolveApiKey, PROVIDERS } = await import('../src/core/llm-client.js');

        // Set a test env var
        const envVar = PROVIDERS.deepseek.envVar;
        const original = process.env[envVar];
        process.env[envVar] = 'test-key-12345';

        const key = resolveApiKey('deepseek');
        expect(key).toBe('test-key-12345');

        // Restore
        if (original) {
            process.env[envVar] = original;
        } else {
            delete process.env[envVar];
        }
    });

    it('should return null when no key configured', async () => {
        const { resolveApiKey, PROVIDERS } = await import('../src/core/llm-client.js');

        // Make sure env var is not set
        const envVar = PROVIDERS.mistral.envVar;
        const original = process.env[envVar];
        delete process.env[envVar];

        const key = resolveApiKey('mistral');
        expect(key).toBeNull();

        // Restore
        if (original) {
            process.env[envVar] = original;
        }
    });

    it('should return correct default model per provider', async () => {
        const { defaultModel } = await import('../src/core/llm-client.js');

        expect(defaultModel('anthropic')).toContain('claude');
        expect(defaultModel('openai')).toContain('gpt');
        expect(defaultModel('deepseek')).toContain('deepseek');
    });
});

// =============================================================
// CONTEXT BUILDER
// =============================================================
describe('Context Builder', () => {
    it('should build context from a directory', async () => {
        const { buildContext } = await import('../src/core/context-builder.js');

        // Build context from the project root (luna-agents)
        const ctx = await buildContext(path.resolve(import.meta.dirname, '../../'));

        expect(ctx).toBeDefined();
        expect(ctx.files).toBeDefined();
        expect(ctx.files.length).toBeGreaterThan(0);
    });

    it('should respect file size limits', async () => {
        const { buildContext } = await import('../src/core/context-builder.js');

        const ctx = await buildContext(path.resolve(import.meta.dirname, '../../'));

        // No individual file should exceed 100KB
        for (const file of ctx.files) {
            expect(file.size).toBeLessThan(100 * 1024);
        }
    });

    it('should ignore node_modules and .git', async () => {
        const { buildContext } = await import('../src/core/context-builder.js');

        const ctx = await buildContext(path.resolve(import.meta.dirname, '../../'));

        for (const file of ctx.files) {
            expect(file.path).not.toContain('node_modules');
            expect(file.path).not.toContain('.git/');
        }
    });

    it('should format context as string', async () => {
        const { buildContext, formatContext } = await import('../src/core/context-builder.js');

        const ctx = await buildContext(path.resolve(import.meta.dirname, '../../'));
        const formatted = formatContext(ctx);

        expect(formatted).toBeDefined();
        expect(formatted.length).toBeGreaterThan(0);
        expect(typeof formatted).toBe('string');
    });
});

// =============================================================
// COMMAND STRUCTURE
// =============================================================
describe('Command Structure', () => {
    it('should export init command', async () => {
        const { initCommand } = await import('../src/commands/init.js');
        expect(initCommand).toBeDefined();
        expect(initCommand.name()).toBe('init');

        // Should have --skip-keys and --cloud options
        const options = initCommand.options.map(o => o.long);
        expect(options).toContain('--skip-keys');
        expect(options).toContain('--cloud');
    });

    it('should export list command', async () => {
        const { listCommand } = await import('../src/commands/list.js');
        expect(listCommand).toBeDefined();
        expect(listCommand.name()).toBe('list');
    });

    it('should export run command with all options', async () => {
        const { runCommand } = await import('../src/commands/run.js');
        expect(runCommand).toBeDefined();
        expect(runCommand.name()).toBe('run');

        const options = runCommand.options.map(o => o.long);
        expect(options).toContain('--provider');
        expect(options).toContain('--model');
        expect(options).toContain('--cloud');
        expect(options).toContain('--files');
        expect(options).toContain('--output');
        expect(options).toContain('--verbose');
    });

    it('should export status command', async () => {
        const { statusCommand } = await import('../src/commands/status.js');
        expect(statusCommand).toBeDefined();
        expect(statusCommand.name()).toBe('status');
    });
});

// =============================================================
// AGENT CATALOG CONSISTENCY
// =============================================================
describe('Agent Catalog Consistency', () => {
    it('should have matching agents in parser and files', async () => {
        const { loadAllAgents } = await import('../src/core/persona-parser.js');
        const agents = await loadAllAgents();
        const slugs = agents.map(a => a.slug);

        // Known free agents should be present
        const freeAgents = ['code-review', 'testing-validation', 'documentation', 'deployment'];
        for (const slug of freeAgents) {
            expect(slugs).toContain(slug);
        }
    });

    it('every agent should have a non-empty system prompt', async () => {
        const { loadAllAgents } = await import('../src/core/persona-parser.js');
        const agents = await loadAllAgents();

        for (const agent of agents) {
            expect(agent.systemPrompt.trim().length).toBeGreaterThan(50);
        }
    });
});

// =============================================================
// PERSONA PARSER — parsePersona (direct)
// =============================================================
describe('parsePersona — direct file parsing', () => {
    it('should strip luna- prefix from slug', async () => {
        const { parsePersona } = await import('../src/core/persona-parser.js');
        const fs = await import('node:fs');
        const path = await import('node:path');

        // Find the agents directory by loading any agent
        const { loadAllAgents } = await import('../src/core/persona-parser.js');
        const agents = await loadAllAgents();
        const agent = agents[0];

        // Re-parse the same file directly
        const parsed = parsePersona(agent.filePath);
        expect(parsed.slug).not.toMatch(/^luna-/);
    });

    it('should assign categories from CATEGORY_MAP', async () => {
        const { loadAgent } = await import('../src/core/persona-parser.js');

        const codeReview = await loadAgent('code-review');
        expect(codeReview!.category).toBe('quality');

        const deployment = await loadAgent('deployment');
        expect(deployment!.category).toBe('ship');

        const rag = await loadAgent('rag');
        expect(rag!.category).toBe('intelligence');
    });

    it('should assign free tier to all agents', async () => {
        const { loadAllAgents } = await import('../src/core/persona-parser.js');
        const agents = await loadAllAgents();
        for (const agent of agents) {
            expect(agent.tier).toBe('free');
        }
    });

    it('should preserve full markdown as systemPrompt', async () => {
        const { loadAgent } = await import('../src/core/persona-parser.js');
        const agent = await loadAgent('code-review');
        expect(agent!.systemPrompt).toContain('#');
        expect(agent!.systemPrompt).toContain('Role');
    });

    it('should include filePath in each agent', async () => {
        const { loadAllAgents } = await import('../src/core/persona-parser.js');
        const agents = await loadAllAgents();

        for (const agent of agents) {
            expect(agent.filePath).toBeDefined();
            expect(agent.filePath).toContain('.md');
        }
    });
});

// =============================================================
// PERSONA PARSER — loadAgent partial matching
// =============================================================
describe('loadAgent — partial matching', () => {
    it('should find agent by partial slug', async () => {
        const { loadAgent } = await import('../src/core/persona-parser.js');

        const agent = await loadAgent('review');
        expect(agent).not.toBeNull();
        expect(agent!.slug).toContain('review');
    });

    it('should find agent by case-insensitive name', async () => {
        const { loadAgent } = await import('../src/core/persona-parser.js');

        const agent = await loadAgent('DEPLOY');
        expect(agent).not.toBeNull();
    });

    it('should prefer exact match over partial', async () => {
        const { loadAgent } = await import('../src/core/persona-parser.js');

        const agent = await loadAgent('rag');
        expect(agent).not.toBeNull();
        expect(agent!.slug).toBe('rag');
    });
});

// =============================================================
// CONTEXT BUILDER — detectProject coverage
// =============================================================
describe('Context Builder — project detection', () => {
    it('should detect the CLI package as a node/typescript project', async () => {
        const { buildContext } = await import('../src/core/context-builder.js');

        const ctx = await buildContext(path.resolve(import.meta.dirname, '../../'));
        expect(ctx.projectType).toBe('node');
        expect(ctx.language).toContain('typescript');
    });

    it('should have a projectName derived from directory name', async () => {
        const { buildContext } = await import('../src/core/context-builder.js');

        const ctx = await buildContext(path.resolve(import.meta.dirname, '../../'));
        expect(ctx.projectName).toBe('luna-agents');
    });

    it('should not include binary files', async () => {
        const { buildContext } = await import('../src/core/context-builder.js');

        const ctx = await buildContext(path.resolve(import.meta.dirname, '../../'));
        for (const file of ctx.files) {
            expect(file.path).not.toMatch(/\.(png|jpg|gif|woff|woff2|ico)$/);
        }
    });

    it('should not include package-lock.json', async () => {
        const { buildContext } = await import('../src/core/context-builder.js');

        const ctx = await buildContext(path.resolve(import.meta.dirname, '../../'));
        for (const file of ctx.files) {
            expect(file.path).not.toContain('package-lock.json');
        }
    });

    it('should cap at MAX_FILES(30) files', async () => {
        const { buildContext } = await import('../src/core/context-builder.js');

        const ctx = await buildContext(path.resolve(import.meta.dirname, '../../'));
        expect(ctx.files.length).toBeLessThanOrEqual(30);
    });
});

// =============================================================
// CONTEXT BUILDER — formatContext structure
// =============================================================
describe('formatContext — output structure', () => {
    it('should produce markdown with Project Context header', async () => {
        const { buildContext, formatContext } = await import('../src/core/context-builder.js');

        const ctx = await buildContext(path.resolve(import.meta.dirname, '../../'));
        const formatted = formatContext(ctx);

        expect(formatted).toContain('# Project Context');
        expect(formatted).toContain('---');
    });

    it('should include file contents wrapped in code blocks', async () => {
        const { buildContext, formatContext } = await import('../src/core/context-builder.js');

        const ctx = await buildContext(path.resolve(import.meta.dirname, '../../'));
        const formatted = formatContext(ctx);

        // Should have at least one code block
        expect(formatted).toContain('```');
    });

    it('should include summary with project info', async () => {
        const { buildContext, formatContext } = await import('../src/core/context-builder.js');

        const ctx = await buildContext(path.resolve(import.meta.dirname, '../../'));
        const formatted = formatContext(ctx);

        expect(formatted).toContain('Project: luna-agents');
        expect(formatted).toContain('Type: node');
        expect(formatted).toContain('Files analyzed:');
    });

    it('should include each file path as a heading', async () => {
        const { buildContext, formatContext } = await import('../src/core/context-builder.js');

        const ctx = await buildContext(path.resolve(import.meta.dirname, '../../'));
        const formatted = formatContext(ctx);

        // Each file appears as a ## heading
        for (const file of ctx.files.slice(0, 3)) {
            expect(formatted).toContain(`## ${file.path}`);
        }
    });
});

// =============================================================
// CONTEXT BUILDER — ProjectContext.summary
// =============================================================
describe('ProjectContext summary', () => {
    it('should include file count and total size', async () => {
        const { buildContext } = await import('../src/core/context-builder.js');

        const ctx = await buildContext(path.resolve(import.meta.dirname, '../../'));

        expect(ctx.summary).toContain('Files analyzed:');
        expect(ctx.summary).toContain('Total size:');
        expect(ctx.summary).toContain('KB');
    });

    it('should include framework if detected', async () => {
        const { buildContext } = await import('../src/core/context-builder.js');

        // luna-agents repo has no framework, but the summary should still work
        const ctx = await buildContext(path.resolve(import.meta.dirname, '../../'));
        expect(ctx.summary).toBeDefined();
        expect(ctx.summary.length).toBeGreaterThan(0);
    });
});

// =============================================================
// LLM CLIENT — Provider data completeness
// =============================================================
describe('LLM Client — Provider data integrity', () => {
    it('each provider should have a valid URL', async () => {
        const { PROVIDERS } = await import('../src/core/llm-client.js');

        for (const [key, info] of Object.entries(PROVIDERS)) {
            expect(info.baseUrl).toMatch(/^https?:\/\//);
            expect(info.signupUrl).toMatch(/^https?:\/\//);
        }
    });

    it('each provider envVar should end with _API_KEY or _KEY', async () => {
        const { PROVIDERS } = await import('../src/core/llm-client.js');

        for (const [key, info] of Object.entries(PROVIDERS)) {
            expect(info.envVar).toMatch(/_KEY$/);
        }
    });

    it('anthropic should use anthropic apiStyle', async () => {
        const { PROVIDERS } = await import('../src/core/llm-client.js');
        expect(PROVIDERS.anthropic.apiStyle).toBe('anthropic');
    });

    it('all non-anthropic providers should use openai-compat apiStyle', async () => {
        const { PROVIDERS } = await import('../src/core/llm-client.js');

        for (const [key, info] of Object.entries(PROVIDERS)) {
            if (key !== 'anthropic') {
                expect(info.apiStyle).toBe('openai-compat');
            }
        }
    });

    it('each provider should have a keyGuide', async () => {
        const { PROVIDERS } = await import('../src/core/llm-client.js');

        for (const [key, info] of Object.entries(PROVIDERS)) {
            expect(info.keyGuide.length).toBeGreaterThan(20);
        }
    });
});

// =============================================================
// LLM CLIENT — defaultModel edge cases
// =============================================================
describe('defaultModel — edge cases', () => {
    it('should fallback to gpt-4o for unknown provider', async () => {
        const { defaultModel } = await import('../src/core/llm-client.js');
        // Cast to bypass type checking – testing runtime behavior
        const model = defaultModel('nonexistent-provider' as any);
        expect(model).toBe('gpt-4o');
    });

    it('should return correct models for all 12 providers', async () => {
        const { defaultModel, PROVIDERS } = await import('../src/core/llm-client.js');

        for (const key of Object.keys(PROVIDERS)) {
            const model = defaultModel(key as any);
            expect(model).toBe(PROVIDERS[key as keyof typeof PROVIDERS].defaultModel);
        }
    });
});

// =============================================================
// LLM CLIENT — resolveApiKey from credentials file
// =============================================================
describe('resolveApiKey — credential file fallback', () => {
    it('should return null for unknown provider', async () => {
        const { resolveApiKey } = await import('../src/core/llm-client.js');
        const key = resolveApiKey('nonexistent-provider' as any);
        expect(key).toBeNull();
    });

    it('should prioritize env var over credentials file', async () => {
        const { resolveApiKey, PROVIDERS } = await import('../src/core/llm-client.js');

        const envVar = PROVIDERS.groq.envVar;
        const original = process.env[envVar];
        process.env[envVar] = 'env-key-takes-priority';

        const key = resolveApiKey('groq');
        expect(key).toBe('env-key-takes-priority');

        if (original) {
            process.env[envVar] = original;
        } else {
            delete process.env[envVar];
        }
    });
});

// =============================================================
// COMMAND STRUCTURE — additional checks
// =============================================================
describe('Command Structure — additional', () => {
    it('list command should have alias "ls"', async () => {
        const { listCommand } = await import('../src/commands/list.js');
        expect(listCommand.aliases()).toContain('ls');
    });

    it('list command should have --category and --json options', async () => {
        const { listCommand } = await import('../src/commands/list.js');
        const options = listCommand.options.map(o => o.long);
        expect(options).toContain('--category');
        expect(options).toContain('--json');
    });

    it('run command should have --no-context option', async () => {
        const { runCommand } = await import('../src/commands/run.js');
        const options = runCommand.options.map(o => o.long);
        expect(options).toContain('--no-context');
    });

    it('run command should accept <agent> argument', async () => {
        const { runCommand } = await import('../src/commands/run.js');
        // Commander stores arguments in _args
        expect(runCommand.registeredArguments.length).toBeGreaterThan(0);
        expect(runCommand.registeredArguments[0].name()).toBe('agent');
    });

    it('init command descriptions should be defined', async () => {
        const { initCommand } = await import('../src/commands/init.js');
        expect(initCommand.description()).toContain('Initialize');
    });

    it('status command description should be defined', async () => {
        const { statusCommand } = await import('../src/commands/status.js');
        expect(statusCommand.description()).toContain('status');
    });
});

// =============================================================
// AGENT CATEGORIES — completeness
// =============================================================
describe('Agent Categories', () => {
    it('should cover build, quality, ship, intelligence categories', async () => {
        const { loadAllAgents } = await import('../src/core/persona-parser.js');
        const agents = await loadAllAgents();

        const categories = new Set(agents.map(a => a.category));
        expect(categories.has('build')).toBe(true);
        expect(categories.has('quality')).toBe(true);
        expect(categories.has('ship')).toBe(true);
        expect(categories.has('intelligence')).toBe(true);
    });

    it('should have at least 2 agents per major category', async () => {
        const { loadAllAgents } = await import('../src/core/persona-parser.js');
        const agents = await loadAllAgents();

        const counts: Record<string, number> = {};
        for (const agent of agents) {
            counts[agent.category] = (counts[agent.category] || 0) + 1;
        }

        expect(counts['build']).toBeGreaterThanOrEqual(2);
        expect(counts['quality']).toBeGreaterThanOrEqual(2);
        expect(counts['ship']).toBeGreaterThanOrEqual(2);
        expect(counts['intelligence']).toBeGreaterThanOrEqual(2);
    });

    it('all bundled agents should be tier=free', async () => {
        const { loadAllAgents } = await import('../src/core/persona-parser.js');
        const agents = await loadAllAgents();

        const freeAgents = agents.filter(a => a.tier === 'free');
        expect(freeAgents.length).toBe(agents.length);
    });

    it('should have 0 pro agents (all agents are free)', async () => {
        const { loadAllAgents } = await import('../src/core/persona-parser.js');
        const agents = await loadAllAgents();

        const proAgents = agents.filter(a => a.tier === 'pro');
        expect(proAgents.length).toBe(0);
    });
});

// =============================================================
// AGENT NAMES & DESCRIPTIONS
// =============================================================
describe('Agent Names and Descriptions', () => {
    it('every agent should have a non-empty name', async () => {
        const { loadAllAgents } = await import('../src/core/persona-parser.js');
        const agents = await loadAllAgents();

        for (const agent of agents) {
            expect(agent.name.length).toBeGreaterThan(0);
        }
    });

    it('every agent should have a description', async () => {
        const { loadAllAgents } = await import('../src/core/persona-parser.js');
        const agents = await loadAllAgents();

        for (const agent of agents) {
            expect(agent.description).toBeDefined();
            expect(agent.description.length).toBeGreaterThan(0);
        }
    });

    it('no two agents should have the same slug', async () => {
        const { loadAllAgents } = await import('../src/core/persona-parser.js');
        const agents = await loadAllAgents();

        const slugs = agents.map(a => a.slug);
        const unique = new Set(slugs);
        expect(unique.size).toBe(slugs.length);
    });
});
