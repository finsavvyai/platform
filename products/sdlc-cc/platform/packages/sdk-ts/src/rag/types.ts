// RAG module types for the SDLC.ai JavaScript SDK
// Aligned with services/rag/openapi.yaml schemas

/** Retrieval strategy for context retrieval and RAG queries. */
export type RetrievalStrategy =
  | "dense_only"
  | "sparse_only"
  | "hybrid_fusion"
  | "multi_stage"
  | "cross_encoder_rerank"
  | "diversity_aware"
  | "personalized"
  | "temporal_weighted"
  | "authority_weighted";

/** Context assembly strategy. */
export type AssemblyStrategy =
  | "sequential"
  | "importance_weighted"
  | "diversity_optimized"
  | "coherence_focused"
  | "citation_aware"
  | "compressive"
  | "hierarchical"
  | "adaptive";

/** Search type for document search. */
export type SearchType = "semantic" | "keyword" | "hybrid";

/** Ranking algorithm for search results. */
export type SearchRanking =
  | "semantic_only"
  | "hybrid"
  | "personalized"
  | "recency_weighted"
  | "authority_weighted"
  | "diversity_weighted";

/** Document processing status. */
export type DocumentProcessingStatus = "processing" | "completed" | "failed";

/** Chunking strategy for document processing. */
export type ChunkingStrategy =
  | "fixed_size"
  | "sentence_based"
  | "paragraph_based"
  | "semantic"
  | "hybrid";

/** Citation style. */
export type CitationStyle =
  | "APA" | "MLA" | "Chicago" | "IEEE" | "Harvard"
  | "Vancouver" | "AMA" | "APS" | "Nature"
  | "numeric" | "inline" | "footnote";

/** Pipeline execution status. */
export type PipelineStatus =
  | "initiated"
  | "query_understanding"
  | "context_retrieval"
  | "context_assembly"
  | "citation_processing"
  | "quality_assessment"
  | "completed"
  | "failed"
  | "cancelled";

// --- RAG Query ---

export interface RAGPipelineConfig {
  enable_query_understanding?: boolean;
  enable_citation_processing?: boolean;
  enable_quality_assessment?: boolean;
  enable_streaming?: boolean;
  max_context_tokens?: number;
}

export interface RAGQueryRequest {
  query: string;
  config?: RAGPipelineConfig;
  user_id?: string;
  tenant_id?: string;
  session_id?: string;
  conversation_id?: string;
  retrieval_strategy?: RetrievalStrategy;
  assembly_strategy?: AssemblyStrategy;
  citation_styles?: CitationStyle[];
  context_window_type?: "llm" | "summary" | "analysis";
  metadata?: Record<string, unknown>;
}

export interface RAGSourceItem {
  id: string;
  text: string;
  source: string;
  page?: number;
  confidence: number;
  style?: string;
}

export interface RAGQueryResponse {
  pipeline_id: string;
  status: PipelineStatus;
  query: string;
  answer: string;
  context?: string;
  sources: RAGSourceItem[];
  confidence_score?: number;
  quality_score?: number;
  execution_time_ms: number;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

// --- Pipeline Status ---

export interface PipelineStatusResponse {
  pipeline_id: string;
  status: PipelineStatus;
  progress: number;
  current_step?: string;
  execution_time_ms: number;
  estimated_remaining_ms?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface PipelineCancelResponse {
  pipeline_id: string;
  status: "cancelled";
  message: string;
  timestamp: string;
}

// Re-export search and document types from split files
export * from "./types-search";
export * from "./types-documents";
