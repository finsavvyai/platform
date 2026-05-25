/** pull-banking77.ts — Banking77 intent classification via mteb/banking77 mirror. CC-BY-4.0. */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(import.meta.dirname, '..', 'corpora', 'c', 'banking77.jsonl');
const TARGET = 1500;
const BATCH = 100;
const DATASET = 'mteb/banking77';
const SPLIT = 'train';
const URL = 'https://datasets-server.huggingface.co/rows';

interface Row { row_idx: number; row: { text: string; label: number; label_text: string } }

async function fetchBatch(offset: number, length: number): Promise<Row[]> {
  const u = `${URL}?dataset=${encodeURIComponent(DATASET)}&config=default&split=${SPLIT}&offset=${offset}&length=${length}`;
  const res = await fetch(u);
  if (!res.ok) throw new Error(`HF ${res.status} at offset ${offset}`);
  const json = await res.json() as { rows?: Row[] };
  return json.rows ?? [];
}

async function discoverLabels(): Promise<string[]> {
  // Scan the full train split (9993 rows). Banking77 rows appear sorted by label,
  // so a partial scan misses tail labels.
  const labels = new Set<string>();
  let offset = 0;
  while (offset < 10000) {
    const rows = await fetchBatch(offset, BATCH);
    if (rows.length === 0) break;
    for (const r of rows) labels.add(r.row.label_text);
    offset += BATCH;
    if (labels.size >= 77) break;
  }
  return [...labels].sort();
}

async function main() {
  mkdirSync(join(import.meta.dirname, '..', 'corpora', 'c'), { recursive: true });
  const labels = await discoverLabels();
  if (labels.length < 50) { console.error(`pull-banking77: only ${labels.length} labels discovered, abort`); process.exit(1); }
  const labelHint = labels.join(', ');
  const out: string[] = [];
  let offset = 0;
  while (out.length < TARGET) {
    const rows = await fetchBatch(offset, BATCH);
    if (rows.length === 0) break;
    for (const r of rows) {
      if (out.length >= TARGET) break;
      const prompt = `Classify this customer query into exactly one of these intents: ${labelHint}\n\nQuery: ${r.row.text}\n\nReply with only the intent label.`;
      out.push(JSON.stringify({ id: `banking77-${r.row_idx}`, source: DATASET, prompt, expected: r.row.label_text }));
    }
    offset += BATCH;
    if (offset % 500 === 0) console.log(`  ...${out.length}/${TARGET} pulled (offset=${offset})`);
  }
  writeFileSync(OUT, out.join('\n') + '\n');
  console.log(`pull-banking77: wrote ${out.length} rows (${labels.length} labels) to ${OUT}`);
}

main().catch((e) => { console.error('pull-banking77 failed:', e.message); process.exit(1); });
