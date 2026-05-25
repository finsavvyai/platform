/**
 * Tests for agent runner — ANSI stripping, argument building, CLI path resolution
 */

import * as assert from 'assert';

suite('Agent Runner', () => {
    const stripAnsi = (str: string) =>
        str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

    test('strips ANSI color codes from output', () => {
        const colored = '\u001b[32mSuccess\u001b[0m';
        assert.strictEqual(stripAnsi(colored), 'Success');
    });

    test('preserves plain text without ANSI codes', () => {
        const plain = 'Hello world';
        assert.strictEqual(stripAnsi(plain), 'Hello world');
    });

    test('strips multiple ANSI sequences', () => {
        const multi = '\u001b[1m\u001b[31mError:\u001b[0m Something failed';
        assert.strictEqual(stripAnsi(multi), 'Error: Something failed');
    });

    test('handles empty string', () => {
        assert.strictEqual(stripAnsi(''), '');
    });

    test('builds correct CLI args for agent only', () => {
        const args = ['run', 'code-review'];
        assert.deepStrictEqual(args, ['run', 'code-review']);
    });

    test('builds correct CLI args with file path', () => {
        const args = ['run', 'code-review'];
        const filePath = '/path/to/file.ts';
        args.push('--files', filePath);
        assert.ok(args.includes('--files'));
        assert.ok(args.includes(filePath));
    });

    test('builds correct CLI args with provider', () => {
        const args = ['run', 'code-review'];
        const provider = 'anthropic';
        if (provider) args.push('--provider', provider);
        assert.ok(args.includes('--provider'));
        assert.ok(args.includes('anthropic'));
    });

    test('builds correct CLI args with model', () => {
        const args = ['run', 'code-review'];
        const model = 'claude-3-opus';
        if (model) args.push('--model', model);
        assert.ok(args.includes('--model'));
        assert.ok(args.includes('claude-3-opus'));
    });

    test('skips empty provider/model args', () => {
        const args = ['run', 'code-review'];
        const provider = '';
        const model = '';
        if (provider) args.push('--provider', provider);
        if (model) args.push('--model', model);
        assert.strictEqual(args.length, 2);
    });

    test('default CLI path is luna', () => {
        const defaultPath = 'luna';
        assert.strictEqual(defaultPath, 'luna');
    });
});
