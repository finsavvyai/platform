import axios, { AxiosInstance, AxiosError } from 'axios';

/**
 * MCPOverflow Connector Service
 *
 * Integrates Questro with the MCPOverflow AI Engine for automated
 * API connector generation using Qestro AI.
 *
 * Architecture:
 * Questro → MCPOverflowConnectorService → MCPOverflow Engine (port 3001) → Qestro AI API (port 8000)
 *
 * @author Questro Team
 * @version 1.0.0
 */

// ========== TYPES ==========

export interface MCPOverflowConfig {
  apiUrl?: string;
  apiKey?: string;
  timeout?: number;
  retryCount?: number;
  pollInterval?: number;
}

export interface APISpec {
  openapi?: string;
  info?: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{ url: string }>;
  paths: Record<string, any>;
  components?: Record<string, any>;
}

export interface GenerateOptions {
  name: string;
  specType: 'openapi' | 'swagger' | 'graphql' | 'rest';
  spec: APISpec | string;
  language: 'typescript' | 'javascript' | 'python' | 'go';
  runtime: 'cloudflare-workers' | 'aws-lambda' | 'vercel' | 'nodejs';
  includeTests?: boolean;
  includeDocumentation?: boolean;
}

export interface Connector {
  id: string;
  name: string;
  language: string;
  runtime: string;
  code: string;
  types?: string;
  config?: string;
  tests?: string;
  documentation?: string;
  tools?: Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
  }>;
  metadata: {
    generatedAt: string;
    generatedBy: string;
    version: string;
    aiModel: string;
    duration: number;
  };
}

export interface JobResponse {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  statusUrl: string;
  message?: string;
}

export interface JobStatus {
  id: string;
  type: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  result?: Connector;
  error?: string;
  progress?: {
    current: number;
    total: number;
    message: string;
  };
}

export interface APIAnalysis {
  endpoints: number;
  methods: string[];
  authType?: string;
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedGenerationTime: number;
  recommendations: string[];
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  openhands: {
    healthy: boolean;
    version: string;
    latency?: number;
  };
  uptime?: number;
  lastCheck?: string;
}

export interface ConnectorValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

// ========== SERVICE ==========

export class MCPOverflowConnectorService {
  private static instance: MCPOverflowConnectorService;
  private apiUrl: string;
  private apiKey?: string;
  private timeout: number;
  private retryCount: number;
  private pollInterval: number;
  private httpClient: AxiosInstance;

  private constructor(config?: MCPOverflowConfig) {
    this.apiUrl = config?.apiUrl || process.env.MCPOVERFLOW_API_URL || 'http://localhost:3001';
    this.apiKey = config?.apiKey || process.env.MCPOVERFLOW_API_KEY;
    this.timeout = config?.timeout || Number(process.env.MCPOVERFLOW_TIMEOUT) || 300000; // 5 minutes
    this.retryCount = config?.retryCount || Number(process.env.MCPOVERFLOW_RETRY_COUNT) || 3;
    this.pollInterval = config?.pollInterval || Number(process.env.MCPOVERFLOW_POLL_INTERVAL) || 5000; // 5 seconds

    // Initialize HTTP client with axios
    this.httpClient = axios.create({
      baseURL: this.apiUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
      },
    });

