/**
 * SDLC.ai TypeScript SDK
 * Enterprise-grade TypeScript SDK for seamless integration with SDLC.ai platform
 *
 * Features:
 * 🚀 Full TypeScript support with strict typing
 * 🔐 Enterprise authentication (SSO, SAML, OAuth2)
 * 📊 Real-time streaming with WebSocket
 * 🧠 Multi-model AI integration
 * 📄 Document processing and RAG
 * 💳 PCI-compliant payment processing
 * 📈 Analytics and monitoring
 * 🔄 Promise-based API with async/await
 * 📦 Tree-shakeable bundle optimization
 */

export interface SDLCConfig {
  apiKey: string;
  baseURL?: string;
  environment?: 'development' | 'staging' | 'production';
  timeout?: number;
  maxRetries?: number;
  enableMetrics?: boolean;
  enableWebSockets?: boolean;
  verifySSL?: boolean;
  userAgent?: string;
}

export const DEFAULT_CONFIG: Partial<SDLCConfig> = {
  baseURL: 'https://api.sdlc.cc',
  environment: 'production',
  timeout: 30000,
  maxRetries: 3,
  enableMetrics: true,
  enableWebSockets: true,
  verifySSL: true,
  userAgent: `sdlc-typescript-sdk/${process.env.npm_package_version || '1.0.0'}`,
};

// Error Classes
export class SDLCError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'SDLCError';
  }
}

