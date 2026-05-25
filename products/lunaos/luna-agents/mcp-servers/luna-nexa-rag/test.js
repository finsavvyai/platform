#!/usr/bin/env node
/**
 * Real MCP server validation. Replaces the previous `echo ✓` placeholder.
 * Verifies package layout, JS syntax of every shipped .js file, and that
 * critical MCP/runtime dependencies are declared in package.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cp from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const results = [];
let failed = 0;

function check(name, fn) {
    try {
        const detail = fn();
        results.push({ name, ok: true, detail });
    } catch (err) {
        failed++;
        results.push({ name, ok: false, detail: err.message });
    }
}

function readJson(rel) {
    const p = path.join(here, rel);
    if (!fs.existsSync(p)) throw new Error(`missing: ${rel}`);
    try { return JSON.parse(fs.readFileSync(p, 'utf-8')); }
    catch (e) { throw new Error(`invalid JSON in ${rel}: ${e.message}`); }
}

const pkg = readJson('package.json');

check('package.json has name + version + main', () => {
    if (!pkg.name) throw new Error('missing name');
    if (!pkg.version) throw new Error('missing version');
    if (!pkg.main) throw new Error('missing main');
    return `${pkg.name}@${pkg.version}`;
});

check('main entry exists', () => {
    const p = path.join(here, pkg.main);
    if (!fs.existsSync(p)) throw new Error(`main not found: ${pkg.main}`);
    return pkg.main;
});

check('all .js files parse (node --check)', () => {
    const files = fs.readdirSync(here).filter((f) => f.endsWith('.js') && f !== 'test.js' && !f.endsWith('.backup'));
    if (!files.length) throw new Error('no .js files found');
    for (const f of files) {
        const r = cp.spawnSync(process.execPath, ['--check', path.join(here, f)], { encoding: 'utf-8' });
        if (r.status !== 0) {
            throw new Error(`${f}: ${(r.stderr || '').trim().split('\n')[0]}`);
        }
    }
    return `${files.length} file(s) ok`;
});

check('required MCP + runtime deps declared', () => {
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const required = ['@modelcontextprotocol/sdk'];
    const missing = required.filter((d) => !deps[d]);
    if (missing.length) throw new Error(`missing deps: ${missing.join(', ')}`);
    return required.join(', ');
});

check('config-manager.js exports loadConfig', () => {
    const src = fs.readFileSync(path.join(here, 'config-manager.js'), 'utf-8');
    if (!/export\s+(?:async\s+)?function\s+loadConfig\b|export\s+const\s+loadConfig\b|export\s*\{[^}]*\bloadConfig\b/.test(src)) {
        throw new Error('loadConfig export not found');
    }
    return 'export ok';
});

check('index.js imports config-manager loadConfig', () => {
    const idx = fs.readFileSync(path.join(here, 'index.js'), 'utf-8');
    if (!/from\s+['"]\.\/config-manager\.js['"]/.test(idx)) {
        throw new Error('index.js does not import from ./config-manager.js');
    }
    if (!idx.includes('loadConfig')) throw new Error('index.js does not reference loadConfig');
    return 'wired';
});

check('bin entries exist', () => {
    if (!pkg.bin) return 'no bin (ok)';
    const bins = typeof pkg.bin === 'string' ? { [pkg.name]: pkg.bin } : pkg.bin;
    for (const [name, rel] of Object.entries(bins)) {
        const p = path.join(here, rel);
        if (!fs.existsSync(p)) throw new Error(`bin "${name}" -> ${rel} not found`);
    }
    return `${Object.keys(bins).length} bin(s) present`;
});

console.log('\nLuna Nexa RAG MCP Server — validation\n' + '─'.repeat(48));
for (const r of results) {
    const tag = r.ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    console.log(`  ${tag} ${r.name.padEnd(48)}  ${r.detail || ''}`);
}
console.log('─'.repeat(48));
console.log(`  ${results.length - failed}/${results.length} passed${failed ? `, ${failed} failed` : ''}`);
console.log('');
process.exit(failed ? 1 : 0);
