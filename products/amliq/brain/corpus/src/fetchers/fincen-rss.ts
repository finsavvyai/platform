/**
 * FinCEN RSS fetcher.
 *
 * Uses Web `fetch` (Node 20+). No axios, no got, no XML lib — RSS 2.0
 * is regular enough to parse with a tiny extractor and stays dep-free.
 * If the FinCEN feed format changes shape, this fetcher returns the
 * docs it could parse plus structured `IngestError` entries; it never
 * throws.
 */

import { createHash } from "node:crypto";
import type {
  ComplianceDoc,
  FetchResult,
  Fetcher,
  IngestError,
  SourceConfig,
} from "../types.js";

const ITEM_RE = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
const FIELD_RES: Record<string, RegExp> = {
  title: /<title>([\s\S]*?)<\/title>/i,
  guid: /<guid[^>]*>([\s\S]*?)<\/guid>/i,
  pubDate: /<pubDate>([\s\S]*?)<\/pubDate>/i,
  description: /<description>([\s\S]*?)<\/description>/i,
};

function unwrapCdata(raw: string): string {
  const m = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(raw);
  const inner = m?.[1];
  return (inner ?? raw).trim();
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function toIso(pubDate: string): string {
  const d = new Date(pubDate);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function pickField(block: string, name: keyof typeof FIELD_RES): string {
  const re = FIELD_RES[name];
  if (!re) return "";
  const m = re.exec(block);
  const raw = m?.[1];
  return raw === undefined ? "" : unwrapCdata(raw);
}

function parseItem(
  block: string,
  cfg: SourceConfig,
): ComplianceDoc | IngestError {
  const title = stripTags(pickField(block, "title"));
  const guid = pickField(block, "guid").trim();
  const pubRaw = pickField(block, "pubDate");
  const body = stripTags(pickField(block, "description"));
  if (!title || !guid || !pubRaw || !body) {
    return {
      source: cfg.source,
      stage: "parse",
      code: "missing_field",
      message: `item missing required field (title/guid/pubDate/description)`,
    };
  }
  const published_at = toIso(pubRaw);
  if (!published_at) {
    return {
      source: cfg.source,
      stage: "parse",
      code: "bad_pubdate",
      message: `unparseable pubDate: ${pubRaw}`,
    };
  }
  return {
    source: cfg.source,
    jurisdiction: cfg.jurisdiction,
    doc_id: guid,
    title,
    published_at,
    sha256: sha256Hex(body),
    body,
  };
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return await res.text();
}

export const fincenRss: Fetcher = async (cfg: SourceConfig): Promise<FetchResult> => {
  const errors: IngestError[] = [];
  let text: string;
  try {
    text = await fetchText(cfg.url);
  } catch (err) {
    errors.push({
      source: cfg.source,
      stage: "fetch",
      code: "fetch_failed",
      message: err instanceof Error ? err.message : "unknown",
    });
    return { docs: [], errors };
  }
  const docs: ComplianceDoc[] = [];
  const matches = text.match(ITEM_RE) ?? [];
  if (matches.length === 0) {
    errors.push({
      source: cfg.source,
      stage: "parse",
      code: "empty_or_malformed_feed",
      message: "no <item> elements found",
    });
    return { docs, errors };
  }
  for (const block of matches) {
    const result = parseItem(block, cfg);
    if ("sha256" in result) {
      docs.push(result);
    } else {
      errors.push(result);
    }
  }
  return { docs, errors };
};
