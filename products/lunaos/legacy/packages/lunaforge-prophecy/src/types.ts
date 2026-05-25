export interface ProphecyInput {
  /** Short natural language description of what the user wants */
  summary: string;
}

export interface ProphecyResult {
  /** AI-generated architectural guidance */
  blueprint: string;

  /** Optional list of proposed changes */
  suggestions?: string[];

  /** Raw model output */
  raw?: any;
}

export interface ProphecyAPI {
  generate(input: ProphecyInput): Promise<void>;
}

/**
 * Options passed when constructing the Prophecy client.
 * Usually this contains the worker URL and auth headers.
 */
export interface ProphecyClientOptions {
  baseUrl: string;
  apiKey?: string;
}