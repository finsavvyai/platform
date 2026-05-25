// RAG service for the SDLC.ai JavaScript SDK

import { BaseClient } from "../client/base";
import { RAGQuery, RAGResponse, RAGQueryUpdate } from "../types";

export class RAGService {
  constructor(private client: BaseClient) {}

  async query(query: RAGQuery): Promise<RAGResponse> {
    const response = await this.client.post<RAGResponse>("/rag/query", query);
    return response.data;
  }

  async *streamQuery(
    query: RAGQuery,
  ): AsyncGenerator<RAGQueryUpdate, void, unknown> {
    if ((this.client as any).streamRAGQuery) {
      yield* (this.client as any).streamRAGQuery(query);
    } else {
      // Fallback to regular query
      const result = await this.query(query);
      yield {
        queryId: result.metadata.queryId,
        status: "completed",
        result,
      };
    }
  }

  async getContext(queryId: string): Promise<any> {
    const response = await this.client.get(`/rag/queries/${queryId}/context`);
    return response.data;
  }
}
