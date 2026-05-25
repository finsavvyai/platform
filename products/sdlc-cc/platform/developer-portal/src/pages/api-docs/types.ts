/**
 * API Documentation Page - Type Definitions
 */

export interface EndpointInfo {
  path: string;
  method: string;
  description: string;
  parameters: Parameter[];
  requestBody?: Record<string, unknown>;
  responses: ResponseInfo[];
  examples: Example[];
}

export interface Parameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: unknown;
  enum?: string[];
}

export interface ResponseInfo {
  code: number;
  description: string;
  schema?: Record<string, unknown>;
}

export interface Example {
  title: string;
  description: string;
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  language: string;
}

export interface PlaygroundState {
  endpoint: string;
  method: string;
  requestBody: string;
  headers: string;
  response: string;
  loading: boolean;
  error: string | null;
}

export type TabValue =
  | 'overview'
  | 'rag'
  | 'documents'
  | 'payments'
  | 'analytics'
  | 'playground';
