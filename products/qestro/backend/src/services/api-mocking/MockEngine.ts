/**
 * Mock Engine - Dynamic API mock server
 * Handles endpoint creation, request routing, and conditional responses
 */

import { v4 as uuid } from 'uuid';
import {
  MockEndpoint,
  MockResponse,
  MockServer,
  MockServerConfig,
  MockServerRequest,
  RequestMatchResult,
  MatchCondition,
} from './types.js';
import { logger } from '../../utils/logger.js';

class MockEngine {
  private servers: Map<string, MockServer> = new Map();
  private requestLogs: Map<string, Array<{ url: string; timestamp: Date }>> = new Map();

  async createMockServer(projectId: string, config: MockServerConfig): Promise<MockServer> {
    const serverId = uuid();
    const baseUrl = config.baseUrl || `http://localhost:${config.port || 3001}`;
    const mockServer: MockServer = {
      id: serverId,
      projectId,
      baseUrl,
      port: config.port || 3001,
      endpoints: [],
      isRunning: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.servers.set(serverId, mockServer);
    this.requestLogs.set(serverId, []);
    logger.info(`Mock server created: ${serverId} at ${baseUrl}`);
    return mockServer;
  }

  async addEndpoint(serverId: string, endpoint: MockEndpoint): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) throw new Error(`Server not found: ${serverId}`);
    const endpointId = endpoint.id || uuid();
    const newEndpoint: MockEndpoint = {
      ...endpoint,
      id: endpointId,
      rules: (endpoint.rules || []).map((r) => ({ ...r, id: r.id || uuid() })),
    };
    server.endpoints.push(newEndpoint);
    server.updatedAt = new Date();
    logger.info(`Endpoint added: ${endpoint.method} ${endpoint.path}`);
  }

  async removeEndpoint(serverId: string, endpointId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) throw new Error(`Server not found: ${serverId}`);
    server.endpoints = server.endpoints.filter((e) => e.id !== endpointId);
    server.updatedAt = new Date();
    logger.info(`Endpoint removed: ${endpointId}`);
  }

  async handleRequest(serverId: string, method: string, path: string, body?: unknown): Promise<MockResponse> {
    const server = this.servers.get(serverId);
    if (!server) throw new Error(`Server not found: ${serverId}`);
    const logs = this.requestLogs.get(serverId) || [];
    logs.push({ url: `${method} ${path}`, timestamp: new Date() });
    if (logs.length > 1000) logs.shift();
    const endpoint = this.findMatchingEndpoint(server.endpoints, method, path);
    if (!endpoint) {
      logger.warn(`No endpoint matched: ${method} ${path}`);
      return { statusCode: 404, body: { error: 'Endpoint not found' } };
    }
    const request: MockServerRequest = {
      method,
      path,
      query: this.parseQueryString(path),
      headers: {},
      body,
    };
    const result = this.findMatchingRule(endpoint, request);
    const response = result.matched ? result.rule!.response : endpoint.defaultResponse;
    if (endpoint.stateful && endpoint.responseSequence && endpoint.responseSequence.length > 0) {
      const idx = (endpoint.currentSequenceIndex || 0) % endpoint.responseSequence.length;
      endpoint.currentSequenceIndex = idx + 1;
      return endpoint.responseSequence[idx];
    }
    if (response.delay) await this.sleep(response.delay);
    return response;
  }

  private findMatchingEndpoint(endpoints: MockEndpoint[], method: string, path: string): MockEndpoint | undefined {
    return endpoints.find((ep) => ep.method === method && this.pathMatches(ep.path, path));
  }

  private pathMatches(pattern: string, path: string): boolean {
    const patternRegex = new RegExp(`^${pattern.replace(/\*/g, '.*').replace(/\{[^}]+\}/g, '[^/]+')}$`);
    return patternRegex.test(path);
  }

  private findMatchingRule(endpoint: MockEndpoint, request: MockServerRequest): RequestMatchResult {
    if (!endpoint.rules || endpoint.rules.length === 0) return { matched: false, matchedConditions: 0 };
    const sorted = [...endpoint.rules].sort((a, b) => b.priority - a.priority);
    for (const rule of sorted) {
      if (rule.conditions.every((c) => this.evaluateCondition(c, request))) {
        return { matched: true, rule, matchedConditions: rule.conditions.length };
      }
    }
    return { matched: false, matchedConditions: 0 };
  }

  private evaluateCondition(condition: MatchCondition, request: MockServerRequest): boolean {
    const operator = condition.operator || 'equals';
    let value: string | undefined;
    if (condition.type === 'header') value = request.headers[condition.key || ''];
    else if (condition.type === 'query') value = request.query[condition.key || ''];
    else if (condition.type === 'body' && request.body && typeof request.body === 'object') {
      value = String((request.body as Record<string, unknown>)[condition.key || '']);
    } else if (condition.type === 'path') value = request.path;
    return this.compareValues(value, condition.value, operator);
  }

  private compareValues(actual: string | undefined, expected: string, operator: string): boolean {
    if (!actual) return operator === 'exists' ? false : false;
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'contains':
        return actual.includes(expected);
      case 'regex':
        try {
          return new RegExp(expected).test(actual);
        } catch {
          return false;
        }
      case 'exists':
        return actual !== undefined;
      default:
        return false;
    }
  }

  private parseQueryString(path: string): Record<string, string> {
    const [, queryString] = path.split('?');
    if (!queryString) return {};
    return Object.fromEntries(new URLSearchParams(queryString));
  }

  async getServer(serverId: string): Promise<MockServer | null> {
    return this.servers.get(serverId) || null;
  }

  async getRequestLogs(serverId: string): Promise<Array<{ url: string; timestamp: Date }>> {
    return this.requestLogs.get(serverId) || [];
  }

  async clearLogs(serverId: string): Promise<void> {
    this.requestLogs.set(serverId, []);
  }

  async deleteServer(serverId: string): Promise<void> {
    this.servers.delete(serverId);
    this.requestLogs.delete(serverId);
    logger.info(`Mock server deleted: ${serverId}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const mockEngine = new MockEngine();
