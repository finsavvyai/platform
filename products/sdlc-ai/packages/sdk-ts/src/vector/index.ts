// Vector service for the SDLC.ai JavaScript SDK

import { BaseClient } from "../client/base";
import { VectorSearchRequest, VectorSearchResult } from "../types";

export class VectorService {
  constructor(private client: BaseClient) {}

  async search(request: VectorSearchRequest): Promise<VectorSearchResult[]> {
    const response = await this.client.post<VectorSearchResult[]>(
      "/vector/search",
      request,
    );
    return response.data;
  }

  async createIndex(
    name: string,
    config: {
      dimensions: number;
      distance: "cosine" | "euclidean" | "dotproduct";
    },
  ): Promise<void> {
    await this.client.post("/vector/indexes", { name, ...config });
  }

  async deleteIndex(name: string): Promise<void> {
    await this.client.delete(`/vector/indexes/${name}`);
  }

  async listIndexes(): Promise<
    Array<{ name: string; dimensions: number; distance: string }>
  > {
    const response = await this.client.get("/vector/indexes");
    return response.data;
  }
}
