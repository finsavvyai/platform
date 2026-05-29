// Request/response contract for AMLIQ POST /api/v1/screen/public-demo.
// Mirrors the /screen skill spec at products/amliq/api/.claude/skills/screen.

export type ListId = "ofac" | "eu_fsf" | "un" | "uk_ofsi";

export const ALL_LIST_IDS: readonly ListId[] = [
  "ofac",
  "eu_fsf",
  "un",
  "uk_ofsi",
] as const;

export type Layer = "exact" | "fuzzy" | "phonetic" | "token" | "embedding";

export const ALL_LAYERS: readonly Layer[] = [
  "exact",
  "fuzzy",
  "phonetic",
  "token",
  "embedding",
] as const;

export type PepStatus = "none" | "current" | "former" | "associate";

export type RiskLevel = "clear" | "low" | "medium" | "high";

export interface ScreenRequest {
  name: string;
  lists?: ListId[];
  pep?: boolean;
  threshold?: number;
}

export interface LayerScore {
  layer: Layer;
  score: number;
  matched: boolean;
}

export interface ScreenMatch {
  entityId: string;
  entityName: string;
  confidence: number;
  lists: ListId[];
  layers: LayerScore[];
  pepStatus: PepStatus;
}

export interface ScreenResponse {
  query: string;
  matches: ScreenMatch[];
  riskLevel: RiskLevel;
  latencyMs: number;
  screenedAt: string;
}

export function isListId(value: string): value is ListId {
  return (ALL_LIST_IDS as readonly string[]).includes(value);
}

export function isLayer(value: string): value is Layer {
  return (ALL_LAYERS as readonly string[]).includes(value);
}

export function isRiskLevel(value: string): value is RiskLevel {
  return value === "clear" || value === "low" || value === "medium" || value === "high";
}

export function isPepStatus(value: string): value is PepStatus {
  return (
    value === "none" || value === "current" || value === "former" || value === "associate"
  );
}
