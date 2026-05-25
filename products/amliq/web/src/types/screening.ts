export interface LayerEvidence {
  layer: string;
  score: number;
  algorithm: string;
  matched: string;
}

export interface ScreenMatch {
  entity_id: string;
  entity_name: string;
  entity_type?: string;
  list_id: string;
  confidence: number;
  disposition: string;
  layers: LayerEvidence[];
  explanation: string;
  given_name?: string;
  family_name?: string;
  date_of_birth?: string;
  nationalities?: string[];
  original_script?: string;
  metadata?: Record<string, unknown>;
  type?: string;
  source_type?: string;
  // Promoted entity fields (backend may send "" | null | string | array)
  aliases?: string | string[] | null;
  addresses?: string | string[] | null;
  identifiers?:
    | string
    | { type: string; value: string; country: string }[]
    | null;
  // Promoted metadata fields (OpenSanctions)
  dataset?: string;
  schemaType?: string;
  schema_type?: string;
  firstSeen?: string;
  first_seen?: string;
  lastSeen?: string;
  last_seen?: string;
  lastChange?: string;
  last_change?: string;
  listingDate?: string;
  listing_date?: string;
  birthPlace?: string;
  birth_place?: string;
  birthCountry?: string;
  birth_country?: string;
  sourceUrl?: string;
  source_url?: string;
  gender?: string;
  position?: string;
  pepTier?: string;
  pep_tier?: string;
  emails?: string | string[] | null;
  phones?: string | string[] | null;
  websites?: string | string[] | null;
  programs?: string | string[] | null;
  sanctions?: string | Record<string, unknown>[] | null;
  remarks?: string | null;
  extendedData?: Record<string, unknown> | null;
  extended_data?: Record<string, unknown> | null;
}

/** Normalize any backend shape ("", null, "a,b", ["a","b"]) into a string[]. */
export function toStringArray(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (!trimmed) return [];
    return trimmed.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export interface ScreenResponse {
  query: string;
  total_matches: number;
  processing_time_ms: number;
  matches: ScreenMatch[];
  available_lists: string[];
}
