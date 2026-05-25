// Node.js client for the SDLC.ai JavaScript SDK

import { BaseClient } from "./base";
import { AuthClient } from "../auth";
import type { AuthClientConfig } from "../auth";
import type {
  SDLCConfig,
  Document,
  UploadProgress,
  RAGQuery,
  RAGQueryUpdate,
  LLMRequest,
  LLMResponse,
  TokenUsage,
} from "../types";
import { UsersService } from "../users";
import { TenantsService } from "../tenants";
import { DocumentsService } from "../documents";
import { RAGService } from "../rag";
import { VectorService } from "../vector";
import { PoliciesService } from "../policies";
import { LLMService } from "../llm";
import { MonitoringService } from "../monitoring";
import { WebSocketClient, type WebSocketClientHost } from "../websocket";

export interface NodeClientConfig extends SDLCConfig {
  // Node.js specific options
  keepAlive?: boolean;
  keepAliveMsecs?: number;
  maxSockets?: number;
  maxFreeSockets?: number;
  timeout?: number;
  freeSocketTimeout?: number;
  // File system options
  tempDir?: string;
  maxFileSize?: number;
  chunkSize?: number;
  // TLS options
  ca?: string | Buffer | string[] | Buffer[];
  cert?: string | Buffer;
  key?: string | Buffer;
  pfx?: string | Buffer;
  passphrase?: string;
  rejectUnauthorized?: boolean;
  // Proxy options
  proxy?: {
    host: string;
    port: number;
    protocol?: "http" | "https";
    auth?: {
      username: string;
      password: string;
    };
  };
}

export class NodeClient extends BaseClient {
  public auth: AuthClient;
  public users: UsersService;
  public tenants: TenantsService;
  public documents: DocumentsService;
  public rag: RAGService;
  public vector: VectorService;
  public policies: PoliciesService;
  public llm: LLMService;
  public monitoring: MonitoringService;
  public websocket: WebSocketClient;

  constructor(config: NodeClientConfig) {
    super(config);

    // Create auth client
    this.auth = new AuthClient(config as AuthClientConfig);

    // Create service clients
    this.users = new UsersService(this);
    this.tenants = new TenantsService(this);
    this.documents = new DocumentsService(this);
    this.rag = new RAGService(this);
    this.vector = new VectorService(this);
    this.policies = new PoliciesService(this);
    this.llm = new LLMService(this);
    this.monitoring = new MonitoringService(this);
    this.websocket = new WebSocketClient(this as unknown as WebSocketClientHost);

    // Setup Node.js specific configuration
    this.setupNodeConfig(config);
  }

  /**
   * Setup Node.js specific configuration
   */
  private setupNodeConfig(config: NodeClientConfig): void {
    // Configure HTTP agent for connection pooling
    const https = require("https");
    const http = require("http");
    const { HttpsProxyAgent } = require("https-proxy-agent");

    let agent: unknown;

    if (config.proxy) {
      // Setup proxy agent
      const proxyUrl = `${config.proxy.protocol || "http"}://${config.proxy.host}:${config.proxy.port}`;
      agent = new HttpsProxyAgent(proxyUrl, {
        auth: config.proxy.auth
          ? `${config.proxy.auth.username}:${config.proxy.auth.password}`
          : undefined,
        keepAlive: config.keepAlive ?? true,
        keepAliveMsecs: config.keepAliveMsecs ?? 1000,
        maxSockets: config.maxSockets ?? 50,
        maxFreeSockets: config.maxFreeSockets ?? 10,
        timeout: config.timeout ?? 60000,
        freeSocketTimeout: config.freeSocketTimeout ?? 15000,
      });
    } else {
      // Setup regular HTTPS agent
      agent = new https.Agent({
        keepAlive: config.keepAlive ?? true,
        keepAliveMsecs: config.keepAliveMsecs ?? 1000,
        maxSockets: config.maxSockets ?? 50,
        maxFreeSockets: config.maxFreeSockets ?? 10,
        timeout: config.timeout ?? 60000,
        freeSocketTimeout: config.freeSocketTimeout ?? 15000,
        ca: config.ca,
        cert: config.cert,
        key: config.key,
        pfx: config.pfx,
        passphrase: config.passphrase,
        rejectUnauthorized: config.rejectUnauthorized ?? true,
      });
    }

    // Apply agent to axios defaults
    this.httpClient.defaults.httpsAgent = agent;
    this.httpClient.defaults.httpAgent = new http.Agent({
      keepAlive: config.keepAlive ?? true,
      keepAliveMsecs: config.keepAliveMsecs ?? 1000,
      maxSockets: config.maxSockets ?? 50,
      maxFreeSockets: config.maxFreeSockets ?? 10,
      timeout: config.timeout ?? 60000,
      freeSocketTimeout: config.freeSocketTimeout ?? 15000,
    });
  }

