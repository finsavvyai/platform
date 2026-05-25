#!/usr/bin/env node
/**
 * browser-heal.mjs — run Playwright, parse failures, emit fix proposals.
 *
 * Loop:
 *   1. Execute `playwright test --reporter=json`
 *   2. Parse results JSON
 *   3. Group failures by error signature
 *   4. Emit fix-proposal JSON (test-results/heal-proposals.json)
 *
 * Does NOT mutate source. Produces structured suggestions a human or
 * downstream agent can apply.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');
const RESULTS = resolve(ROOT, 'test-results', 'results.json');
const PROPOSALS = resolve(ROOT, 'test-results', 'heal-proposals.json');

async function run() {
    if (!existsSync(dirname(RESULTS))) mkdirSync(dirname(RESULTS), { recursive: true });

    console.log('[heal] running playwright suite...');
    const args = ['playwright', 'test', '--reporter=json', ...process.argv.slice(2)];
    const code = await spawnWait('npx', args, ROOT);
    console.log(`[heal] playwright exited with code ${code}`);

    if (!existsSync(RESULTS)) {
        console.error('[heal] no results.json produced — aborting');
        process.exit(code || 1);
    }

    const data = JSON.parse(readFileSync(RESULTS, 'utf8'));
    const failures = collectFailures(data);
    const proposals = failures.map(toProposal);
    writeFileSync(
        PROPOSALS,
        JSON.stringify({ generatedAt: new Date().toISOString(), failures, proposals }, null, 2),
    );

    console.log(`[heal] ${failures.length} failure(s) | proposals -> ${PROPOSALS}`);
    if (failures.length === 0) process.exit(0);
    for (const p of proposals) {
        console.log(`  ✗ ${p.title}`);
        console.log(`    hint: ${p.hint}`);
    }
    process.exit(code || 1);
}

function collectFailures(results) {
    const out = [];
    const walk = (suite) => {
        for (const spec of suite.specs || []) {
            for (const t of spec.tests || []) {
                for (const r of t.results || []) {
                    if (r.status === 'failed' || r.status === 'timedOut') {
                        out.push({
                            file: spec.file,
                            title: spec.title,
                            project: t.projectName,
                            status: r.status,
                            duration: r.duration,
                            error: (r.errors?.[0]?.message || r.error?.message || '').slice(0, 1000),
                            stack: (r.errors?.[0]?.stack || '').slice(0, 2000),
                        });
                    }
                }
            }
        }
        for (const s of suite.suites || []) walk(s);
    };
    for (const s of results.suites || []) walk(s);
    return out;
}

function toProposal(f) {
    const err = f.error || '';
    let hint = 'Inspect the failing assertion manually.';
    if (/locator.*(wait for|not visible|timed out)/i.test(err)) {
        hint = 'Element selector may have drifted. Run with --headed and check data-testid stability.';
    } else if (/Expected: (.+)\s+Received: (.+)/m.test(err)) {
        hint = 'Assertion value mismatch. Verify API mock shape matches real response or update expected value.';
    } else if (/net::ERR|ECONNREFUSED/i.test(err)) {
        hint = 'Base URL unreachable. Start the dev server or set STUDIO_URL/DASHBOARD_URL/MARKETING_URL env.';
    } else if (/toHaveScreenshot/i.test(err)) {
        hint = 'Visual diff exceeded threshold. Review --update-snapshots run and approve deliberate UI changes.';
    } else if (/401|Unauthorized/i.test(err)) {
        hint = 'Auth missing. Set LUNAOS_TEST_API_KEY or confirm mockedPage fixture is used.';
    }
    return { file: f.file, title: f.title, project: f.project, signature: err.split('\n')[0], hint };
}

function spawnWait(cmd, args, cwd) {
    return new Promise((resolveFn) => {
        const child = spawn(cmd, args, { cwd, stdio: 'inherit' });
        child.on('exit', (c) => resolveFn(c ?? 1));
        child.on('error', () => resolveFn(1));
    });
}

run().catch((e) => {
    console.error('[heal] fatal', e);
    process.exit(2);
});