export class AuthenticationError extends SDLCError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends SDLCError {
  constructor(message: string) {
    super(message, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class RateLimitError extends SDLCError {
  constructor(message: string) {
    super(message, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends SDLCError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class ServiceUnavailableError extends SDLCError {
  constructor(message: string) {
    super(message, 'SERVICE_UNAVAILABLE');
    this.name = 'ServiceUnavailableError';
  }
}

// Authentication Interfaces
export interface AuthContext {
  userId: string;
  tenantId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  roles: string[];
  permissions: string[];
  metadata: Record<string, any>;
}

export interface APIKeyAuth {
  apiKey: string;
  tenantId: string;
}

// RAG Interfaces
export interface QueryRequest {
  query: string;
  context?: string[];
  maxResults?: number;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  includeCitations?: boolean;
  includeMetadata?: boolean;
  filters?: Record<string, any>;
}

export interface QueryResponse {
  queryId: string;
  response: string;
  confidence: number;
  citations: Citation[];
  tokenUsage: TokenUsage;
  responseTimeMs: number;
  metadata: Record<string, any>;
}

export interface Citation {
  documentId: string;
  documentName: string;
  chunkId: string;
  text: string;
  score: number;
  position: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// Document Interfaces
export interface DocumentUpload {
  filePath: string | File;
  name?: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  accessControl?: AccessControl;
}

export interface AccessControl {
  owner: string;
  permissions: Permission[];
  public?: boolean;
  shareLink?: string;
  expiresAt?: Date;
}

export interface Permission {
  subjectId: string;
  subjectType: 'user' | 'group' | 'role';
  actions: string[];
  grantedAt: Date;
  grantedBy: string;
  expiresAt?: Date;
}

export interface DocumentInfo {
  documentId: string;
  name: string;
  size: number;
  contentType: string;
  status: 'uploading' | 'processing' | 'processed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  metadata: Record<string, any>;
  vectorCount?: number;
  chunksCount?: number;
}

export interface DocumentListOptions {
  limit?: number;
  offset?: number;
  search?: string;
  tags?: string[];
  status?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'size';
  sortOrder?: 'asc' | 'desc';
}

// Payment Interfaces (PCI Compliant)
export interface PaymentMethod {
  tokenId: string;
  type: string;
  lastFour: string;
  expiryMonth: string;
  expiryYear: string;
  cardBrand?: string;
  cardType?: string;
  nickname?: string;
  isDefault: boolean;
  createdAt: Date;
}

export interface PaymentRequest {
  amountCents: number;
  currency: string;
  paymentMethodToken: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface PaymentResponse {
  paymentId: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  amountCents: number;
  currency: string;
  createdAt: Date;
  processedAt?: Date;
  metadata: Record<string, any>;
  failureReason?: string;
}

export interface RefundRequest {
  paymentId: string;
  amountCents?: number;
  reason?: string;
}

// Real-time Interfaces
export interface WebSocketMessage {
  type: string;
  data: unknown;
  timestamp: Date;
  id?: string;
}

export interface RealtimeEvent {
  type: string;
  data: unknown;
  userId?: string;
  tenantId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Analytics Interfaces
export interface UsageAnalytics {
  totalQueries: number;
  uniqueUsers: number;
  totalDocuments: number;
  totalTokens: number;
  averageResponseTime: number;
  timeSeriesData: TimeSeriesData[];
}

export interface TimeSeriesData {
  timestamp: Date;
  queries: number;
  users: number;
  tokens: number;
  documents: number;
  responseTime: number;
}

export interface AnalyticsOptions {
  startDate: Date;
  endDate: Date;
  granularity: 'hour' | 'day' | 'week' | 'month';
  metrics?: string[];
  filters?: Record<string, any>;
}

// Main Client Class
export class SDLCClient {
  private config: SDLCConfig;
  private authContext?: AuthContext;
  private ws?: WebSocket;
  private eventListeners: Map<string, ((data: unknown) => void)[]> = new Map();

  constructor(config: SDLCConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // HTTP Request Helper
  private async makeRequest<T = any>(
    method: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': this.config.userAgent,
      ...this.getAuthHeaders(),
      ...options.headers,
    };

    const response = await fetch(url, {
      method,
      headers,
      ...options,
    });

    if (response.status === 401) {
      throw new AuthenticationError('Authentication failed');
    }
    if (response.status === 403) {
      throw new AuthorizationError('Authorization failed');
    }
    if (response.status === 429) {
      throw new RateLimitError('Rate limit exceeded');
    }
    if (response.status >= 500) {
      throw new ServiceUnavailableError(`Service error: ${response.status}`);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new SDLCError(error.message || 'Request failed', response.status.toString(), error);
    }

    return response.json();
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.authContext) {
      headers['Authorization'] = `Bearer ${this.authContext.accessToken}`;
      headers['X-Tenant-ID'] = this.authContext.tenantId;
    }
    return headers;
  }

  // Authentication Methods
  async authenticate(apiKey: string, tenantId: string): Promise<AuthContext> {
    const response = await this.makeRequest<AuthContext>('/auth/api-key', {
      method: 'POST',
      body: JSON.stringify({ apiKey, tenantId }),
    });

    this.authContext = response;
    return response;
  }

  async refreshToken(): Promise<AuthContext> {
    if (!this.authContext?.refreshToken) {
      throw new AuthenticationError('No refresh token available');
    }

    const response = await this.makeRequest<AuthContext>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: this.authContext.refreshToken }),
    });

    this.authContext = response;
    return response;
  }

  getAuthContext(): AuthContext | undefined {
    return this.authContext;
  }

  // RAG Methods
  async query(request: QueryRequest): Promise<QueryResponse> {
    this.ensureAuthenticated();
    return this.makeRequest<QueryResponse>('/rag/query', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async *queryStream(request: QueryRequest): AsyncGenerator<string> {
    this.ensureAuthenticated();

    const response = await fetch(`${this.config.baseURL}/rag/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify({ ...request, stream: true }),
    });

    if (!response.ok) {
      throw new SDLCError('Stream request failed');
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new SDLCError('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.type === 'token') {
                yield data.content || '';
              } else if (data.type === 'done') {
                return;
              }
            } catch {
              continue;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // Document Methods
  async uploadDocument(document: DocumentUpload): Promise<DocumentInfo> {
    this.ensureAuthenticated();

    const formData = new FormData();

    if (typeof document.filePath === 'string') {
      const file = await fetch(document.filePath).then(r => r.blob());
      formData.append('file', file, document.name || 'document');
    } else {
      formData.append('file', document.filePath);
    }

    if (document.name) formData.append('name', document.name);
    if (document.description) formData.append('description', document.description);
    if (document.tags) formData.append('tags', JSON.stringify(document.tags));
    if (document.metadata) formData.append('metadata', JSON.stringify(document.metadata));
    if (document.accessControl) formData.append('accessControl', JSON.stringify(document.accessControl));

    const response = await fetch(`${this.config.baseURL}/documents/upload`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new SDLCError(error.message || 'Upload failed', response.status.toString(), error);
    }

    return response.json();
  }

  async getDocument(documentId: string): Promise<DocumentInfo> {
    return this.makeRequest<DocumentInfo>(`/documents/${documentId}`);
  }

  async listDocuments(options: DocumentListOptions = {}): Promise<DocumentInfo[]> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.offset) params.set('offset', options.offset.toString());
    if (options.search) params.set('search', options.search);
    if (options.tags) params.set('tags', options.tags.join(','));
    if (options.status) params.set('status', options.status);
    if (options.sortBy) params.set('sortBy', options.sortBy);
    if (options.sortOrder) params.set('sortOrder', options.sortOrder);

    const response = await this.makeRequest<{ documents: DocumentInfo[] }>(
      `/documents?${params.toString()}`
    );
    return response.documents;
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.makeRequest(`/documents/${documentId}`, { method: 'DELETE' });
  }

  // Payment Methods
  async addPaymentMethod(
    paymentMethodToken: string,
    nickname?: string,
    makeDefault = false
  ): Promise<PaymentMethod> {
    return this.makeRequest<PaymentMethod>('/payments/methods', {
      method: 'POST',
      body: JSON.stringify({
        token: paymentMethodToken,
        nickname,
        default: makeDefault,
      }),
    });
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    return this.makeRequest<PaymentResponse>('/payments/process', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async refundPayment(request: RefundRequest): Promise<PaymentResponse> {
    return this.makeRequest<PaymentResponse>('/payments/refund', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Real-time WebSocket Methods
  async connectWebSocket(): Promise<void> {
    this.ensureAuthenticated();

    const wsURL = this.config.baseURL?.replace('http', 'ws') + '/realtime';
    this.ws = new WebSocket(wsURL);

    return new Promise((resolve, reject) => {
      if (!this.ws) return reject(new Error('WebSocket not initialized'));

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        resolve();
      };

      this.ws.onerror = (error) => {
        reject(error);
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        setTimeout(() => this.connectWebSocket(), 5000); // Auto-reconnect
      };
    });
  }

  disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
  }

  on(event: string, callback: (data: unknown) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: (data: unknown) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private handleWebSocketMessage(message: WebSocketMessage): void {
    const listeners = this.eventListeners.get(message.type);
    if (listeners) {
      listeners.forEach(callback => callback(message.data));
    }
  }

  // Analytics Methods
  async getUsageAnalytics(options: AnalyticsOptions): Promise<UsageAnalytics> {
    const params = new URLSearchParams();
    params.set('startDate', options.startDate.toISOString());
    params.set('endDate', options.endDate.toISOString());
    params.set('granularity', options.granularity);
    if (options.metrics) params.set('metrics', options.metrics.join(','));
    if (options.filters) params.set('filters', JSON.stringify(options.filters));

    return this.makeRequest<UsageAnalytics>(`/analytics/usage?${params.toString()}`);
  }

  // Utility Methods
  async healthCheck(): Promise<{ status: string; services: Record<string, string> }> {
    return this.makeRequest('/health');
  }

  async getVersion(): Promise<string> {
    const response = await this.makeRequest<{ version: string }>('/version');
    return response.version;
  }

  private ensureAuthenticated(): void {
    if (!this.authContext) {
      throw new AuthenticationError('Not authenticated. Call authenticate() first.');
    }
  }

  // Clean up
  close(): void {
    this.disconnectWebSocket();
    this.eventListeners.clear();
  }
}

// Factory Functions
export async function createClient(
  apiKey: string,
  tenantId: string,
  config: Partial<SDLCConfig> = {}
): Promise<SDLCClient> {
  const client = new SDLCClient({ apiKey, ...config });
  await client.authenticate(apiKey, tenantId);
  return client;
}

// Example Usage
/*
import { createClient, QueryRequest } from '@sdlc-ai/sdk';

async function main() {
  const client = await createClient('your-api-key', 'your-tenant-id');

  try {
    // RAG Query
    const query: QueryRequest = {
      query: 'What are the best practices for secure software development?',
      maxResults: 5,
      includeCitations: true,
    };

    const response = await client.query(query);
    console.log('Response:', response.response);
    console.log('Confidence:', response.confidence);

    // Streaming Query
    for await (const token of client.queryStream(query)) {
      process.stdout.write(token);
    }

    // Document Upload
    const document = await client.uploadDocument({
      filePath: './security-guide.pdf',
      name: 'Security Best Practices',
      tags: ['security', 'development'],
      metadata: { department: 'engineering' }
    });

    // Real-time Events
    client.on('query_completed', (data) => {
      console.log('Query completed:', data);
    });

    await client.connectWebSocket();

  } finally {
    client.close();
  }
}

main().catch(console.error);
*/
