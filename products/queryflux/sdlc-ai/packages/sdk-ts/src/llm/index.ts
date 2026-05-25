// LLM service for the SDLC.ai JavaScript SDK

import { BaseClient } from "../client/base";
import { LLMRequest, LLMResponse, TokenUsage } from "../types";

export class LLMService {
  constructor(private client: BaseClient) {}

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.client.post<LLMResponse>("/llm/chat", request);
    return response.data;
  }

  async completion(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.client.post<LLMResponse>(
      "/llm/completions",
      request,
    );
    return response.data;
  }

  async *streamCompletion(
    request: LLMRequest,
  ): AsyncGenerator<LLMResponse, void, unknown> {
    if ((this.client as any).streamLLMCompletion) {
      yield* (this.client as any).streamLLMCompletion(request);
    } else {
      // Fallback to regular completion
      const result = await this.completion(request);
      yield result;
    }
  }

  async getModels(): Promise<
    Array<{ id: string; name: string; provider: string; maxTokens: number }>
  > {
    const response = await this.client.get("/llm/models");
    return response.data;
  }

  async getUsage(params?: {
    startDate?: string;
    endDate?: string;
    model?: string;
  }): Promise<{
    totalTokens: number;
    totalCost: number;
    requests: number;
    byModel: Array<{ model: string; tokens: number; cost: number }>;
  }> {
    const response = await this.client.get("/llm/usage", params);
    return response.data;
  }
}
