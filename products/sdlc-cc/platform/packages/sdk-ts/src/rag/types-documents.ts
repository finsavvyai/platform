// RAG document types for the SDLC.ai JavaScript SDK

import type { DocumentProcessingStatus, ChunkingStrategy } from "./types";

export interface DocumentUploadMetadata {
  title?: string;
  author?: string;
  source?: string;
  publication_date?: string;
  topics?: string[];
  language?: string;
}

export interface DocumentProcessingOptions {
  chunking_strategy?: ChunkingStrategy;
  chunk_size?: number;
  chunk_overlap?: number;
  extract_tables?: boolean;
  ocr_enabled?: boolean;
}

export interface DocumentUploadResponse {
  document_id: string;
  filename: string;
  status: DocumentProcessingStatus;
  chunk_count: number;
  processing_time_ms: number;
}

export interface DocumentInfo {
  id: string;
  tenant_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  chunk_count: number;
  status: DocumentProcessingStatus;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentListResponse {
  documents: DocumentInfo[];
  total_count: number;
  limit: number;
  offset: number;
}

export interface DocumentListParams {
  limit?: number;
  offset?: number;
  status?: DocumentProcessingStatus;
  content_type?: string;
}

export interface DocumentDeleteResponse {
  document_id: string;
  status: "deleted";
  message: string;
}
