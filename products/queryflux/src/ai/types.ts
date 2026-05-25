/**
 * AI assistant types.
 */

export interface QuerySuggestion {
  id: string;
  query: string;
  description: string;
  confidence: number; // 0-1
  tags: string[];
}

export interface QueryExplanation {
  summary: string;
  purpose: string;
  tables: string[];
  joins: Array<{
    type: string;
    leftTable: string;
    rightTable: string;
    condition: string;
  }>;
  filters: string[];
  aggregations: string[];
  sorting: string[];
  complexity: "simple" | "moderate" | "complex";
}

export interface AIRequest {
  type: "suggest" | "explain" | "optimize" | "translate";
  input: string;
  connectionId?: string;
  context?: Record<string, unknown>;
}

export interface AIResponse {
  success: boolean;
  data?: QuerySuggestion[] | QueryExplanation | string;
  error?: string;
  executionTime: number;
}

export interface NLQueryIntent {
  type: "select" | "aggregate" | "join" | "filter" | "order" | "unknown";
  tables: string[];
  columns: string[];
  conditions: string[];
  confidence: number;
}
