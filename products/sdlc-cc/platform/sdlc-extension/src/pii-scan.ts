/**
 * Local PII scanner — TS port of the high-confidence regex tier from
 * Microsoft's Presidio. Runs entirely in the browser; no network call,
 * no WASM payload. Designed for the chat-message hot path so it must
 * stay synchronous and well under 1 ms for typical message lengths.
 */

export type Entity =
  | 'EMAIL'
  | 'SSN'
  | 'CREDIT_CARD'
  | 'PHONE_US'
  | 'AWS_ACCESS_KEY'
  | 'AWS_SECRET_KEY'
  | 'API_KEY_GENERIC'
  | 'IPV4'
  | 'JWT';

export interface Match {
  entity: Entity;
  start: number;
  end: number;
  value: string;
}

interface Pattern {
  entity: Entity;
  re: RegExp;
  /** post-match validator; return false to drop the match. */
  validate?: (s: string) => boolean;
}

const PATTERNS: Pattern[] = [
  {
    entity: 'EMAIL',
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  {
    entity: 'SSN',
    // US SSN, with optional dashes, but reject all-zeros area / group / serial.
    re: /\b(?!000|666|9\d{2})\d{3}[- ]?(?!00)\d{2}[- ]?(?!0000)\d{4}\b/g,
  },
  {
    entity: 'CREDIT_CARD',
    // 13-19 digits with optional separators; we Luhn-check after match.
    re: /\b(?:\d[ -]?){13,19}\b/g,
    validate: (raw) => luhn(raw.replace(/[ -]/g, '')),
  },
  {
    entity: 'PHONE_US',
    re: /\b(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  },
  {
    entity: 'AWS_ACCESS_KEY',
    re: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  },
  {
    entity: 'AWS_SECRET_KEY',
    // 40-char base64 - tightened with prefix to reduce false positives.
    re: /(?<![A-Za-z0-9/+])[A-Za-z0-9/+]{40}(?![A-Za-z0-9/+])/g,
  },
  {
    entity: 'API_KEY_GENERIC',
    // sk-*, pk-*, ghp_*, github_pat_*, xoxb-* style tokens.
    re: /\b(?:sk-|pk-|ghp_|gho_|ghs_|github_pat_|xox[bpoa]-)[A-Za-z0-9_-]{16,}\b/g,
  },
  {
    entity: 'IPV4',
    re: /\b(?:25[0-5]|2[0-4]\d|[01]?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)){3}\b/g,
  },
  {
    entity: 'JWT',
    re: /\beyJ[A-Za-z0-9_-]+?\.eyJ[A-Za-z0-9_-]+?\.[A-Za-z0-9_-]+\b/g,
  },
];

/**
 * scan returns every match, in start order, with overlaps already collapsed
 * so callers can splice the original string by walking matches end → start.
 */
export function scan(input: string): Match[] {
  const found: Match[] = [];
  for (const { entity, re, validate } of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(input)) !== null) {
      if (validate && !validate(m[0])) continue;
      found.push({
        entity,
        start: m.index,
        end: m.index + m[0].length,
        value: m[0],
      });
    }
  }
  return collapseOverlaps(found.sort((a, b) => a.start - b.start));
}

/**
 * redact replaces matches with `[REDACTED:ENTITY]` markers. The marker is
 * deterministic so a downstream model still understands the context window.
 */
export function redact(input: string, matches: Match[] = scan(input)): string {
  if (matches.length === 0) return input;
  const ordered = [...matches].sort((a, b) => b.start - a.start);
  let out = input;
  for (const m of ordered) {
    out = out.slice(0, m.start) + `[REDACTED:${m.entity}]` + out.slice(m.end);
  }
  return out;
}

/**
 * collapseOverlaps drops any match fully contained in an earlier one.
 * Greedy: the first match (lower start, then longer) wins.
 */
function collapseOverlaps(matches: Match[]): Match[] {
  const out: Match[] = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      out.push(m);
      lastEnd = m.end;
    }
  }
  return out;
}

/**
 * luhn validates a numeric string as a credit-card-like checksum.
 */
function luhn(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    const n = digits.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return false;
    let v = n;
    if (alt) {
      v *= 2;
      if (v > 9) v -= 9;
    }
    sum += v;
    alt = !alt;
  }
  return sum % 10 === 0;
}
