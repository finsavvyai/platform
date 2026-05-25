// Main entry point for the SDLC.ai JavaScript SDK

export { BaseClient } from "./client/base";
export { NodeClient } from "./client/node";
export { BrowserClient } from "./client/browser";
export { AuthClient, type AuthClientConfig } from "./auth";

// Re-export types
export * from "./types";

// Re-export exceptions
export * from "./exceptions";

// Re-export utilities
export * from "./utils";

// Self-learning layer
export * from "./learning";

// Service modules
export { UsersService } from "./users";
export { TenantsService } from "./tenants";
export { DocumentsService } from "./documents";
export { RAGService } from "./rag";
export { VectorService } from "./vector";
export { PoliciesService } from "./policies";
export { LLMService } from "./llm";
export { MonitoringService } from "./monitoring";
export { WebSocketClient } from "./websocket";

import { NodeClient } from "./client/node";
import { BrowserClient } from "./client/browser";
import type { SDLCConfig } from "./types";
import { isNode, isBrowser } from "./utils";

/**
 * Create SDLC client instance
 * Automatically detects environment and returns appropriate client
 */
export function createClient(config: SDLCConfig): NodeClient | BrowserClient {
  if (isNode) {
    return new NodeClient(config);
  } else if (isBrowser) {
    return new BrowserClient(config);
  } else {
    throw new Error("Unsupported environment");
  }
}

/**
 * SDLC SDK class for backward compatibility
 */
export class SDLC {
  private client: NodeClient | BrowserClient;

  constructor(config: SDLCConfig) {
    this.client = createClient(config);
  }

  // Forward all client properties and methods
  get auth() {
    return this.client.auth;
  }

  get users() {
    return this.client.users;
  }

  get tenants() {
    return this.client.tenants;
  }

  get documents() {
    return this.client.documents;
  }

  get rag() {
    return this.client.rag;
  }

  get vector() {
    return this.client.vector;
  }

  get policies() {
    return this.client.policies;
  }

  get llm() {
    return this.client.llm;
  }

  get monitoring() {
    return this.client.monitoring;
  }

  get websocket() {
    return this.client.websocket;
  }

  on(event: string, listener: (...args: unknown[]) => void) {
    this.client.on(event, listener);
    return this;
  }

  off(event: string, listener: (...args: unknown[]) => void) {
    this.client.off(event, listener);
    return this;
  }

  close() {
    this.client.close();
  }
}

// Factory functions for specific environments
export function createNodeClient(config: SDLCConfig): NodeClient {
  return new NodeClient(config);
}

export function createBrowserClient(config: SDLCConfig): BrowserClient {
  return new BrowserClient(config);
}

// Export version
export const VERSION = "1.0.0";
