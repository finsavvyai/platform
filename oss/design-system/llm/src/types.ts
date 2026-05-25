export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: Message[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

export interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatResponse {
  content: string;
  model: string;
  provider: string;
  usage: UsageInfo;
  cost: number;
  latencyMs: number;
}

export interface StreamChunk {
  type: 'delta' | 'start' | 'end';
  content?: string;
  model?: string;
  provider?: string;
}

export interface CostEntry {
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  timestamp: string;
}

export interface ModelPricing {
  input: number;
  output: number;
}

export interface LLMConfig {
  providers: LLMProvider[];
  defaultModel?: string;
  timeout?: number;
  retryAttempts?: number;
  budgetLimit?: number;
}

export interface LLMProvider {
  name: string;
  chat(req: ChatRequest): Promise<ChatResponse>;
  stream(req: ChatRequest): AsyncIterable<StreamChunk>;
}

export interface LLMClientInterface {
  chat(req: ChatRequest): Promise<ChatResponse>;
  stream(req: ChatRequest): AsyncIterable<StreamChunk>;
  getCostTracker(): CostTracker;
}

export interface CostTracker {
  recordCost(entry: CostEntry): void;
  getTotalCost(): number;
  getEntriesByProvider(provider: string): CostEntry[];
  hasExceededBudget(): boolean;
  getBudgetLimit(): number;
}
