// RAG client for the SDLC.ai JavaScript SDK
// Wraps BaseClient to provide typed access to RAG service endpoints

import type { BaseClient } from "../client/base";
import type { RAGQueryUpdate } from "../types";
import type {
  RAGQueryRequest,
  RAGQueryResponse,
  PipelineStatusResponse,
  PipelineCancelResponse,
  SearchRequest,
  SearchResponse,
  SearchResultItem,
  DocumentUploadMetadata,
  DocumentProcessingOptions,
  DocumentUploadResponse,
  DocumentInfo,
  DocumentListResponse,
  DocumentListParams,
  DocumentDeleteResponse,
} from "./types";

/**
 * RAGClient provides typed methods for all RAG service endpoints:
 * - RAG pipeline queries (sync and streaming)
 * - Document search
 * - Document upload, list, get, delete
 * - Pipeline status and cancellation
 */
export class RAGClient {
  constructor(private readonly client: BaseClient) {}

  // --- RAG Pipeline ---

  /** Execute a full RAG pipeline query. */
  async query(request: RAGQueryRequest): Promise<RAGQueryResponse> {
    const res = await this.client.post<RAGQueryResponse>(
      "/rag/query",
      request,
    );
    return res.data;
  }

  /**
   * Execute a RAG query with streaming (Server-Sent Events).
   * Falls back to a single-yield regular query when streaming
   * is not available on the client.
   */
  async *queryStream(
    request: RAGQueryRequest,
  ): AsyncGenerator<RAGQueryUpdate, void, unknown> {
    const streamable = this.client as {
      streamRAGQuery?: (q: RAGQueryRequest) => AsyncGenerator<RAGQueryUpdate>;
    };

    if (streamable.streamRAGQuery) {
      yield* streamable.streamRAGQuery(request);
      return;
    }

    // Fallback: execute regular query and yield a single completed event
    const result = await this.query(request);
    yield {
      queryId: result.pipeline_id,
      status: "completed",
      result: {
        answer: result.answer,
        sources: result.sources.map((s) => ({
          documentId: s.id,
          documentName: s.source,
          chunkId: s.id,
          content: s.text,
          score: s.confidence,
        })),
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        metadata: {
          queryId: result.pipeline_id,
          model: "unknown",
          processingTime: result.execution_time_ms,
          relevanceScore: result.confidence_score ?? 0,
        },
      },
    };
  }

  /** Get the status of a running pipeline. */
  async getPipelineStatus(pipelineId: string): Promise<PipelineStatusResponse> {
    const res = await this.client.get<PipelineStatusResponse>(
      `/rag/status/${pipelineId}`,
    );
    return res.data;
  }

  /** Cancel a running pipeline. */
  async cancelPipeline(pipelineId: string): Promise<PipelineCancelResponse> {
    const res = await this.client.delete<PipelineCancelResponse>(
      `/rag/cancel/${pipelineId}`,
    );
    return res.data;
  }

  // --- Search ---

  /** Search documents with advanced ranking and filtering. */
  async search(request: SearchRequest): Promise<SearchResponse> {
    const res = await this.client.post<SearchResponse>("/search", request);
    return res.data;
  }

  /**
   * Convenience: search by text with optional limit and min score.
   * Returns just the result items.
   */
  async searchText(
    query: string,
    opts?: { limit?: number; minScore?: number },
  ): Promise<SearchResultItem[]> {
    const response = await this.search({
      query,
      limit: opts?.limit,
      min_score: opts?.minScore,
    });
    return response.results;
  }

  /** Get autocomplete suggestions for a partial query. */
  async getSuggestions(
    query: string,
  ): Promise<{ suggestions: string[]; popular_queries?: Array<{ query: string; count: number }>; recent_searches?: string[] }> {
    const res = await this.client.get<{
      suggestions: string[];
      popular_queries?: Array<{ query: string; count: number }>;
      recent_searches?: string[];
    }>("/search/suggestions", { q: query });
    return res.data;
  }

  // --- Documents ---

  /** Upload a document for processing and embedding. */
  async uploadDocument(
    file: File | Blob,
    opts?: {
      metadata?: DocumentUploadMetadata;
      processingOptions?: DocumentProcessingOptions;
      onProgress?: (p: { loaded: number; total: number; percentage: number }) => void;
    },
  ): Promise<DocumentUploadResponse> {
    type UploadCapable = {
      uploadFile: <T>(
        url: string, file: File | Blob, options?: {
          field?: string;
          metadata?: Record<string, unknown>;
          onProgress?: (p: { loaded: number; total: number; percentage: number }) => void;
        },
      ) => Promise<{ data: T }>;
    };

    const uploader = this.client as unknown as UploadCapable;
    const metadata: Record<string, unknown> = {};
    if (opts?.metadata) metadata.metadata = JSON.stringify(opts.metadata);
    if (opts?.processingOptions) {
      metadata.processing_options = JSON.stringify(opts.processingOptions);
    }

    const res = await uploader.uploadFile<DocumentUploadResponse>(
      "/documents/upload",
      file,
      { field: "file", metadata, onProgress: opts?.onProgress },
    );
    return res.data;
  }

  /** List documents with optional filtering and pagination. */
  async listDocuments(
    params?: DocumentListParams,
  ): Promise<DocumentListResponse> {
    const res = await this.client.get<DocumentListResponse>(
      "/documents",
      params as Record<string, unknown>,
    );
    return res.data;
  }

  /** Get a single document by ID. */
  async getDocument(documentId: string): Promise<DocumentInfo> {
    const res = await this.client.get<DocumentInfo>(
      `/documents/${documentId}`,
    );
    return res.data;
  }

  /** Delete a document and its embeddings. */
  async deleteDocument(documentId: string): Promise<DocumentDeleteResponse> {
    const res = await this.client.delete<DocumentDeleteResponse>(
      `/documents/${documentId}`,
    );
    return res.data;
  }
}
