/**
 * Guard inference client. In production this calls the hosted sdlc-guard-v1
 * (DeBERTa-v3-base fine-tune) endpoint. Until the model is published the
 * client falls back to a local heuristic so the arena UX still works
 * end-to-end during development.
 *
 * Both code paths return the same shape: a probability in [0, 1] that the
 * input is an injection / jailbreak / PII-leak attempt.
 */

export interface GuardResult {
  score: number;
  label: 'benign' | 'attack';
  signals: string[];
  source: 'remote' | 'heuristic';
}

const SUSPICIOUS_PATTERNS: Array<{ name: string; re: RegExp; weight: number }> = [
  { name: 'ignore_prior', re: /ignore\s+(previous|prior|above)\s+(instructions|prompt)/i, weight: 0.8 },
  { name: 'reveal_prompt', re: /(reveal|repeat|print|dump|show).*(system\s+prompt|instructions|initial)/i, weight: 0.85 },
  { name: 'forget_instructions', re: /forget\s+(your|all|previous)\s+(instructions|rules)/i, weight: 0.85 },
  { name: 'roleplay_evasion', re: /(pretend|imagine|role.?play|you\s+are\s+now)/i, weight: 0.4 },
  { name: 'fictional_framing', re: /(write\s+a\s+(novel|story|poem|script).*(detailed|step.?by.?step))/i, weight: 0.6 },
  { name: 'debug_keyword', re: /\b(DEBUG|SUDO|ADMIN|ROOT)\b\s*[:=]/, weight: 0.7 },
  { name: 'rag_inline_directive', re: /<\s*doc\s*>[\s\S]*\b(SYSTEM|INSTRUCT)/i, weight: 0.9 },
  { name: 'pii_solicitation', re: /\b(ssn|social\s+security|credit\s+card|password|api\s+key)\b/i, weight: 0.5 },
];

/**
 * scoreLocally runs the heuristic fallback. Returns the max-weighted
 * suspicious pattern as the score, with all triggered pattern names listed.
 */
export function scoreLocally(input: string): GuardResult {
  const signals: string[] = [];
  let max = 0;
  for (const { name, re, weight } of SUSPICIOUS_PATTERNS) {
    if (re.test(input)) {
      signals.push(name);
      if (weight > max) max = weight;
    }
  }
  return {
    score: max,
    label: max >= 0.5 ? 'attack' : 'benign',
    signals,
    source: 'heuristic',
  };
}

export interface ScoreOptions {
  endpoint?: string;
  apiKey?: string;
  timeoutMs?: number;
}

/**
 * scoreRemote calls the hosted sdlc-guard endpoint. Falls back to the local
 * heuristic on network error or non-200 response so the arena keeps working.
 */
export async function scoreRemote(input: string, opts: ScoreOptions = {}): Promise<GuardResult> {
  const endpoint = opts.endpoint ?? process.env.GUARD_ENDPOINT;
  if (!endpoint) {
    return scoreLocally(input);
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), opts.timeoutMs ?? 4_000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {}),
      },
      body: JSON.stringify({ input }),
      signal: controller.signal,
    });
    if (!res.ok) return scoreLocally(input);
    const data = (await res.json()) as { score?: number; signals?: string[] };
    if (typeof data.score !== 'number') return scoreLocally(input);
    return {
      score: data.score,
      label: data.score >= 0.5 ? 'attack' : 'benign',
      signals: data.signals ?? [],
      source: 'remote',
    };
  } catch {
    return scoreLocally(input);
  } finally {
    clearTimeout(t);
  }
}
