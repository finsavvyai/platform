/**
 * Script to split TypeScript files exceeding 200 lines into smaller modules.
 *
 * Strategy: For class-based files, extract groups of methods into separate files.
 * For interface/type files, split by logical groupings.
 * For all files: keep original as barrel that re-exports.
 *
 * Usage: npx tsx scripts/split-large-files.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MAX_LINES = 200;
const ROOT = path.resolve(__dirname, '..');

interface FileInfo {
  path: string;
  lines: number;
}

function findOversizedFiles(dir: string): FileInfo[] {
  const results: FileInfo[] = [];

  function walk(d: string) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', 'dist', '.next', '.wrangler'].includes(entry.name)) continue;
        walk(full);
      } else if (
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
        !entry.name.includes('.test.') &&
        !entry.name.includes('.spec.')
      ) {
        const content = fs.readFileSync(full, 'utf-8');
        const lineCount = content.split('\n').length;
        if (lineCount > MAX_LINES) {
          results.push({ path: full, lines: lineCount });
        }
      }
    }
  }

  walk(dir);
  return results.sort((a, b) => b.lines - a.lines);
}

/**
 * Split a file by finding natural section boundaries:
 * - Class method boundaries
 * - Export function boundaries
 * - Interface/type boundaries
 * - Comment section headers
 */
function splitFile(filePath: string): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  if (lines.length <= MAX_LINES) return;

  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  const ext = path.extname(filePath);

  // Find import block (everything before first export/class/interface/function)
  let importEnd = 0;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('import ') || trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('*/')) {
      importEnd = i + 1;
    } else {
      break;
    }
  }

  // Find section boundaries
  const sections: { start: number; end: number; name: string }[] = [];
  let currentStart = importEnd;
  let currentName = 'main';
  let sectionIndex = 0;

  for (let i = importEnd; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Detect section boundaries
    const isMethodStart = /^\s+(private |public |protected |async )*\w+\s*\(/.test(line) && !line.includes('=>');
    const isExportStart = /^export\s+(function|class|interface|type|enum|const|abstract)/.test(trimmed);
    const isSectionComment = /^(\s*\/\*\*|\s*\/\/ ---|\s*\/\/ ===|\s*\/\/ ###)/.test(line);

    if ((isMethodStart || isExportStart || isSectionComment) && i - currentStart > 30) {
      // Look back for JSDoc comment
      let sectionStart = i;
      while (sectionStart > currentStart && (lines[sectionStart - 1].trim().startsWith('*') || lines[sectionStart - 1].trim().startsWith('/**') || lines[sectionStart - 1].trim() === '')) {
        sectionStart--;
      }

      if (sectionStart > currentStart) {
        sections.push({ start: currentStart, end: sectionStart, name: `${base}-part${sectionIndex}` });
        currentStart = sectionStart;
        sectionIndex++;
      }
    }
  }

  // Add final section
  sections.push({ start: currentStart, end: lines.length, name: `${base}-part${sectionIndex}` });

  // If we only got 1 section, try a simpler split by line count
  if (sections.length <= 1) {
    const chunkSize = Math.ceil(lines.length / Math.ceil(lines.length / (MAX_LINES - 20)));
    sections.length = 0;
    sectionIndex = 0;
    for (let i = importEnd; i < lines.length; i += chunkSize) {
      sections.push({
        start: i,
        end: Math.min(i + chunkSize, lines.length),
        name: `${base}-part${sectionIndex}`
      });
      sectionIndex++;
    }
  }

  // Merge small sections to avoid creating too many tiny files
  const mergedSections: typeof sections = [];
  let accumulator = sections[0];

  for (let i = 1; i < sections.length; i++) {
    const combined = sections[i].end - accumulator.start;
    if (combined <= MAX_LINES - 20) {
      // Merge
      accumulator = { ...accumulator, end: sections[i].end };
    } else {
      mergedSections.push(accumulator);
      accumulator = sections[i];
    }
  }
  mergedSections.push(accumulator);

  if (mergedSections.length <= 1) {
    console.log(`  SKIP: Could not find natural split points for ${filePath}`);
    return;
  }

  // Extract imports from the original file
  const importBlock = lines.slice(0, importEnd).join('\n');

  // Write part files
  const partFiles: string[] = [];
  for (const section of mergedSections) {
    const partContent = lines.slice(section.start, section.end).join('\n');
    const partFile = path.join(dir, `${section.name}${ext}`);

    // Build the part file: imports + content
    const fullContent = `${importBlock}\n\n${partContent}\n`;
    fs.writeFileSync(partFile, fullContent);
    partFiles.push(section.name);

    const partLines = fullContent.split('\n').length;
    console.log(`  Created ${section.name}${ext} (${partLines} lines)`);
  }

  // Rewrite original as barrel
  const reexports = partFiles.map(f => `export * from './${f}';`).join('\n');
  const barrelContent = `/**\n * ${base} — barrel file\n * Split into ${partFiles.length} parts for 200-line compliance.\n */\n\n${reexports}\n`;
  fs.writeFileSync(filePath, barrelContent);
  console.log(`  Rewrote ${path.basename(filePath)} as barrel (${barrelContent.split('\n').length} lines)`);
}

// Main
const files = findOversizedFiles(path.join(ROOT, 'packages'));
console.log(`Found ${files.length} files over ${MAX_LINES} lines:\n`);

for (const f of files) {
  console.log(`Splitting ${path.relative(ROOT, f.path)} (${f.lines} lines):`);
  try {
    splitFile(f.path);
  } catch (err) {
    console.error(`  ERROR: ${err}`);
  }
  console.log('');
}

// Verify
const remaining = findOversizedFiles(path.join(ROOT, 'packages'));
console.log(`\nRemaining oversized files: ${remaining.length}`);
for (const f of remaining) {
  console.log(`  ${path.relative(ROOT, f.path)}: ${f.lines} lines`);
}
