/**
 * API Mocking Service Types
 * Defines mock server, endpoint, scenario, and response types
 */

export interface MatchCondition {
  type: 'header' | 'query' | 'body' | 'path';
  key?: string;
  value: string;
  operator?: 'equals' | 'contains' | 'regex' | 'exists';
}

export interface MockResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: unknown;
  delay?: number;
}

export interface MockRule {
  id: string;
  conditions: MatchCondition[];
  response: MockResponse;
  priority: number;
}

export interface MockEndpoint {
  id: string;
  method: string;
  path: string;
  rules: MockRule[];
  defaultResponse: MockResponse;
  description?: string;
  stateful?: boolean;
  responseSequence?: MockResponse[];
  currentSequenceIndex?: number;
}

export interface MockServerConfig {
  projectId: string;
  port?: number;
  baseUrl?: string;
  enableLogging?: boolean;
  corsEnabled?: boolean;
}

export interface MockServer {
  id: string;
  projectId: string;
  baseUrl: string;
  port: number;
  endpoints: MockEndpoint[];
  isRunning: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockScenario {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  endpoints: MockEndpoint[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RequestMatchResult {
  matched: boolean;
  rule?: MockRule;
  matchedConditions: number;
}

export interface MockServerRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body?: unknown;
}
