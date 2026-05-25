/**
 * RAG Search — performs semantic code search against local index or cloud
 */

import chalk from 'chalk';
import ora from 'ora';
import fs from 'node:fs';
import path from 'node:path';
import { getCloudToken, getApiUrl } from '../utils/config-store.js';

const LUNA = chalk.hex('#E8A317');

interface SearchOptions {
    cloud?: boolean;
    local?: boolean;
    limit?: string;
    verbose?: boolean;
}

interface SearchResult {
    path: string;
    score: number;
    snippet: string;
    line?: number;
}

export async function ragSearch(query: string, options: SearchOptions): Promise<void> {
    console.log('');
    console.log(LUNA('🌙 Luna RAG Search'));
    console.log(chalk.dim(`  Query: "${query}"`));
    console.log('');

    const limit = parseInt(options.limit || '10', 10);
    const token = getCloudToken();
    const useCloud = options.cloud || (!options.local && !!token);

    if (useCloud && token) {
        await cloudSearch(query, token, limit, options.verbose);
    } else {
        await localSearch(query, limit, options.verbose);
    }
}

// ─── Cloud Search ───────────────────────────────────

async function cloudSearch(
    query: string,
    token: string,
    limit: number,
    verbose?: boolean,
): Promise<void> {
    const spinner = ora({ text: 'Searching cloud index...', color: 'cyan' }).start();
    const API_BASE = getApiUrl();

    try {
        const response = await fetch(`${API_BASE}/rag/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ query, limit }),
        });

        if (!response.ok) {
            const err = await response.json() as any;

            if (response.status === 429) {
                spinner.fail('Daily search limit reached');
                showUpgradeHint();
                return;
            }

            throw new Error(err.error || `HTTP ${response.status}`);
        }

        const data = await response.json() as any;
        spinner.succeed(`Found ${chalk.white(String(data.results?.length || 0))} results`);

        displayResults(data.results || [], verbose);
    } catch (error: any) {
        spinner.fail(chalk.red(`Search failed: ${error.message}`));
    }
}

// ─── Local Search ───────────────────────────────────

async function localSearch(
    query: string,
    limit: number,
    verbose?: boolean,
): Promise<void> {
    const indexDir = path.join(process.cwd(), '.luna', 'index');
    const chunksPath = path.join(indexDir, 'chunks.json');

    if (!fs.existsSync(chunksPath)) {
        console.log(chalk.yellow('  No local index found'));
        console.log(chalk.dim('  Run: ') + chalk.cyan('luna index') + chalk.dim(' to index your project'));
        console.log('');
        return;
    }

    const spinner = ora({ text: 'Searching local index...', color: 'cyan' }).start();

    try {
        const chunks = JSON.parse(fs.readFileSync(chunksPath, 'utf-8')) as any[];
        const queryTerms = query.toLowerCase().split(/\s+/);

        const scored = chunks
            .map(chunk => {
                const content = (chunk.content || '').toLowerCase();
                const filePath = (chunk.id || '').toLowerCase();
                let score = 0;

                for (const term of queryTerms) {
                    const contentMatches = countOccurrences(content, term);
                    const pathMatches = countOccurrences(filePath, term);
                    score += contentMatches * 1 + pathMatches * 3;
                }

                return { chunk, score };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        spinner.succeed(`Found ${chalk.white(String(scored.length))} results`);

        const results: SearchResult[] = scored.map(item => ({
            path: item.chunk.id,
            score: item.score,
            snippet: extractSnippet(item.chunk.content, queryTerms),
        }));

        displayResults(results, verbose);

        if (scored.length === 0) {
            console.log(chalk.dim('  Try broader search terms or re-index: ') + chalk.cyan('luna index'));
        }
    } catch (error: any) {
        spinner.fail(chalk.red(`Search failed: ${error.message}`));
    }
}

// ─── Display ────────────────────────────────────────

function displayResults(results: SearchResult[], verbose?: boolean): void {
    if (results.length === 0) {
        console.log('');
        console.log(chalk.dim('  No matching results'));
        console.log('');
        return;
    }

    console.log('');

    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const scoreBar = chalk.dim(`(${typeof r.score === 'number' ? r.score.toFixed(1) : r.score})`);
        console.log(`  ${chalk.green(`${i + 1}.`)} ${chalk.white(r.path)} ${scoreBar}`);

        if (verbose && r.snippet) {
            const lines = r.snippet.split('\n').slice(0, 5);
            for (const line of lines) {
                console.log(chalk.dim(`     ${line.trimEnd()}`));
            }
            console.log('');
        }
    }

    console.log('');
}

function showUpgradeHint(): void {
    console.log('');
    console.log(chalk.dim('  Upgrade for unlimited searches:'));
    console.log(`    ${chalk.cyan('luna rag upgrade')}`);
    console.log('');
}

// ─── Helpers ────────────────────────────────────────

function countOccurrences(text: string, term: string): number {
    let count = 0;
    let pos = 0;
    while ((pos = text.indexOf(term, pos)) !== -1) {
        count++;
        pos += term.length;
    }
    return count;
}

function extractSnippet(content: string, terms: string[]): string {
    const lines = content.split('\n');
    const lowerLines = lines.map(l => l.toLowerCase());

    for (let i = 0; i < lowerLines.length; i++) {
        if (terms.some(t => lowerLines[i].includes(t))) {
            const start = Math.max(0, i - 1);
            const end = Math.min(lines.length, i + 4);
            return lines.slice(start, end).join('\n');
        }
    }

    return lines.slice(0, 3).join('\n');
}
