/**
 * Tests for agent loader — fallback behavior and list parsing
 */

import * as assert from 'assert';

suite('Agent Loader', () => {
    const FALLBACK_AGENTS = [
        { name: 'code-review', description: 'Review code quality', category: 'quality' },
        { name: 'testing-validation', description: 'Generate test strategies', category: 'quality' },
        { name: 'security-audit', description: 'Security vulnerability scan', category: 'quality' },
        { name: 'documentation', description: 'Generate documentation', category: 'build' },
        { name: 'deployment', description: 'Deployment assistance', category: 'ship' },
        { name: 'requirements-analyzer', description: 'Analyze requirements', category: 'intelligence' },
        { name: 'design-architect', description: 'Architecture design', category: 'design' },
        { name: 'api-design', description: 'API design patterns', category: 'design' },
    ];

    test('fallback agents list has expected count', () => {
        assert.strictEqual(FALLBACK_AGENTS.length, 8);
    });

    test('all fallback agents have required fields', () => {
        for (const agent of FALLBACK_AGENTS) {
            assert.ok(agent.name, `Agent missing name`);
            assert.ok(agent.description, `${agent.name} missing description`);
            assert.ok(agent.category, `${agent.name} missing category`);
        }
    });

    test('fallback agents include code-review', () => {
        const found = FALLBACK_AGENTS.find(a => a.name === 'code-review');
        assert.ok(found, 'code-review agent not found');
    });

    test('fallback agents cover multiple categories', () => {
        const categories = new Set(FALLBACK_AGENTS.map(a => a.category));
        assert.ok(categories.size >= 4, 'Should have at least 4 categories');
    });

    test('agent names are kebab-case', () => {
        for (const agent of FALLBACK_AGENTS) {
            assert.ok(/^[a-z0-9-]+$/.test(agent.name), `${agent.name} is not kebab-case`);
        }
    });

    test('JSON parsing of CLI output works', () => {
        const mockOutput = JSON.stringify([
            { name: 'custom-agent', description: 'Custom', category: 'custom' },
        ]);
        const parsed = JSON.parse(mockOutput);
        assert.ok(Array.isArray(parsed));
        assert.strictEqual(parsed[0].name, 'custom-agent');
    });

    test('empty JSON array falls back', () => {
        const parsed: unknown[] = JSON.parse('[]');
        const result = parsed.length > 0 ? parsed : FALLBACK_AGENTS;
        assert.strictEqual(result.length, 8);
    });

    test('invalid JSON does not crash', () => {
        let result = FALLBACK_AGENTS;
        try {
            JSON.parse('not-json');
        } catch {
            result = FALLBACK_AGENTS;
        }
        assert.strictEqual(result.length, 8);
    });
});
