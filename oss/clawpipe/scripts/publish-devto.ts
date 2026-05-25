/** DISABLED — Dev.to publish script pre-benchmark.
 *
 * The original target article (`marketing/devto/article-57-percent-savings.md`)
 * was archived to `marketing/.archive-pre-benchmark/` on 2026-05-19 because it
 * cited the synthetic in-house benchmark as "measured 57% on 400 real prompts".
 * Re-enable this script only after the public measured benchmark lands and a
 * new article is written against the measured numbers + methodology v1.0.
 *
 * To restore: set ARTICLE to the new article path, update the title at the
 * payload below, then remove this guard.
 *
 * Requires DEVTO_API_KEY in env or .env. Get one at:
 *   https://dev.to/settings/extensions -> DEV Community API Keys
 *
 * Usage (currently exits immediately):
 *   npx tsx scripts/publish-devto.ts [--draft]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

console.error('❌ publish-devto.ts is disabled pending the measured public benchmark.');
console.error('   See scripts/publish-devto.ts header for restoration steps.');
process.exit(2);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ROOT = path.resolve(__dirname, '..');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ARTICLE = path.join(ROOT, 'marketing/.archive-pre-benchmark/devto/article-57-percent-savings.md');

function resolveKey(): string | null {
  if (process.env.DEVTO_API_KEY) return process.env.DEVTO_API_KEY;
  const envFile = path.join(ROOT, '.env');
  if (!fs.existsSync(envFile)) return null;
  const m = fs.readFileSync(envFile, 'utf8').match(/^DEVTO_API_KEY=(.+)$/m);
  return m?.[1]?.replace(/['"]/g, '').trim() || null;
}

async function main() {
  const key = resolveKey();
  if (!key) {
    console.error('❌ DEVTO_API_KEY not set.');
    console.error('   Add to .env or: export DEVTO_API_KEY=...');
    console.error('   Get one: https://dev.to/settings/extensions');
    process.exit(1);
  }

  const draft = process.argv.includes('--draft');
  const body = fs.readFileSync(ARTICLE, 'utf8');
  // Strip existing frontmatter and rebuild with API-friendly fields.
  const noFrontmatter = body.replace(/^---\n[\s\S]*?\n---\n/, '').trim();

  const payload = {
    article: {
      title: 'We cut our OpenAI bill 57% with a 6-stage pipeline — here\'s the code',
      published: !draft,
      body_markdown: noFrontmatter,
      tags: ['openai', 'ai', 'performance', 'opensource'],
      canonical_url: 'https://clawpipe.ai/blog/57-percent-savings',
    },
  };

  const res = await fetch('https://dev.to/api/articles', {
    method: 'POST',
    headers: { 'api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const out = await res.json() as { id?: number; url?: string; error?: string };
  if (!res.ok) {
    console.error('❌ dev.to error:', out);
    process.exit(1);
  }
  console.log(`✅ ${draft ? 'drafted' : 'published'} — id=${out.id}`);
  console.log(`   ${out.url}`);
}

main().catch((e) => { console.error('publish-devto failed:', e.message); process.exit(1); });
