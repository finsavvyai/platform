/** pull-lmsys.ts — LMSYS-Chat-1M sample. Requires HF_TOKEN + accepted dataset terms. */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(import.meta.dirname, '..', 'corpora', 'b', 'lmsys.jsonl');
const TARGET = 5000;
const BATCH = 100;
const DATASET = 'lmsys/lmsys-chat-1m';
const SPLIT = 'train';
const URL = 'https://datasets-server.huggingface.co/rows';

if (!process.env.HF_TOKEN) {
  console.error('pull-lmsys: HF_TOKEN missing.');
  console.error('1. Create a HuggingFace token: https://huggingface.co/settings/tokens');
  console.error('2. Accept dataset terms: https://huggingface.co/datasets/lmsys/lmsys-chat-1m');
  console.error('3. Set HF_TOKEN in .env and re-run.');
  process.exit(2);
}

interface Row { row_idx: number; row: { conversation: Array<{ role: string; content: string }>; model?: string; language?: string } }

async function fetchBatch(offset: number, length: number): Promise<Row[]> {
  const u = `${URL}?dataset=${encodeURIComponent(DATASET)}&config=default&split=${SPLIT}&offset=${offset}&length=${length}`;
  const res = await fetch(u, { headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` } });
  if (res.status === 403) {
    console.error('pull-lmsys: 403 — dataset terms not accepted yet.');
    console.error('Visit https://huggingface.co/datasets/lmsys/lmsys-chat-1m and click "Agree and access repository".');
    process.exit(2);
  }
  if (!res.ok) throw new Error(`HF ${res.status} at offset ${offset}`);
  const json = await res.json() as { rows?: Row[] };
  return json.rows ?? [];
}

async function main() {
  mkdirSync(join(import.meta.dirname, '..', 'corpora', 'b'), { recursive: true });
  const out: string[] = [];
  let offset = 0;
  while (out.length < TARGET) {
    const rows = await fetchBatch(offset, BATCH);
    if (rows.length === 0) break;
    for (const r of rows) {
      if (out.length >= TARGET) break;
      // Use first user turn as the prompt; skip non-English unless dataset filter is wanted.
      const firstUser = r.row.conversation.find((m) => m.role === 'user');
      if (!firstUser?.content) continue;
      out.push(JSON.stringify({ id: `lmsys-${r.row_idx}`, source: DATASET, prompt: firstUser.content, language: r.row.language }));
    }
    offset += BATCH;
    if (offset % 1000 === 0) console.log(`  ...${out.length}/${TARGET} pulled (offset=${offset})`);
  }
  writeFileSync(OUT, out.join('\n') + '\n');
  console.log(`pull-lmsys: wrote ${out.length} rows to ${OUT}`);
}

main().catch((e) => { console.error('pull-lmsys failed:', e.message); process.exit(1); });
