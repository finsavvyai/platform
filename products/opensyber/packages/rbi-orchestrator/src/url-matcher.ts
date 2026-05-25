/**
 * URL → policy matcher.
 *
 * Precedence (highest first):
 *   1. Exact host match  (e.g. `evil.example.com`)
 *   2. Synthetic prefix match (`nrd:*`, `threat:*`) — upstream enrichment
 *      sets these by passing the URL with the prefix attached.
 *   3. Glob match (`*.tor2web.io`, `*.exe`) — leftmost-longest specificity wins,
 *      then policy `priority` (lower = earlier).
 *   4. Default policy (`urlPatterns` containing `*`).
 *
 * Hostname comparisons are case-insensitive. Path/extension matches preserve
 * case (filesystem-style). If multiple policies tie, the one with the lowest
 * `priority` wins; if still tied, the first in array order.
 */

import type { RbiPolicy } from './policies.js';

export interface MatchResult {
  policy: RbiPolicy;
  pattern: string;
  reason: 'exact-host' | 'prefix' | 'glob' | 'default';
}

interface ParsedUrl {
  raw: string;
  host: string; // lowercased, no port
  pathname: string; // includes leading slash
  prefix: string | null; // 'nrd' | 'threat' | null
}

export function parseUrlForMatching(url: string): ParsedUrl {
  const trimmed = url.trim();
  // Synthetic prefix forms — `nrd:https://...`, `threat:evil.com/path`.
  const prefixMatch = /^(nrd|threat):(.*)$/i.exec(trimmed);
  const prefix = prefixMatch?.[1]?.toLowerCase() ?? null;
  const rest = prefixMatch?.[2] ?? trimmed;

  // Try URL parser; fall back to bare hostname interpretation.
  let host = '';
  let pathname = '/';
  try {
    const u = new URL(rest.includes('://') ? rest : `https://${rest}`);
    host = u.hostname.toLowerCase();
    pathname = u.pathname || '/';
  } catch {
    host = rest.toLowerCase();
  }
  return { raw: trimmed, host, pathname, prefix };
}

function isExactHost(pattern: string): boolean {
  return !pattern.includes('*') && !pattern.includes(':');
}

function globToRegExp(pattern: string): RegExp {
  // Escape regex specials, then translate glob `*` to `.*`.
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

function matchesPattern(parsed: ParsedUrl, pattern: string): boolean {
  // Synthetic prefix: only matches when the URL came in with that prefix.
  const prefixMatch = /^(nrd|threat):(.*)$/i.exec(pattern);
  if (prefixMatch) {
    const [, prefix, rest] = prefixMatch;
    if (parsed.prefix !== prefix?.toLowerCase()) return false;
    if (rest === '*' || !rest) return true;
    return globToRegExp(rest!).test(parsed.host);
  }
  if (isExactHost(pattern)) return parsed.host === pattern.toLowerCase();
  // Glob — match against host, OR against pathname if pattern starts with `*.<ext>`.
  const re = globToRegExp(pattern);
  if (re.test(parsed.host)) return true;
  if (re.test(parsed.pathname)) return true;
  if (re.test(parsed.raw)) return true;
  return false;
}

function specificity(pattern: string): number {
  // Longer non-wildcard tail = more specific. Used to break ties between globs.
  return pattern.replace(/\*/g, '').length;
}

export function matchPolicy(url: string, policies: RbiPolicy[]): MatchResult {
  const parsed = parseUrlForMatching(url);

  // Pass 1 — exact host match wins immediately.
  for (const p of policies) {
    for (const pat of p.urlPatterns) {
      if (isExactHost(pat) && parsed.host === pat.toLowerCase()) {
        return { policy: p, pattern: pat, reason: 'exact-host' };
      }
    }
  }

  // Pass 2 — synthetic prefix match.
  if (parsed.prefix) {
    let best: { policy: RbiPolicy; pattern: string; spec: number } | null = null;
    for (const p of policies) {
      for (const pat of p.urlPatterns) {
        if (!/^(nrd|threat):/i.test(pat)) continue;
        if (!matchesPattern(parsed, pat)) continue;
        const spec = specificity(pat);
        if (!best || spec > best.spec || (spec === best.spec && p.priority < best.policy.priority)) {
          best = { policy: p, pattern: pat, spec };
        }
      }
    }
    if (best) return { policy: best.policy, pattern: best.pattern, reason: 'prefix' };
  }

  // Pass 3 — glob match. Skip pure '*' default.
  let bestGlob: { policy: RbiPolicy; pattern: string; spec: number } | null = null;
  for (const p of policies) {
    for (const pat of p.urlPatterns) {
      if (pat === '*') continue;
      if (isExactHost(pat) || /^(nrd|threat):/i.test(pat)) continue;
      if (!matchesPattern(parsed, pat)) continue;
      const spec = specificity(pat);
      if (!bestGlob || spec > bestGlob.spec || (spec === bestGlob.spec && p.priority < bestGlob.policy.priority)) {
        bestGlob = { policy: p, pattern: pat, spec };
      }
    }
  }
  if (bestGlob) return { policy: bestGlob.policy, pattern: bestGlob.pattern, reason: 'glob' };

  // Pass 4 — default policy ('*').
  for (const p of policies) {
    if (p.urlPatterns.includes('*')) {
      return { policy: p, pattern: '*', reason: 'default' };
    }
  }

  throw new Error('matchPolicy: no policy matched and no default ("*") policy supplied');
}
