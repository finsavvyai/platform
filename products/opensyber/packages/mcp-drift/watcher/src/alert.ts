// Structured alert emitter. Returns a serializable object that the Hono route
// can JSON-encode and the CLI demo can pretty-print.

import type { DriftResult } from './differ.js';

export interface DriftAlert {
  serverUrl: string;
  toolName: string;
  verdict: DriftResult['verdict'];
  reason: string;
  oldFingerprint: string | null;
  newFingerprint: string;
  diffSummary: string;
  observedAt: number;
}

export function formatAlertForConsole(a: DriftAlert): string {
  const banner =
    a.verdict === 'suspicious-injection'
      ? '🚨  DRIFT DETECTED — cross-session rug-pull'
      : a.verdict === 'version-bump'
        ? '⚠️  version drift'
        : a.verdict === 'first-seen'
          ? 'ℹ️  first observation'
          : '✅  unchanged';
  return [
    banner,
    `  server : ${a.serverUrl}`,
    `  tool   : ${a.toolName}`,
    `  reason : ${a.reason}`,
    `  hash   : ${a.oldFingerprint ?? '(none)'}  →  ${a.newFingerprint}`,
    a.diffSummary ? `  diff   : ${a.diffSummary.replace(/\n/g, '\n           ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
