/**
 * Seed Cloudflare Vectorize index with LunaOS documentation content.
 *
 * Reads markdown files from the docs site and key project files,
 * splits them into chunks, generates embeddings via Workers AI,
 * and upserts vectors into the `luna-code-index` Vectorize index.
 *
 * Environment variables:
 *   CLOUDFLARE_ACCOUNT_ID  — Cloudflare account ID
 *   CLOUDFLARE_API_TOKEN   — API token with Workers AI + Vectorize permissions
 *
 * Usage: npx tsx scripts/seed-vectorize.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

// ── Inlined from chunk-documents.ts ──────────────────────
interface DocChunk {
  id: string;
  text: string;
  metadata: { source: string; section: string; chunkIndex: number; totalChunks: number };
}

const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 200;

function chunkId(source: string, index: number): string {
  return 'doc-' + crypto.createHash('sha256').update(`${source}:${index}`).digest('hex').slice(0, 16);
}

function extractSection(text: string, fallback: string): string {
  const m = text.match(/^#{1,3}\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

function chunkDocument(content: string, sourcePath: string): DocChunk[] {
  const cleaned = content.replace(/\r\n/g, '\n').trim();
  if (!cleaned) return [];
  const chunks: DocChunk[] = [];
  const filename = path.basename(sourcePath, '.md');
  let offset = 0;
  while (offset < cleaned.length) {
    const end = Math.min(offset + CHUNK_SIZE, cleaned.length);
    let slice = cleaned.slice(offset, end);
    if (end < cleaned.length) {
      const lb = slice.lastIndexOf('\n\n');
      if (lb > CHUNK_SIZE * 0.5) slice = slice.slice(0, lb);
    }
    chunks.push({ id: chunkId(sourcePath, chunks.length), text: slice.trim(),
      metadata: { source: sourcePath, section: extractSection(slice, filename), chunkIndex: chunks.length, totalChunks: 0 } });
    offset += slice.length - CHUNK_OVERLAP;
    if (offset <= chunks.length * (CHUNK_SIZE - CHUNK_OVERLAP) - CHUNK_SIZE) break;
  }
  for (const c of chunks) c.metadata.totalChunks = chunks.length;
  return chunks;
}

function collectMarkdownFiles(dir: string): string[] {
  const results: string[] = [];
  function walk(d: string) {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.git') walk(full); }
      else if (e.name.endsWith('.md')) results.push(full);
    }
  }
  walk(dir);
  return results.sort();
}
// ── End inlined ──────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const INDEX_NAME = 'luna-code-index';
const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';
const BATCH_SIZE = 20;

if (!ACCOUNT_ID || !API_TOKEN) {
  console.error('Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN');
  process.exit(1);
}

const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}`;
const headers = {
  Authorization: `Bearer ${API_TOKEN}`,
  'Content-Type': 'application/json',
};

/** Call Workers AI to generate embeddings for a batch of texts. */
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const res = await fetch(`${BASE_URL}/ai/run/${EMBEDDING_MODEL}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text: texts }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Embedding API error ${res.status}: ${body}`);
  }

  const json = (await res.json()) as { result: { data: number[][] } };
  return json.result.data;
}

/** Upsert a batch of vectors into the Vectorize index. */
async function upsertVectors(
  vectors: { id: string; values: number[]; metadata: Record<string, string> }[],
): Promise<void> {
  const ndjson = vectors.map((v) => JSON.stringify(v)).join('\n');

  const res = await fetch(
    `${BASE_URL}/vectorize/v2/indexes/${INDEX_NAME}/upsert`,
    {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-ndjson' },
      body: ndjson,
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vectorize upsert error ${res.status}: ${body}`);
  }
}

/** Collect all markdown sources to index. */
function gatherSources(): string[] {
  const root = path.resolve(__dirname, '../..');
  const docsDir = path.join(root, 'lunaos-docs');
  const engineDir = path.join(root, 'lunaos-engine');

  const files = collectMarkdownFiles(path.join(docsDir, 'docs'));

  // Add top-level project docs
  const extras = [
    path.join(docsDir, 'README.md'),
    path.join(docsDir, 'CLAUDE.md'),
    path.join(engineDir, 'CLAUDE.md'),
    path.join(engineDir, 'README.md'),
    path.join(engineDir, 'docs', 'README.md'),
  ];

  for (const f of extras) {
    if (fs.existsSync(f) && !files.includes(f)) {
      files.push(f);
    }
  }

  return files;
}

/** Process chunks in batches: embed then upsert. */
async function processBatches(chunks: DocChunk[]): Promise<number> {
  let upserted = 0;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => c.text);

    const embeddings = await generateEmbeddings(texts);

    const vectors = batch.map((chunk, idx) => ({
      id: chunk.id,
      values: embeddings[idx],
      metadata: {
        source: chunk.metadata.source,
        section: chunk.metadata.section,
        chunkIndex: String(chunk.metadata.chunkIndex),
      },
    }));

    await upsertVectors(vectors);
    upserted += vectors.length;

    const pct = Math.round((upserted / chunks.length) * 100);
    console.log(`  [${pct}%] Upserted ${upserted}/${chunks.length} vectors`);
  }

  return upserted;
}

async function main(): Promise<void> {
  console.log('=== LunaOS Vectorize Seeder ===\n');

  const sources = gatherSources();
  console.log(`Found ${sources.length} markdown files\n`);

  const allChunks: DocChunk[] = [];

  for (const filePath of sources) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const chunks = chunkDocument(content, filePath);
    if (chunks.length > 0) {
      const rel = path.relative(path.resolve(__dirname, '../../..'), filePath);
      console.log(`  ${rel} -> ${chunks.length} chunks`);
      allChunks.push(...chunks);
    }
  }

  console.log(`\nTotal chunks to embed: ${allChunks.length}\n`);

  if (allChunks.length === 0) {
    console.log('No content to index. Exiting.');
    return;
  }

  console.log('Generating embeddings and upserting to Vectorize...\n');
  const total = await processBatches(allChunks);

  console.log(`\nDone! Upserted ${total} vectors into "${INDEX_NAME}".`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
