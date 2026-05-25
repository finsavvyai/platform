import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import crypto from 'crypto';
import { EventEmitter } from 'events';

export interface APIEndpoint {
  id: string;
  userId: string;
  name: string;
  description?: string;
  baseUrl: string;
  version: string;
  authentication: {
    type: 'none' | 'basic' | 'bearer' | 'api_key' | 'oauth2' | 'custom';
    config: any;
  };
  headers: Record<string, string>;
  rateLimit?: {
    requests: number;
    window: number; // in seconds
    burst?: number;
  };
  timeout: number;
  retryConfig?: {
    attempts: number;
    delay: number;
    backoff: 'linear' | 'exponential';
  };
  healthCheck?: {
    endpoint: string;
    method: string;
    expectedStatus: number;
    interval: number; // in seconds
  };
  documentation?: {
    openApiSpec?: string;
    postmanCollection?: string;
    customDocs?: string;
  };
  tags: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface APICall {
  id: string;
  endpointId: string;
  method: string;
  path: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, any>;
  body?: any;
  expectedResponse?: {
    status?: number;
    schema?: any;
    headers?: Record<string, string>;
  };
  validation?: {
    rules: ValidationRule[];
    schema?: any;
  };
  transformation?: {
    request?: TransformationRule[];
    response?: TransformationRule[];
  };
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'type' | 'range' | 'regex' | 'custom';
  value: any;
  message?: string;
}

export interface TransformationRule {
  type: 'map' | 'filter' | 'aggregate' | 'custom';
  source: string;
  target: string;
  function?: string;
  parameters?: any;
}

export interface APIResponse {
  success: boolean;
  status: number;
  headers: Record<string, string>;
  data: any;
  responseTime: number;
  timestamp: Date;
  errors?: string[];
  validationResults?: ValidationResult[];
  transformedData?: any;
}

export interface ValidationResult {
  field: string;
  rule: string;
  passed: boolean;
  message?: string;
  actualValue?: any;
  expectedValue?: any;
}

export interface WebhookEndpoint {
  id: string;
  userId: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  headers: Record<string, string>;
  authentication?: {
    type: string;
    config: any;
  };
  retryPolicy: {
    attempts: number;
    delay: number;
    exponentialBackoff: boolean;
  };
  filters?: {
    conditions: FilterCondition[];
    operator: 'AND' | 'OR';
  };
  transformation?: TransformationRule[];
  isActive: boolean;
  lastTriggered?: Date;
  successCount: number;
  failureCount: number;
  createdAt: Date;
}

export interface FilterCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'contains' | 'startsWith' | 'endsWith';
  value: any;
}