  /**
   * Upload file from filesystem
   */
  public async uploadFileFromPath(
    filePath: string,
    options: {
      name?: string;
      metadata?: Record<string, unknown>;
      tags?: string[];
      chunkSize?: number;
      onProgress?: (progress: UploadProgress) => void;
      signal?: AbortSignal;
    } = {},
  ): Promise<Document> {
    const fs = require("fs").promises;
    const path = require("path");

    // Check if file exists
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new Error("Path is not a file");
    }

    // Check file size
    const nodeConfig = this.config as unknown as NodeClientConfig;
    const maxSize = nodeConfig.maxFileSize || 100 * 1024 * 1024; // 100MB default
    if (stats.size > maxSize) {
      throw new Error(
        `File size exceeds maximum allowed size of ${maxSize} bytes`,
      );
    }

    // Create readable stream
    const fileStream = fs.createReadStream(filePath);

    // Determine content type
    const ext = path.extname(filePath).toLowerCase();
    const contentType = this.getContentType(ext);

    // Create FormData
    const FormData = require("form-data");
    const formData = new FormData();

    formData.append("file", fileStream, {
      filename: options.name || path.basename(filePath),
      contentType,
    });

    // Add metadata
    if (options.metadata) {
      formData.append("metadata", JSON.stringify(options.metadata));
    }

    if (options.tags) {
      formData.append("tags", JSON.stringify(options.tags));
    }

    // Make request
    const response = await this.httpClient.post("/documents/upload", formData, {
      headers: formData.getHeaders(),
      onUploadProgress: options.onProgress
        ? (progressEvent) => {
            const total = progressEvent.total ?? 0;
            if (total > 0) {
              options.onProgress!({
                loaded: progressEvent.loaded,
                total,
                percentage: Math.round((progressEvent.loaded / total) * 100),
                speed: progressEvent.rate || 0,
                timeRemaining: progressEvent.estimated || 0,
              });
            }
          }
        : undefined,
      signal: options.signal,
    });

