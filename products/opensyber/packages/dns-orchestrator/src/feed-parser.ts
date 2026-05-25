/**
 * Threat-feed parser.
 *
 * Converts the raw text body of a feed into a normalised set of
 * `{ domain, source }` entries the RPZ builder can consume.
 *
 * Each parser is intentionally strict: we drop comments, blanks, and
 * anything that doesn't look like a hostname. Bad lines are silently
 * skipped — the upstream feed is not under our control and a single
 * malformed line must not break the sync.
 */

import type { FeedFormat } from './feeds.js';

export interface ParsedEntry {
  domain: string;
  source: string;
}

// Minimal hostname validator: 1-253 chars, dot-separated labels, ASCII.
// We deliberately do NOT accept wildcards here — RPZ wildcard handling
// is a builder concern, not a parser one.
const HOSTNAME_RE =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

function isHostname(s: string): boolean {
  return HOSTNAME_RE.test(s);
}

function normalise(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, '');
}

function parseHosts(text: string, source: string): ParsedEntry[] {
  // hosts(5) format: "<ip> <hostname> [# comment]"
  const out: ParsedEntry[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;
    const host = normalise(parts[1] ?? '');
    if (!host || host === 'localhost') continue;
    if (!isHostname(host)) continue;
    out.push({ domain: host, source });
  }
  return out;
}

function parseDomainList(text: string, source: string): ParsedEntry[] {
  const out: ParsedEntry[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const host = normalise(line);
    if (!isHostname(host)) continue;
    out.push({ domain: host, source });
  }
  return out;
}

function parseUrls(text: string, source: string): ParsedEntry[] {
  const out: ParsedEntry[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    let host: string;
    try {
      host = normalise(new URL(line).hostname);
    } catch {
      continue;
    }
    if (!isHostname(host)) continue;
    out.push({ domain: host, source });
  }
  return out;
}

function parsePhishtankCsv(text: string, source: string): ParsedEntry[] {
  // CSV header: phish_id,url,phish_detail_url,submission_time,verified,...
  // We only need column index 1 (url). Use a minimal CSV split that copes
  // with quoted fields containing commas.
  const out: ParsedEntry[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || i === 0) continue; // skip header + blanks
    const cols = splitCsvLine(line);
    const url = cols[1];
    if (!url) continue;
    let host: string;
    try {
      host = normalise(new URL(url).hostname);
    } catch {
      continue;
    }
    if (!isHostname(host)) continue;
    out.push({ domain: host, source });
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseSpamhausZone(text: string, source: string): ParsedEntry[] {
  // Spamhaus DBL zone uses standard BIND zone-file format. Each blocked
  // domain appears as `<name> IN A 127.0.1.x` (or AAAA). We extract the
  // owner name and ignore SOA / NS / TXT records.
  const out: ParsedEntry[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/;.*$/, '').trim();
    if (!line) continue;
    const m = line.match(/^([a-z0-9.\-_]+)\s+(?:\d+\s+)?IN\s+(?:A|AAAA)\s+/i);
    if (!m || !m[1]) continue;
    const host = normalise(m[1]);
    if (!isHostname(host)) continue;
    out.push({ domain: host, source });
  }
  return out;
}

/** Dispatch to the format-specific parser. Unknown formats return []. */
export function parseFeed(
  format: FeedFormat,
  text: string,
  source: string = format,
): ParsedEntry[] {
  switch (format) {
    case 'hosts':
      return parseHosts(text, source);
    case 'domain-list':
      return parseDomainList(text, source);
    case 'urls':
      return parseUrls(text, source);
    case 'phishtank-csv':
      return parsePhishtankCsv(text, source);
    case 'spamhaus-zone':
      return parseSpamhausZone(text, source);
    default:
      return [];
  }
}