export interface Integration {
  id: string;
  userId: string;
  name: string;
  type: 'webhook' | 'polling' | 'streaming' | 'batch';
  provider: string; // github, slack, jira, salesforce, etc.
  config: {
    endpoints: string[];
    authentication: any;
    schedule?: string; // for polling
    batchSize?: number; // for batch processing
    streamConfig?: any; // for streaming
  };
  dataMappings: DataMapping[];
  errorHandling: {
    retryPolicy: any;
    failureWebhook?: string;
    alertChannels: string[];
  };
  monitoring: {
    healthCheckInterval: number;
    performanceThresholds: any;
    alertConditions: any[];
  };
  isActive: boolean;
  lastSync?: Date;
  syncStats: {
    totalRecords: number;
    successfulRecords: number;
    failedRecords: number;
    lastError?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface DataMapping {
  sourceField: string;
  targetField: string;
  transformation?: string;
  defaultValue?: any;
  required: boolean;
}

export class APIManagementService extends EventEmitter {
  private rateLimiter = new Map<string, { count: number; resetTime: number }>();
  private healthCheckIntervals = new Map<string, NodeJS.Timeout>();
  private integrationJobs = new Map<string, NodeJS.Timeout>();

  constructor() {
    super();
    this.initializeHealthChecks();
  }

  // ==================== API Endpoint Management ====================

  async createAPIEndpoint(endpoint: Omit<APIEndpoint, 'id' | 'createdAt' | 'updatedAt'>): Promise<APIEndpoint> {
    const id = this.generateId();
    const now = new Date();

    const apiEndpoint: APIEndpoint = {
      ...endpoint,
      id,
      createdAt: now,
      updatedAt: now
    };

    // Store in database
    await this.storeAPIEndpoint(apiEndpoint);

    // Setup health check if configured
    if (apiEndpoint.healthCheck && apiEndpoint.isActive) {
      this.setupHealthCheck(apiEndpoint);
    }

    this.emit('api:endpoint:created', apiEndpoint);
    return apiEndpoint;
  }

  async updateAPIEndpoint(id: string, updates: Partial<APIEndpoint>): Promise<APIEndpoint> {
    const endpoint = await this.getAPIEndpoint(id);
    if (!endpoint) {
      throw new Error('API endpoint not found');
    }

    const updatedEndpoint = {
      ...endpoint,
      ...updates,
      updatedAt: new Date()
    };

    await this.updateAPIEndpointInDB(id, updatedEndpoint);

    // Update health check if needed
    if (updatedEndpoint.healthCheck && updatedEndpoint.isActive) {
      this.setupHealthCheck(updatedEndpoint);
    } else {
      this.removeHealthCheck(id);
    }

    this.emit('api:endpoint:updated', updatedEndpoint);
    return updatedEndpoint;
  }

  async testAPIConnection(endpointId: string): Promise<{ success: boolean; responseTime: number; error?: string }> {
    const endpoint = await this.getAPIEndpoint(endpointId);
    if (!endpoint) {
      throw new Error('API endpoint not found');
    }

    const startTime = performance.now();

    try {
      const testPath = endpoint.healthCheck?.endpoint || '/health';
      const response = await this.makeAPICall(endpoint, {
        id: 'test',
        endpointId,
        method: endpoint.healthCheck?.method || 'GET',
        path: testPath
      });

      const responseTime = performance.now() - startTime;

      this.emit('api:connection:tested', {
        endpointId,
        success: true,
        responseTime
      });

      return {
        success: response.success,
        responseTime,
        error: response.success ? undefined : 'Connection test failed'
      };
    } catch (error) {
      const responseTime = performance.now() - startTime;

      this.emit('api:connection:tested', {
        endpointId,
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async makeAPICall(endpoint: APIEndpoint, call: APICall): Promise<APIResponse> {
    const startTime = performance.now();

    try {
      // Check rate limits
      if (endpoint.rateLimit && !this.checkRateLimit(endpoint.id, endpoint.rateLimit)) {
        throw new Error('Rate limit exceeded');
      }

      // Prepare request configuration
      const config: AxiosRequestConfig = {
        method: call.method as any,
        url: `${endpoint.baseUrl}${call.path}`,
        headers: {
          ...endpoint.headers,
          ...call.headers
        },
        timeout: endpoint.timeout,
        params: call.queryParams
      };

      // Add authentication
      this.addAuthentication(config, endpoint.authentication);

      // Add request body
      if (call.body) {
        config.data = this.transformRequest(call.body, call.transformation?.request);
      }

      // Make the request with retry logic
      let response: AxiosResponse;
      let lastError: Error | null = null;

      const maxAttempts = endpoint.retryConfig?.attempts || 1;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          response = await axios(config);
          break;
        } catch (error) {
          lastError = error as Error;

          if (attempt < maxAttempts && this.isRetryableError(error)) {
            const delay = this.calculateRetryDelay(
              attempt,
              endpoint.retryConfig?.delay || 1000,
              endpoint.retryConfig?.backoff || 'linear'
            );
            await this.sleep(delay);
          } else {
            throw error;
          }
        }
      }

      const responseTime = performance.now() - startTime;

      // Process response
      let transformedData = response!.data;
      if (call.transformation?.response) {
        transformedData = this.transformResponse(response!.data, call.transformation.response);
      }

      // Validate response
      const validationResults = await this.validateResponse(response!, call.expectedResponse, call.validation);

      const apiResponse: APIResponse = {
        success: true,
        status: response!.status,
        headers: response!.headers as Record<string, string>,
        data: response!.data,
        responseTime,
        timestamp: new Date(),
        validationResults,
        transformedData
      };

      // Update rate limit counter
      if (endpoint.rateLimit) {
        this.updateRateLimit(endpoint.id, endpoint.rateLimit);
      }

      this.emit('api:call:success', {
        endpointId: endpoint.id,
        callId: call.id,
        responseTime,
        status: response!.status
      });

      return apiResponse;

    } catch (error) {
      const responseTime = performance.now() - startTime;

      this.emit('api:call:error', {
        endpointId: endpoint.id,
        callId: call.id,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        status: 0,
        headers: {},
        data: null,
        responseTime,
        timestamp: new Date(),
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  // ==================== Webhook Management ====================

  async createWebhook(webhook: Omit<WebhookEndpoint, 'id' | 'secret' | 'successCount' | 'failureCount' | 'createdAt'>): Promise<WebhookEndpoint> {
    const id = this.generateId();
    const secret = this.generateWebhookSecret();

    const webhookEndpoint: WebhookEndpoint = {
      ...webhook,
      id,
      secret,
      successCount: 0,
      failureCount: 0,
      createdAt: new Date()
    };

    await this.storeWebhook(webhookEndpoint);

    this.emit('webhook:created', webhookEndpoint);
    return webhookEndpoint;
  }

  async triggerWebhook(webhookId: string, event: string, payload: any): Promise<{ success: boolean; error?: string }> {
    const webhook = await this.getWebhook(webhookId);
    if (!webhook || !webhook.isActive) {
      return { success: false, error: 'Webhook not found or inactive' };
    }

    if (!webhook.events.includes(event)) {
      return { success: false, error: 'Event not subscribed' };
    }

    // Apply filters
    if (webhook.filters && !this.matchesFilters(payload, webhook.filters)) {
      return { success: false, error: 'Payload does not match filters' };
    }

    // Transform payload
    let transformedPayload = payload;
    if (webhook.transformation) {
      transformedPayload = this.transformWebhookPayload(payload, webhook.transformation);
    }

    // Create webhook payload
    const webhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data: transformedPayload,
      webhook_id: webhookId
    };

    // Generate signature
    const signature = this.generateWebhookSignature(webhookPayload, webhook.secret);

    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Event': event,
      'X-Webhook-Timestamp': webhookPayload.timestamp,
      ...webhook.headers
    };

    // Add authentication if configured
    if (webhook.authentication) {
      this.addWebhookAuthentication(headers, webhook.authentication);
    }

    // Send webhook with retry logic
    let success = false;
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= webhook.retryPolicy.attempts; attempt++) {
      try {
        const response = await axios.post(webhook.url, webhookPayload, {
          headers,
          timeout: 30000,
          validateStatus: (status) => status >= 200 && status < 300
        });

        success = true;

        // Update success count
        await this.updateWebhookStats(webhookId, { successCount: webhook.successCount + 1, lastTriggered: new Date() });

        this.emit('webhook:success', {
          webhookId,
          event,
          attempt,
          status: response.status
        });

        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';

        if (attempt < webhook.retryPolicy.attempts) {
          const delay = webhook.retryPolicy.exponentialBackoff
            ? webhook.retryPolicy.delay * Math.pow(2, attempt - 1)
            : webhook.retryPolicy.delay;

          await this.sleep(delay);
        }
      }
    }

    if (!success) {
      // Update failure count
      await this.updateWebhookStats(webhookId, { failureCount: webhook.failureCount + 1 });

      this.emit('webhook:failure', {
        webhookId,
        event,
        error: lastError
      });
    }

    return { success, error: lastError };
  }

  // ==================== Integration Management ====================

  async createIntegration(integration: Omit<Integration, 'id' | 'syncStats' | 'createdAt' | 'updatedAt'>): Promise<Integration> {
    const id = this.generateId();
    const now = new Date();

    const newIntegration: Integration = {
      ...integration,
      id,
      syncStats: {
        totalRecords: 0,
        successfulRecords: 0,
        failedRecords: 0
      },
      createdAt: now,
      updatedAt: now
    };

    await this.storeIntegration(newIntegration);

    // Setup integration job if active
    if (newIntegration.isActive) {
      this.setupIntegrationJob(newIntegration);
    }

    this.emit('integration:created', newIntegration);
    return newIntegration;
  }

  async syncIntegration(integrationId: string): Promise<{ success: boolean; recordsProcessed: number; errors: string[] }> {
    const integration = await this.getIntegration(integrationId);
    if (!integration) {
      throw new Error('Integration not found');
    }

    const startTime = new Date();
    let recordsProcessed = 0;
    let errors: string[] = [];

    try {
      this.emit('integration:sync:started', { integrationId });

      switch (integration.type) {
        case 'polling':
          const pollingResult = await this.handlePollingSync(integration);
          recordsProcessed = pollingResult.recordsProcessed;
          errors = pollingResult.errors;
          break;
        case 'batch':
          const batchResult = await this.handleBatchSync(integration);
          recordsProcessed = batchResult.recordsProcessed;
          errors = batchResult.errors;
          break;
        case 'streaming':
          const streamingResult = await this.handleStreamingSync(integration);
          recordsProcessed = streamingResult.recordsProcessed;
          errors = streamingResult.errors;
          break;
        default:
          throw new Error(`Unsupported integration type: ${integration.type}`);
      }

      // Update sync stats
      await this.updateIntegrationStats(integrationId, {
        totalRecords: integration.syncStats.totalRecords + recordsProcessed,
        successfulRecords: integration.syncStats.successfulRecords + (recordsProcessed - errors.length),
        failedRecords: integration.syncStats.failedRecords + errors.length
      });

      this.emit('integration:sync:completed', {
        integrationId,
        recordsProcessed,
        errors: errors.length,
        duration: Date.now() - startTime.getTime()
      });

      return {
        success: errors.length === 0,
        recordsProcessed,
        errors
      };

    } catch (error) {
      this.emit('integration:sync:failed', {
        integrationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        recordsProcessed,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  // ==================== Data Transformation ====================

  private transformRequest(data: any, rules?: TransformationRule[]): any {
    if (!rules || rules.length === 0) return data;

    let transformedData = { ...data };

    for (const rule of rules) {
      try {
        switch (rule.type) {
          case 'map':
            transformedData = this.applyMapping(transformedData, rule);
            break;
          case 'filter':
            transformedData = this.applyFilter(transformedData, rule);
            break;
          case 'aggregate':
            transformedData = this.applyAggregation(transformedData, rule);
            break;
          case 'custom':
            transformedData = this.applyCustomTransformation(transformedData, rule);
            break;
        }
      } catch (error) {
        console.error(`Transformation rule failed: ${rule.type}`, error);
      }
    }

    return transformedData;
  }

  private transformResponse(data: any, rules: TransformationRule[]): any {
    return this.transformRequest(data, rules);
  }

  private transformWebhookPayload(data: any, rules: TransformationRule[]): any {
    return this.transformRequest(data, rules);
  }

  // ==================== Validation ====================

  private async validateResponse(
    response: AxiosResponse,
    expectedResponse?: APICall['expectedResponse'],
    validation?: APICall['validation']
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Validate status code
    if (expectedResponse?.status && response.status !== expectedResponse.status) {
      results.push({
        field: 'status',
        rule: 'expectedStatus',
        passed: false,
        message: `Expected status ${expectedResponse.status}, got ${response.status}`,
        actualValue: response.status,
        expectedValue: expectedResponse.status
      });
    }

    // Validate headers
    if (expectedResponse?.headers) {
      for (const [key, expectedValue] of Object.entries(expectedResponse.headers)) {
        const actualValue = response.headers[key.toLowerCase()];
        const passed = actualValue === expectedValue;

        results.push({
          field: `headers.${key}`,
          rule: 'expectedHeader',
          passed,
          message: passed ? undefined : `Expected header ${key} to be ${expectedValue}, got ${actualValue}`,
          actualValue,
          expectedValue
        });
      }
    }

    // Validate response body
    if (validation?.rules) {
      for (const rule of validation.rules) {
        const result = this.validateField(response.data, rule);
        results.push(result);
      }
    }

    return results;
  }

  private validateField(data: any, rule: ValidationRule): ValidationResult {
    const fieldValue = this.getNestedValue(data, rule.field);
    let passed = false;
    let message: string | undefined;

    switch (rule.type) {
      case 'required':
        passed = fieldValue !== undefined && fieldValue !== null;
        message = passed ? undefined : `Field ${rule.field} is required`;
        break;

      case 'type':
        passed = typeof fieldValue === rule.value;
        message = passed ? undefined : `Field ${rule.field} should be of type ${rule.value}`;
        break;

      case 'range':
        if (typeof fieldValue === 'number') {
          passed = fieldValue >= rule.value.min && fieldValue <= rule.value.max;
          message = passed ? undefined : `Field ${rule.field} should be between ${rule.value.min} and ${rule.value.max}`;
        }
        break;

      case 'regex':
        if (typeof fieldValue === 'string') {
          const regex = new RegExp(rule.value);
          passed = regex.test(fieldValue);
          message = passed ? undefined : `Field ${rule.field} does not match pattern ${rule.value}`;
        }
        break;
    }

    return {
      field: rule.field,
      rule: rule.type,
      passed,
      message: message || rule.message,
      actualValue: fieldValue,
      expectedValue: rule.value
    };
  }

  // ==================== Helper Methods ====================

  private addAuthentication(config: AxiosRequestConfig, auth: APIEndpoint['authentication']): void {
    switch (auth.type) {
      case 'basic':
        config.auth = {
          username: auth.config.username,
          password: auth.config.password
        };
        break;

      case 'bearer':
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${auth.config.token}`
        };
        break;

      case 'api_key':
        if (auth.config.location === 'header') {
          config.headers = {
            ...config.headers,
            [auth.config.name]: auth.config.value
          };
        } else if (auth.config.location === 'query') {
          config.params = {
            ...config.params,
            [auth.config.name]: auth.config.value
          };
        }
        break;

      case 'oauth2':
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${auth.config.accessToken}`
        };
        break;
    }
  }

  private addWebhookAuthentication(headers: Record<string, string>, auth: any): void {
    switch (auth.type) {
      case 'bearer':
        headers['Authorization'] = `Bearer ${auth.config.token}`;
        break;
      case 'api_key':
        headers[auth.config.name] = auth.config.value;
        break;
    }
  }

  private checkRateLimit(endpointId: string, rateLimit: NonNullable<APIEndpoint['rateLimit']>): boolean {
    const now = Date.now();
    const limit = this.rateLimiter.get(endpointId);

    if (!limit || now > limit.resetTime) {
      this.rateLimiter.set(endpointId, {
        count: 1,
        resetTime: now + (rateLimit.window * 1000)
      });
      return true;
    }

    if (limit.count >= rateLimit.requests) {
      return false;
    }

    limit.count++;
    return true;
  }

  private updateRateLimit(endpointId: string, rateLimit: NonNullable<APIEndpoint['rateLimit']>): void {
    // Rate limit is updated in checkRateLimit
  }

  private isRetryableError(error: any): boolean {
    if (error.response) {
      // Retry on 5xx errors and some 4xx errors
      const status = error.response.status;
      return status >= 500 || status === 429 || status === 408;
    }
    // Retry on network errors
    return error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';
  }

  private calculateRetryDelay(attempt: number, baseDelay: number, backoff: string): number {
    switch (backoff) {
      case 'exponential':
        return baseDelay * Math.pow(2, attempt - 1);
      case 'linear':
      default:
        return baseDelay * attempt;
    }
  }

  private generateWebhookSignature(payload: any, secret: string): string {
    const data = JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  private matchesFilters(payload: any, filters: WebhookEndpoint['filters']): boolean {
    if (!filters || !filters.conditions.length) return true;

    const results = filters.conditions.map(condition => {
      const fieldValue = this.getNestedValue(payload, condition.field);
      return this.evaluateFilterCondition(fieldValue, condition.operator, condition.value);
    });

    return filters.operator === 'AND'
      ? results.every(r => r)
      : results.some(r => r);
  }

  private evaluateFilterCondition(actual: any, operator: FilterCondition['operator'], expected: any): boolean {
    switch (operator) {
      case 'eq': return actual === expected;
      case 'ne': return actual !== expected;
      case 'gt': return actual > expected;
      case 'lt': return actual < expected;
      case 'contains': return String(actual).includes(String(expected));
      case 'startsWith': return String(actual).startsWith(String(expected));
      case 'endsWith': return String(actual).endsWith(String(expected));
      default: return false;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private applyMapping(data: any, rule: TransformationRule): any {
    const value = this.getNestedValue(data, rule.source);
    this.setNestedValue(data, rule.target, value);
    return data;
  }

  private applyFilter(data: any, rule: TransformationRule): any {
    if (Array.isArray(data)) {
      return data.filter(item => {
        const value = this.getNestedValue(item, rule.source);
        return this.evaluateFilterCondition(value, 'eq', rule.parameters.value);
      });
    }
    return data;
  }

  private applyAggregation(data: any, rule: TransformationRule): any {
    if (Array.isArray(data)) {
      const values = data.map(item => this.getNestedValue(item, rule.source)).filter(v => v !== undefined);

      switch (rule.parameters.operation) {
        case 'sum': return values.reduce((sum, val) => sum + val, 0);
        case 'avg': return values.reduce((sum, val) => sum + val, 0) / values.length;
        case 'min': return Math.min(...values);
        case 'max': return Math.max(...values);
        case 'count': return values.length;
        default: return data;
      }
    }
    return data;
  }

  private applyCustomTransformation(data: any, rule: TransformationRule): any {
    try {
      // Execute custom transformation function
      if (rule.function) {
        const transformFn = new Function('data', 'parameters', rule.function);
        return transformFn(data, rule.parameters);
      }
    } catch (error) {
      console.error('Custom transformation failed:', error);
    }
    return data;
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateId(): string {
    return crypto.randomUUID();
  }

  private generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // ==================== Health Checks and Jobs ====================

  private initializeHealthChecks(): void {
    // Initialize health checks for existing endpoints
    this.loadActiveEndpoints().then(endpoints => {
      endpoints.forEach(endpoint => {
        if (endpoint.healthCheck && endpoint.isActive) {
          this.setupHealthCheck(endpoint);
        }
      });
    });
  }

  private setupHealthCheck(endpoint: APIEndpoint): void {
    if (!endpoint.healthCheck) return;

    this.removeHealthCheck(endpoint.id);

    const interval = setInterval(async () => {
      try {
        const result = await this.testAPIConnection(endpoint.id);
        this.emit('api:health:check', {
          endpointId: endpoint.id,
          success: result.success,
          responseTime: result.responseTime,
          error: result.error
        });
      } catch (error) {
        this.emit('api:health:check', {
          endpointId: endpoint.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, endpoint.healthCheck.interval * 1000);

    this.healthCheckIntervals.set(endpoint.id, interval);
  }

  private removeHealthCheck(endpointId: string): void {
    const interval = this.healthCheckIntervals.get(endpointId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(endpointId);
    }
  }

  private setupIntegrationJob(integration: Integration): void {
    if (integration.type !== 'polling' || !integration.config.schedule) return;

    this.removeIntegrationJob(integration.id);

    // Parse cron schedule and setup interval
    const interval = this.parseCronToInterval(integration.config.schedule);
    if (interval) {
      const job = setInterval(async () => {
        await this.syncIntegration(integration.id);
      }, interval);

      this.integrationJobs.set(integration.id, job);
    }
  }

  private removeIntegrationJob(integrationId: string): void {
    const job = this.integrationJobs.get(integrationId);
    if (job) {
      clearInterval(job);
      this.integrationJobs.delete(integrationId);
    }
  }

  private parseCronToInterval(cron: string): number | null {
    // Simple cron parser - extend as needed
    const parts = cron.split(' ');
    if (parts.length === 6) {
      // For demo purposes, return 5 minutes for any cron
      return 5 * 60 * 1000;
    }
    return null;
  }

  // ==================== Integration Sync Handlers ====================

  private async handlePollingSync(integration: Integration): Promise<{ recordsProcessed: number; errors: string[] }> {
    let recordsProcessed = 0;
    const errors: string[] = [];

    for (const endpointUrl of integration.config.endpoints) {
      try {
        const response = await axios.get(endpointUrl, {
          headers: integration.config.authentication?.headers || {},
          timeout: 30000
        });

        const records = Array.isArray(response.data) ? response.data : [response.data];

        for (const record of records) {
          try {
            const mappedRecord = this.applyDataMappings(record, integration.dataMappings);
            await this.processIntegrationRecord(integration.id, mappedRecord);
            recordsProcessed++;
          } catch (error) {
            errors.push(`Record processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      } catch (error) {
        errors.push(`Endpoint ${endpointUrl} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { recordsProcessed, errors };
  }

  private async handleBatchSync(integration: Integration): Promise<{ recordsProcessed: number; errors: string[] }> {
    // Implement batch processing logic
    return { recordsProcessed: 0, errors: [] };
  }

  private async handleStreamingSync(integration: Integration): Promise<{ recordsProcessed: number; errors: string[] }> {
    // Implement streaming logic
    return { recordsProcessed: 0, errors: [] };
  }

  private applyDataMappings(record: any, mappings: DataMapping[]): any {
    const mappedRecord: any = {};

    for (const mapping of mappings) {
      try {
        let value = this.getNestedValue(record, mapping.sourceField);

        if (value === undefined && mapping.defaultValue !== undefined) {
          value = mapping.defaultValue;
        }

        if (mapping.transformation) {
          value = this.applyMappingTransformation(value, mapping.transformation);
        }

        if (mapping.required && (value === undefined || value === null)) {
          throw new Error(`Required field ${mapping.targetField} is missing`);
        }

        this.setNestedValue(mappedRecord, mapping.targetField, value);
      } catch (error) {
        throw new Error(`Data mapping failed for ${mapping.sourceField} -> ${mapping.targetField}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return mappedRecord;
  }

  private applyMappingTransformation(value: any, transformation: string): any {
    try {
      // Simple transformations - extend as needed
      switch (transformation) {
        case 'uppercase':
          return typeof value === 'string' ? value.toUpperCase() : value;
        case 'lowercase':
          return typeof value === 'string' ? value.toLowerCase() : value;
        case 'trim':
          return typeof value === 'string' ? value.trim() : value;
        case 'number':
          return Number(value);
        case 'string':
          return String(value);
        case 'date':
          return new Date(value);
        default:
          return value;
      }
    } catch (error) {
      return value;
    }
  }

  // ==================== Database Operations (Placeholders) ====================

  private async storeAPIEndpoint(endpoint: APIEndpoint): Promise<void> {
    console.log('Storing API endpoint:', endpoint.name);
  }

  async getAPIEndpoint(id: string): Promise<APIEndpoint | null> {
    console.log('Getting API endpoint:', id);
    return null;
  }

  private async updateAPIEndpointInDB(id: string, endpoint: APIEndpoint): Promise<void> {
    console.log('Updating API endpoint:', id);
  }

  private async loadActiveEndpoints(): Promise<APIEndpoint[]> {
    console.log('Loading active endpoints');
    return [];
  }

  private async storeWebhook(webhook: WebhookEndpoint): Promise<void> {
    console.log('Storing webhook:', webhook.name);
  }

  async getWebhook(id: string): Promise<WebhookEndpoint | null> {
    console.log('Getting webhook:', id);
    return null;
  }

  private async updateWebhookStats(id: string, stats: Partial<WebhookEndpoint>): Promise<void> {
    console.log('Updating webhook stats:', id);
  }

  private async storeIntegration(integration: Integration): Promise<void> {
    console.log('Storing integration:', integration.name);
  }

  async getIntegration(id: string): Promise<Integration | null> {
    console.log('Getting integration:', id);
    return null;
  }

  private async updateIntegrationStats(id: string, stats: Partial<Integration['syncStats']>): Promise<void> {
    console.log('Updating integration stats:', id);
  }

  private async processIntegrationRecord(integrationId: string, record: any): Promise<void> {
    console.log('Processing integration record:', integrationId);
  }

  // ==================== Additional API Methods ====================

  async getAPIEndpoints(userId: string, filters?: any): Promise<APIEndpoint[]> {
    console.log('Getting API endpoints for user:', userId);
    return [];
  }

  async deleteAPIEndpoint(id: string): Promise<void> {
    this.removeHealthCheck(id);
    console.log('Deleting API endpoint:', id);
  }

  async getWebhooks(userId: string, filters?: any): Promise<WebhookEndpoint[]> {
    console.log('Getting webhooks for user:', userId);
    return [];
  }

  async getIntegrations(userId: string, filters?: any): Promise<Integration[]> {
    console.log('Getting integrations for user:', userId);
    return [];
  }

  async getAPITemplates(filters?: { category?: string; provider?: string }): Promise<any[]> {
    const templates = [
      {
        id: 'rest-basic',
        name: 'REST API - Basic',
        category: 'REST',
        provider: 'generic',
        description: 'Basic REST API template with CRUD operations',
        endpoints: [
          { method: 'GET', path: '/api/items', description: 'List all items' },
          { method: 'POST', path: '/api/items', description: 'Create new item' },
          { method: 'GET', path: '/api/items/{id}', description: 'Get item by ID' },
          { method: 'PUT', path: '/api/items/{id}', description: 'Update item' },
          { method: 'DELETE', path: '/api/items/{id}', description: 'Delete item' }
        ],
        authentication: { type: 'bearer', config: {} },
        headers: { 'Content-Type': 'application/json' }
      },
      {
        id: 'graphql-basic',
        name: 'GraphQL API',
        category: 'GraphQL',
        provider: 'generic',
        description: 'GraphQL API template with queries and mutations',
        endpoints: [
          { method: 'POST', path: '/graphql', description: 'GraphQL endpoint' }
        ],
        authentication: { type: 'bearer', config: {} },
        headers: { 'Content-Type': 'application/json' }
      },
      {
        id: 'github-api',
        name: 'GitHub API',
        category: 'Git',
        provider: 'github',
        description: 'GitHub REST API integration',
        baseUrl: 'https://api.github.com',
        endpoints: [
          { method: 'GET', path: '/user', description: 'Get authenticated user' },
          { method: 'GET', path: '/user/repos', description: 'List user repositories' },
          { method: 'GET', path: '/repos/{owner}/{repo}', description: 'Get repository' }
        ],
        authentication: { type: 'bearer', config: {} },
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      },
      {
        id: 'slack-api',
        name: 'Slack API',
        category: 'Communication',
        provider: 'slack',
        description: 'Slack Web API integration',
        baseUrl: 'https://slack.com/api',
        endpoints: [
          { method: 'POST', path: '/chat.postMessage', description: 'Send message' },
          { method: 'GET', path: '/conversations.list', description: 'List conversations' },
          { method: 'GET', path: '/users.list', description: 'List users' }
        ],
        authentication: { type: 'bearer', config: {} },
        headers: { 'Content-Type': 'application/json' }
      },
      {
        id: 'stripe-api',
        name: 'Stripe API',
        category: 'Payment',
        provider: 'stripe',
        description: 'Stripe payment API integration',
        baseUrl: 'https://api.stripe.com/v1',
        endpoints: [
          { method: 'POST', path: '/customers', description: 'Create customer' },
          { method: 'POST', path: '/payment_intents', description: 'Create payment intent' },
          { method: 'GET', path: '/customers/{id}', description: 'Retrieve customer' }
        ],
        authentication: { type: 'bearer', config: {} },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    ];

    if (filters?.category) {
      return templates.filter(t => t.category.toLowerCase() === filters.category.toLowerCase());
    }
    if (filters?.provider) {
      return templates.filter(t => t.provider.toLowerCase() === filters.provider.toLowerCase());
    }

    return templates;
  }

  async discoverAPI(url: string, type?: string): Promise<any> {
    try {
      const discoveredUrl = new URL(url);
      const discovery: any = {
        baseUrl: `${discoveredUrl.protocol}//${discoveredUrl.host}`,
        discoveredAt: new Date(),
        endpoints: [],
        authentication: { type: 'unknown' },
        documentation: {}
      };

      // Try to discover OpenAPI/Swagger spec
      const commonDocPaths = [
        '/swagger.json',
        '/api-docs',
        '/v1/swagger.json',
        '/docs/swagger.json',
        '/openapi.json',
        '/.well-known/openapi'
      ];

      for (const docPath of commonDocPaths) {
        try {
          const docUrl = `${discovery.baseUrl}${docPath}`;
          const response = await axios.get(docUrl, { timeout: 5000 });

          if (response.data && (response.data.swagger || response.data.openapi)) {
            discovery.documentation.openApiSpec = docUrl;
            discovery.documentation.specification = response.data;

            // Extract endpoints from OpenAPI spec
            if (response.data.paths) {
              discovery.endpoints = this.extractEndpointsFromOpenAPI(response.data);
            }
            break;
          }
        } catch {
          // Continue trying other paths
        }
      }

      // If no OpenAPI spec found, try basic discovery
      if (discovery.endpoints.length === 0) {
        discovery.endpoints = await this.discoverEndpointsBasic(discovery.baseUrl);
      }

      return discovery;
    } catch (error) {
      throw new Error(`API discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateAPIDocumentation(endpointId: string, format: string): Promise<any> {
    const endpoint = await this.getAPIEndpoint(endpointId);
    if (!endpoint) {
      throw new Error('API endpoint not found');
    }

    const documentation = {
      endpointId,
      format,
      generatedAt: new Date(),
      content: {}
    };

    switch (format) {
      case 'openapi':
        documentation.content = {
          openapi: '3.0.0',
          info: {
            title: endpoint.name,
            description: endpoint.description,
            version: endpoint.version
          },
          servers: [{ url: endpoint.baseUrl }],
          paths: {},
          components: {
            securitySchemes: this.convertAuthToOpenAPI(endpoint.authentication)
          }
        };
        break;

      case 'postman':
        documentation.content = {
          info: {
            name: endpoint.name,
            description: endpoint.description,
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
          },
          item: [],
          auth: this.convertAuthToPostman(endpoint.authentication),
          variable: [
            { key: 'baseUrl', value: endpoint.baseUrl }
          ]
        };
        break;

      case 'markdown':
        documentation.content = this.generateMarkdownDocs(endpoint);
        break;
    }

    return documentation;
  }

  async getAPIAnalytics(userId: string, options: {
    endpointId?: string;
    timeRange: string;
    metrics?: string[];
  }): Promise<any> {
    const analytics = {
      timeRange: options.timeRange,
      endpointId: options.endpointId,
      metrics: {
        totalRequests: 0,
        successRate: 0,
        averageResponseTime: 0,
        errorRate: 0,
        requestsPerDay: [],
        responseTimeOverTime: [],
        errorsByType: {},
        slowestEndpoints: [],
        mostUsedEndpoints: []
      },
      generatedAt: new Date()
    };

    // Placeholder implementation - would query actual analytics data
    console.log('Getting API analytics for user:', userId);
    return analytics;
  }

  async getAPIHealthStatus(userId: string): Promise<any> {
    const healthStatus = {
      overall: 'healthy',
      endpoints: [],
      summary: {
        total: 0,
        healthy: 0,
        degraded: 0,
        down: 0
      },
      lastChecked: new Date()
    };

    // Placeholder implementation - would check actual health status
    console.log('Getting API health status for user:', userId);
    return healthStatus;
  }

  private extractEndpointsFromOpenAPI(spec: any): any[] {
    const endpoints = [];

    if (spec.paths) {
      for (const [path, pathObj] of Object.entries(spec.paths as Record<string, any>)) {
        for (const [method, methodObj] of Object.entries(pathObj)) {
          if (['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) {
            endpoints.push({
              method: method.toUpperCase(),
              path,
              summary: (methodObj as any).summary || '',
              description: (methodObj as any).description || '',
              parameters: (methodObj as any).parameters || [],
              responses: (methodObj as any).responses || {}
            });
          }
        }
      }
    }

    return endpoints;
  }

  private async discoverEndpointsBasic(baseUrl: string): Promise<any[]> {
    // Basic endpoint discovery by trying common patterns
    const commonEndpoints = [
      { method: 'GET', path: '/health', description: 'Health check' },
      { method: 'GET', path: '/status', description: 'Status check' },
      { method: 'GET', path: '/api', description: 'API root' },
      { method: 'GET', path: '/v1', description: 'API v1 root' },
      { method: 'GET', path: '/docs', description: 'Documentation' }
    ];

    const discoveredEndpoints = [];

    for (const endpoint of commonEndpoints) {
      try {
        const response = await axios({
          method: endpoint.method,
          url: `${baseUrl}${endpoint.path}`,
          timeout: 3000,
          validateStatus: () => true // Accept any status code
        });

        if (response.status < 500) {
          discoveredEndpoints.push({
            ...endpoint,
            status: response.status,
            discovered: true
          });
        }
      } catch {
        // Endpoint not accessible
      }
    }

    return discoveredEndpoints;
  }

  private convertAuthToOpenAPI(auth: APIEndpoint['authentication']): any {
    switch (auth.type) {
      case 'bearer':
        return {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer'
          }
        };
      case 'api_key':
        return {
          ApiKeyAuth: {
            type: 'apiKey',
            in: auth.config.location === 'query' ? 'query' : 'header',
            name: auth.config.name
          }
        };
      case 'basic':
        return {
          BasicAuth: {
            type: 'http',
            scheme: 'basic'
          }
        };
      default:
        return {};
    }
  }

  private convertAuthToPostman(auth: APIEndpoint['authentication']): any {
    switch (auth.type) {
      case 'bearer':
        return {
          type: 'bearer',
          bearer: [
            { key: 'token', value: '{{bearerToken}}', type: 'string' }
          ]
        };
      case 'api_key':
        return {
          type: 'apikey',
          apikey: [
            { key: 'key', value: auth.config.name, type: 'string' },
            { key: 'value', value: '{{apiKey}}', type: 'string' },
            { key: 'in', value: auth.config.location, type: 'string' }
          ]
        };
      case 'basic':
        return {
          type: 'basic',
          basic: [
            { key: 'username', value: '{{username}}', type: 'string' },
            { key: 'password', value: '{{password}}', type: 'string' }
          ]
        };
      default:
        return { type: 'noauth' };
    }
  }

  private generateMarkdownDocs(endpoint: APIEndpoint): string {
    return `
# ${endpoint.name}

${endpoint.description || 'API endpoint documentation'}

## Base URL
\`${endpoint.baseUrl}\`

## Version
\`${endpoint.version}\`

## Authentication
Type: \`${endpoint.authentication.type}\`

## Headers
\`\`\`json
${JSON.stringify(endpoint.headers, null, 2)}
\`\`\`

## Rate Limiting
${endpoint.rateLimit ? `${endpoint.rateLimit.requests} requests per ${endpoint.rateLimit.window} seconds` : 'No rate limiting configured'}

## Health Check
${endpoint.healthCheck ? `Endpoint: \`${endpoint.healthCheck.endpoint}\` (checked every ${endpoint.healthCheck.interval}s)` : 'No health check configured'}

---
Generated on ${new Date().toISOString()}
    `.trim();
  }
}

export const apiManagementService = new APIManagementService();