    return response.data;
  }

  /**
   * Download file to filesystem
   */
  public async downloadFileToFile(
    documentId: string,
    filePath: string,
    options: {
      onProgress?: (progress: {
        loaded: number;
        total: number;
        percentage: number;
      }) => void;
      signal?: AbortSignal;
    } = {},
  ): Promise<void> {
    const fs = require("fs").promises;
    const path = require("path");

    // Get download URL
    const response = await this.get<{ url: string }>(
      `/documents/${documentId}/download`,
    );
    const { url } = response.data;

    // Download file
    const downloadResponse = await this.httpClient.get(url, {
      responseType: "stream",
      onDownloadProgress: options.onProgress
        ? (progressEvent) => {
            const total = progressEvent.total ?? 0;
            if (total > 0) {
              options.onProgress!({
                loaded: progressEvent.loaded,
                total,
                percentage: Math.round((progressEvent.loaded / total) * 100),
              });
            }
          }
        : undefined,
      signal: options.signal,
    });

    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Write file
    const writer = fs.createWriteStream(filePath);
    downloadResponse.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
  }

  /**
   * Batch process documents
   */
  public async batchProcessDocuments(
    requests: Array<{
      filePath: string;
      name?: string;
      metadata?: Record<string, unknown>;
      tags?: string[];
    }>,
    options: {
      concurrency?: number;
      onProgress?: (completed: number, total: number) => void;
      signal?: AbortSignal;
    } = {},
  ): Promise<Document[]> {
    const concurrency = options.concurrency || 3;
    const results: Document[] = [];
    let completed = 0;

    // Process in batches
    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);

      const batchPromises = batch.map(async (request) => {
        const document = await this.uploadFileFromPath(request.filePath, {
          name: request.name,
          metadata: request.metadata,
          tags: request.tags,
          signal: options.signal,
        });

        completed++;
        if (options.onProgress) {
          options.onProgress(completed, requests.length);
        }

        return document;
      });

      const batchResults = await Promise.allSettled(batchPromises);

      // Handle failed uploads
      batchResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          console.error(
            `Failed to process ${batch[index]?.filePath}:`,
            result.reason,
          );
        }
      });
    }

    return results;
  }

  /**
   * Stream RAG query
   */
  public async *streamRAGQuery(
    query: RAGQuery,
  ): AsyncGenerator<RAGQueryUpdate, void, unknown> {
    const token = await this.auth.ensureValidToken();
    if (!token) {
      throw new Error("Authentication required");
    }

    yield* this.stream<RAGQueryUpdate>({
      url: "/rag/query",
      method: "POST",
      data: {
        ...query,
        streaming: true,
      },
      headers: {
        Authorization: `Bearer ${this.auth.getAccessToken()}`,
      },
    });
  }

  /**
   * Stream LLM completion
   */
  public async *streamLLMCompletion(
    request: LLMRequest,
  ): AsyncGenerator<LLMResponse, void, unknown> {
    const token = await this.auth.ensureValidToken();
    if (!token) {
      throw new Error("Authentication required");
    }

    yield* this.stream<LLMResponse>({
      url: "/llm/completions",
      method: "POST",
      data: {
        ...request,
        stream: true,
      },
      headers: {
        Authorization: `Bearer ${this.auth.getAccessToken()}`,
      },
    });
  }

  /**
   * Process embeddings for text
   */
  public async generateEmbeddings(
    texts: string[],
    options: {
      model?: string;
      batchSize?: number;
      onProgress?: (completed: number, total: number) => void;
    } = {},
  ): Promise<number[][]> {
    const model = options.model || "text-embedding-ada-002";
    const batchSize = options.batchSize || 100;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      const response = await this.post<{
        embeddings: number[][];
        usage: TokenUsage;
      }>("/embeddings", {
        model,
        input: batch,
      });

      allEmbeddings.push(...response.data.embeddings);

      if (options.onProgress) {
        const completed = Math.min(i + batchSize, texts.length);
        options.onProgress(completed, texts.length);
      }
    }

    return allEmbeddings;
  }

  /**
   * Get system information
   */
  public async getSystemInfo(): Promise<{
    platform: string;
    arch: string;
    nodeVersion: string;
    sdkVersion: string;
    memory: {
      total: number;
      free: number;
      used: number;
    };
    cpu: {
      model: string;
      cores: number;
    };
  }> {
    const os = require("os");
    const process = require("process");

    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      sdkVersion: require("../../package.json").version,
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
      },
      cpu: {
        model: os.cpus()[0].model,
        cores: os.cpus().length,
      },
    };
  }

  /**
   * Get content type based on file extension
   */
  private getContentType(ext: string): string {
    const contentTypes: Record<string, string> = {
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".xls": "application/vnd.ms-excel",
      ".xlsx":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".ppt": "application/vnd.ms-powerpoint",
      ".pptx":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ".txt": "text/plain",
      ".csv": "text/csv",
      ".json": "application/json",
      ".xml": "application/xml",
      ".html": "text/html",
      ".htm": "text/html",
      ".md": "text/markdown",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".bmp": "image/bmp",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".mp4": "video/mp4",
      ".avi": "video/x-msvideo",
      ".mov": "video/quicktime",
      ".zip": "application/zip",
      ".tar": "application/x-tar",
      ".gz": "application/gzip",
    };

    return contentTypes[ext] || "application/octet-stream";
  }

  /**
   * Create temporary directory for file operations
   */
  public async createTempDir(prefix: string = "sdlc-"): Promise<string> {
    const fs = require("fs").promises;
    const path = require("path");
    const os = require("os");

    const tempDir = path.join(
      os.tmpdir(),
      `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    );
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
  }

  /**
   * Cleanup temporary directory
   */
  public async cleanupTempDir(tempDir: string): Promise<void> {
    const fs = require("fs").promises;
    const path = require("path");

    try {
      const files = await fs.readdir(tempDir);
      await Promise.all(
        files.map((file: string) => fs.unlink(path.join(tempDir, file))),
      );
      await fs.rmdir(tempDir);
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Close client and cleanup resources
   */
  public override close(): void {
    this.auth.close();
    this.websocket.close();
    super.close();
  }
}