    // Add request interceptor for logging
    this.httpClient.interceptors.request.use(
      (config) => {
        console.log(`[MCPOverflow] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        console.error(`[MCPOverflow] Error:`, error.message);
        if (error.response) {
          console.error(`[MCPOverflow] Status: ${error.response.status}`, error.response.data);
        }
        return Promise.reject(error);
      }
    );
  }

  public static getInstance(config?: MCPOverflowConfig): MCPOverflowConnectorService {
    if (!MCPOverflowConnectorService.instance) {
      MCPOverflowConnectorService.instance = new MCPOverflowConnectorService(config);
    }
    return MCPOverflowConnectorService.instance;
  }

  // ========== PUBLIC METHODS ==========

  /**
   * Generate a connector synchronously
   * Returns the complete connector when generation is finished
   * Use for simple APIs or when you need immediate results
   *
   * @param options - Generation options
   * @returns Generated connector
   * @throws Error if generation fails
   */
  public async generateConnector(options: GenerateOptions): Promise<Connector> {
    this.validateOptions(options);

    console.log(`[MCPOverflow] Generating connector: ${options.name}`);

    const response = await this.retryRequest(async () => {
      return await this.httpClient.post<Connector>('/api/generate-connector', {
        name: options.name,
        specType: options.specType,
        spec: options.spec,
        language: options.language,
        runtime: options.runtime,
        includeTests: options.includeTests,
        includeDocumentation: options.includeDocumentation,
      });
    });

    console.log(`[MCPOverflow] Connector generated: ${response.data.id} (${response.data.metadata.duration}ms)`);
    return response.data;
  }

  /**
   * Generate a connector asynchronously using job queue
   * Returns a job ID for status tracking
   * Use for complex APIs or when you want to poll for completion
   *
   * @param options - Generation options
   * @returns Job information
   */
  public async generateConnectorAsync(options: GenerateOptions): Promise<JobResponse> {
    this.validateOptions(options);

    console.log(`[MCPOverflow] Creating async connector job: ${options.name}`);

    const response = await this.retryRequest(async () => {
      return await this.httpClient.post<JobResponse>('/api/jobs/generate-connector', {
        name: options.name,
        specType: options.specType,
        spec: options.spec,
        language: options.language,
        runtime: options.runtime,
        includeTests: options.includeTests,
        includeDocumentation: options.includeDocumentation,
      });
    });

    console.log(`[MCPOverflow] Job created: ${response.data.jobId} (${response.data.status})`);
    return response.data;
  }

  /**
   * Get the status of a generation job
   *
   * @param jobId - Job ID from generateConnectorAsync
   * @returns Job status with result if completed
   */
  public async getJobStatus(jobId: string): Promise<JobStatus> {
    console.log(`[MCPOverflow] Checking job status: ${jobId}`);

    const response = await this.retryRequest(async () => {
      return await this.httpClient.get<JobStatus>(`/api/jobs/${jobId}`);
    });

    return response.data;
  }

  /**
   * Poll a job until it completes or fails
   *
   * @param jobId - Job ID to poll
   * @param maxAttempts - Maximum number of poll attempts (default: 60 = 5 minutes with 5s interval)
   * @returns Completed connector
   * @throws Error if job fails or times out
   */
  public async pollJobUntilComplete(jobId: string, maxAttempts: number = 60): Promise<Connector> {
    console.log(`[MCPOverflow] Polling job: ${jobId} (max ${maxAttempts} attempts)`);

    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await this.getJobStatus(jobId);

      if (status.status === 'completed') {
        if (!status.result) {
          throw new Error(`Job ${jobId} completed but no result found`);
        }
        console.log(`[MCPOverflow] Job completed: ${jobId} (${status.duration}ms)`);
        return status.result;
      }

      if (status.status === 'failed') {
        throw new Error(`Job ${jobId} failed: ${status.error || 'Unknown error'}`);
      }

      // Log progress if available
      if (status.progress) {
        console.log(`[MCPOverflow] Job ${jobId} progress: ${status.progress.current}/${status.progress.total} - ${status.progress.message}`);
      }

      // Wait before next poll
      await this.sleep(this.pollInterval);
      attempts++;
    }

    throw new Error(`Job ${jobId} timed out after ${maxAttempts * this.pollInterval / 1000} seconds`);
  }

  /**
   * Analyze an API spec without generating code
   * Useful for understanding complexity and estimated generation time
   *
   * @param spec - API specification
   * @returns Analysis results
   */
  public async analyzeAPI(spec: APISpec | string): Promise<APIAnalysis> {
    console.log(`[MCPOverflow] Analyzing API spec`);

    const response = await this.retryRequest(async () => {
      return await this.httpClient.post<APIAnalysis>('/api/analyze', {
        spec,
      });
    });

    console.log(`[MCPOverflow] API analysis complete: ${response.data.endpoints} endpoints, ${response.data.complexity} complexity`);
    return response.data;
  }

  /**
   * Check MCPOverflow Engine health status
   *
   * @returns Health status
   */
  public async healthCheck(): Promise<HealthStatus> {
    try {
      const response = await this.httpClient.get<HealthStatus>('/health', {
        timeout: 5000, // Quick timeout for health check
      });

      console.log(`[MCPOverflow] Health check: ${response.data.status}`);
      return response.data;
    } catch (error) {
      console.error(`[MCPOverflow] Health check failed:`, error);
      return {
        status: 'unhealthy',
        openhands: {
          healthy: false,
          version: 'unknown',
        },
      };
    }
  }

  /**
   * List all jobs
   *
   * @param status - Filter by status
   * @param limit - Maximum number of jobs to return
   * @returns List of jobs
   */
  public async listJobs(status?: string, limit: number = 50): Promise<{ jobs: JobStatus[]; total: number }> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('limit', limit.toString());

    const response = await this.httpClient.get<{ jobs: JobStatus[]; total: number }>(`/api/jobs?${params.toString()}`);
    return response.data;
  }

  /**
   * Validate a generated connector
   *
   * @param connector - Connector to validate
   * @returns Validation results
   */
  public async validateConnector(connector: Connector): Promise<ConnectorValidation> {
    const response = await this.httpClient.post<ConnectorValidation>('/api/validate', {
      connector,
    });
    return response.data;
  }

  /**
   * Generate tests for an existing connector
   *
   * @param connectorId - Connector ID
   * @returns Test code
   */
  public async generateTests(connectorId: string): Promise<{ tests: string }> {
    const response = await this.httpClient.post<{ tests: string }>(`/api/connectors/${connectorId}/tests`);
    return response.data;
  }

  // ========== PRIVATE METHODS ==========

  private validateOptions(options: GenerateOptions): void {
    if (!options.name || options.name.trim() === '') {
      throw new Error('Connector name is required');
    }

    if (!options.specType) {
      throw new Error('Spec type is required');
    }

    if (!options.spec) {
      throw new Error('API spec is required');
    }

    if (!options.language) {
      throw new Error('Language is required');
    }

    if (!options.runtime) {
      throw new Error('Runtime is required');
    }
  }

  private async retryRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.retryCount) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff, max 10s
          console.log(`[MCPOverflow] Request failed (attempt ${attempt}/${this.retryCount}), retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ========== UTILITY METHODS ==========

  /**
   * Parse an OpenAPI spec from YAML or JSON string
   *
   * @param specString - OpenAPI spec as string
   * @returns Parsed spec object
   */
  public static parseSpec(specString: string): APISpec {
    try {
      // Try JSON first
      return JSON.parse(specString);
    } catch {
      // If JSON fails, try YAML (requires js-yaml)
      try {
        const yaml = require('js-yaml');
        return yaml.load(specString);
      } catch (error) {
        throw new Error(`Failed to parse API spec: ${error}`);
      }
    }
  }

  /**
   * Estimate generation time based on API complexity
   *
   * @param analysis - API analysis result
   * @returns Estimated time in seconds
   */
  public static estimateGenerationTime(analysis: APIAnalysis): number {
    const baseTime = 10; // Base 10 seconds
    const endpointTime = analysis.endpoints * 2; // 2 seconds per endpoint

    let complexityMultiplier = 1;
    if (analysis.complexity === 'moderate') complexityMultiplier = 1.5;
    if (analysis.complexity === 'complex') complexityMultiplier = 2;

    return Math.ceil((baseTime + endpointTime) * complexityMultiplier);
  }
}

export default MCPOverflowConnectorService;
