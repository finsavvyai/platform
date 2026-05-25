// RAG search types for the SDLC.ai JavaScript SDK

import type { SearchType, SearchRanking } from "./types";

export interface SearchFilters {
  document_type?: string[];
  source?: string[];
  date_range?: { start: string; end: string };
  topics?: string[];
  custom_metadata?: Record<string, unknown>;
}

export interface SearchRequest {
  query: string;
  search_type?: SearchType;
  ranking?: SearchRanking;
  limit?: number;
  offset?: number;
  filters?: SearchFilters;
  include_highlights?: boolean;
  include_explanations?: boolean;
  min_score?: number;
  include_expired?: boolean;
}

export interface SearchResultItem {
  chunk_id: string;
  document_id: string;
  content: string;
  score: number;
  rank_score?: number;
  metadata?: Record<string, unknown>;
  document_metadata?: Record<string, unknown>;
  highlights?: string[];
  ranking_explanation?: Record<string, unknown>;
  similarity_score?: number;
  authority_score?: number;
  recency_score?: number;
}

export interface SearchResponse {
  results: SearchResultItem[];
  total_count: number;
  query: string;
  search_time_ms: number;
  cache_hit?: boolean;
  ranking_algorithm?: string;
  filters_applied?: boolean;
  suggestions?: string[];
}
