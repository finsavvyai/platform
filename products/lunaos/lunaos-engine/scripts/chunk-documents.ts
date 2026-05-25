/**
 * Document chunking utilities for RAG vectorization.
 *
 * Splits markdown files into overlapping chunks suitable for embedding.
 * Each chunk is ~500 tokens (~2000 chars) with configurable overlap.
 *
 * Usage: imported by seed-vectorize.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface DocChunk {
  id: string;
  text: string;
  metadata: {
    source: string;
    section: string;
    chunkIndex: number;
    totalChunks: number;
  };
}

const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 200;

/** Generate a deterministic ID from source path + chunk index. */
function chunkId(source: string, index: number): string {
  const hash = crypto
    .createHash('sha256')
    .update(`${source}:${index}`)
    .digest('hex')
    .slice(0, 16);
  return `doc-${hash}`;
}

/** Extract the first heading from a text block, or fallback to filename. */
function extractSection(text: string, fallback: string): string {
  const match = text.match(/^#{1,3}\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

/** Split a single document into overlapping chunks. */
export function chunkDocument(
  content: string,
  sourcePath: string,
): DocChunk[] {
  const cleaned = content.replace(/\r\n/g, '\n').trim();
  if (!cleaned) return [];

  const chunks: DocChunk[] = [];
  const filename = path.basename(sourcePath, '.md');
  let offset = 0;

  while (offset < cleaned.length) {
    const end = Math.min(offset + CHUNK_SIZE, cleaned.length);
    let slice = cleaned.slice(offset, end);

    // Try to break at a paragraph boundary for cleaner chunks
    if (end < cleaned.length) {
      const lastBreak = slice.lastIndexOf('\n\n');
      if (lastBreak > CHUNK_SIZE * 0.5) {
        slice = slice.slice(0, lastBreak);
      }
    }

    chunks.push({
      id: chunkId(sourcePath, chunks.length),
      text: slice.trim(),
      metadata: {
        source: sourcePath,
        section: extractSection(slice, filename),
        chunkIndex: chunks.length,
        totalChunks: 0, // filled after loop
      },
    });

    offset += slice.length - CHUNK_OVERLAP;
    if (offset <= chunks.length * (CHUNK_SIZE - CHUNK_OVERLAP) - CHUNK_SIZE) {
      break; // safety: prevent infinite loop
    }
  }

  for (const chunk of chunks) {
    chunk.metadata.totalChunks = chunks.length;
  }

  return chunks;
}

/** Recursively collect markdown files from a directory. */
export function collectMarkdownFiles(dir: string): string[] {
  const results: string[] = [];

  function walk(d: string) {
    if (!fs.existsSync(d)) return;
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        walk(full);
      } else if (entry.name.endsWith('.md')) {
        results.push(full);
      }
    }
  }

  walk(dir);
  return results.sort();
}
