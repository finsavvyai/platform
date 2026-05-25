#!/usr/bin/env node
/**
 * Real plugin validation. Replaces the previous `echo ✓` placeholder.
 * Verifies the plugin manifest, package layout, required files, and JS syntax.
 * Exits 0 on pass, 1 on any failure with a per-check report.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const here = __dirname;
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

check('package.json parses', () => {
    const pkg = readJson('package.json');
    if (!pkg.name) throw new Error('missing name');
    if (!pkg.version) throw new Error('missing version');
    if (!pkg.main) throw new Error('missing main');
    return `${pkg.name}@${pkg.version}`;
});

check('claude-plugin.json parses + required fields', () => {
    const m = readJson('claude-plugin.json');
    for (const f of ['name', 'version', 'type', 'main']) {
        if (!m[f]) throw new Error(`missing field: ${f}`);
    }
    if (m.type !== 'plugin') throw new Error(`type must be "plugin", got "${m.type}"`);
    return `manifest ${m.name}@${m.version}`;
});

check('package.json version matches claude-plugin.json', () => {
    const pkg = readJson('package.json');
    const manifest = readJson('claude-plugin.json');
    if (pkg.version !== manifest.version) {
        throw new Error(`drift: package.json=${pkg.version} vs claude-plugin.json=${manifest.version}`);
    }
    return `aligned at ${pkg.version}`;
});

check('main entry exists', () => {
    const pkg = readJson('package.json');
    const p = path.join(here, pkg.main);
    if (!fs.existsSync(p)) throw new Error(`main not found: ${pkg.main}`);
    return pkg.main;
});

check('index.js parses (node --check)', () => {
    const r = cp.spawnSync(process.execPath, ['--check', path.join(here, 'index.js')], { encoding: 'utf-8' });
    if (r.status !== 0) throw new Error(`syntax error: ${(r.stderr || '').trim()}`);
    return 'syntax ok';
});

check('lib/ files referenced by index.js exist', () => {
    const idx = fs.readFileSync(path.join(here, 'index.js'), 'utf-8');
    const wanted = ['./lib/api-client', './lib/rag-utils'];
    for (const w of wanted) {
        if (!idx.includes(w)) throw new Error(`index.js does not require ${w}`);
        const f = path.join(here, w + '.js');
        if (!fs.existsSync(f)) throw new Error(`missing file: ${w}.js`);
    }
    return `${wanted.length} required modules present`;
});

check('marketplace.json parses if present', () => {
    const p = path.join(here, 'marketplace.json');
    if (!fs.existsSync(p)) return 'not present (ok)';
    JSON.parse(fs.readFileSync(p, 'utf-8'));
    return 'valid';
});

console.log('\nLuna Agents Plugin — validation\n' + '─'.repeat(48));
for (const r of results) {
    const tag = r.ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    console.log(`  ${tag} ${r.name.padEnd(48)}  ${r.detail || ''}`);
}
console.log('─'.repeat(48));
console.log(`  ${results.length - failed}/${results.length} passed${failed ? `, ${failed} failed` : ''}`);
console.log('');
process.exit(failed ? 1 : 0);
