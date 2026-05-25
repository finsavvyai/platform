import * as vscode from "vscode";
import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import * as WebSocket from "ws";
import { Disposable } from "../utils/Disposable";
import { Logger } from "../utils/Logger";
import {
  APIResponse,
  Dependency,
  AnalysisResult,
  Vulnerability,
  SBOM,
  Project,
  Ecosystem,
  UPMConfiguration,
  PaginatedRequest,
  SearchParams,
} from "../types";

const log = Logger.createLogger("UPMService");

export class UPMService extends Disposable {
  private readonly config: UPMConfiguration;
  private httpClient: AxiosInstance;
  private wsConnection?: WebSocket;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private readonly baseUrl: string;

  constructor(private configurationManager: any) {
    super();

    this.config = {
      serverUrl: configurationManager.get<string>(
        "serverUrl",
        "http://localhost:8040",
      ),
      apiKey: configurationManager.get<string>("apiKey"),
      autoAnalysis: configurationManager.get<boolean>("autoAnalysis", true),
      realTimeUpdates: configurationManager.get<boolean>(
        "realTimeUpdates",
        true,
      ),
      highlighting: configurationManager.get<boolean>("highlighting", true),
      notificationLevel: configurationManager.get<string>(
        "notificationLevel",
        "warning",
      ),
      excludeScopes: configurationManager.get<string[]>("excludeScopes", [
        "test",
        "dev",
        "provided",
      ]),
      maxDependencies: configurationManager.get<number>(
        "maxDependencies",
        1000,
      ),
      timeout: configurationManager.get<number>("timeout", 30000),
    };

    this.baseUrl = this.config.serverUrl.replace(/\/$/, "");

    // Configure HTTP client
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: this.config.timeout,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    // Add request interceptor for authentication
    this.httpClient.interceptors.request.use(
      (config) => {
        if (this.config.apiKey) {
          config.headers.Authorization = `Bearer ${this.config.apiKey}`;
        }
        log.debug(
          `Making ${config.method?.toUpperCase()} request to ${config.url}`,
        );
        return config;
      },
      (error) => {
        log.error("Request interceptor error", error);
        return Promise.reject(error);
      },
    );

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => {
        log.debug(
          `Received response from ${response.config.url}: ${response.status}`,
        );
        return response;
      },
      (error) => {
        this.handleApiError(error);
        return Promise.reject(error);
      },
    );
  }

  public async initialize(): Promise<void> {
    try {
      log.info("Initializing UPM Service...");

      // Test connection to server
      await this.testConnection();

      log.info("UPM Service initialized successfully");
    } catch (error) {
      log.error("Failed to initialize UPM Service", error);
      throw error;
    }
  }

  private async testConnection(): Promise<boolean> {
    try {
      const response = await this.httpClient.get("/api/v1/health");
      if (response.status === 200) {
        log.info("Successfully connected to UPM server");
        this.isConnected = true;
        return true;
      }
      return false;
    } catch (error) {
      log.error("Failed to connect to UPM server", error);
      this.isConnected = false;
      throw error;
    }
  }

  private handleApiError(error: any): void {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.message;

      log.error(`API Error [${status}]: ${message}`, {
        url: error.config?.url,
        method: error.config?.method,
        status,
        response: error.response?.data,
      });

      // Show user notification for critical errors
      if (status === 401) {
        vscode.window
          .showErrorMessage(
            "UPM: Authentication failed. Please check your API key.",
            "Configure",
          )
          .then((selection) => {
            if (selection === "Configure") {
              vscode.commands.executeCommand(
                "workbench.action.openSettings",
                "upm.apiKey",
              );
            }
          });
      } else if (status === 403) {
        vscode.window.showErrorMessage(
          "UPM: Access denied. Please check your permissions.",
        );
      } else if (status >= 500) {
        vscode.window.showErrorMessage(
          `UPM: Server error (${status}). Please try again later.`,
        );
      }
    } else {
      log.error("Unexpected error", error);
    }
  }

  public async refreshDependencies(
    progress?: vscode.Progress<{ message?: string; increment?: number }>,
    token?: vscode.CancellationToken,
  ): Promise<Dependency[]> {
    try {
      log.info("Refreshing dependencies...");

      if (token?.isCancellationRequested) {
        throw new Error("Operation cancelled");
      }

      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        throw new Error("No workspace folders found");
      }

      const allDependencies: Dependency[] = [];

      for (let i = 0; i < workspaceFolders.length; i++) {
        const folder = workspaceFolders[i];

        if (progress) {
          progress.report({
            message: `Analyzing folder: ${folder.name}`,
            increment: (100 / workspaceFolders.length) * i,
          });
        }

        if (token?.isCancellationRequested) {
          throw new Error("Operation cancelled");
        }

        try {
          const response = await this.httpClient.post<
            APIResponse<Dependency[]>
          >("/api/v1/projects/analyze", {
            projectPath: folder.uri.fsPath,
            includeTransitive: true,
            excludeScopes: this.config.excludeScopes,
            maxDependencies: this.config.maxDependencies,
          });

          if (response.data.success && response.data.data) {
            allDependencies.push(...response.data.data);
          }
        } catch (error) {
          log.warn(`Failed to analyze folder: ${folder.name}`, error);
        }
      }

      log.info(`Refreshed ${allDependencies.length} dependencies`);
      return allDependencies;
    } catch (error) {
      log.error("Failed to refresh dependencies", error);
      throw error;
    }
  }

  public async analyzeProject(
    progress?: vscode.Progress<{ message?: string; increment?: number }>,
    token?: vscode.CancellationToken,
  ): Promise<AnalysisResult | null> {
    try {
      log.info("Analyzing project...");

      if (token?.isCancellationRequested) {
        throw new Error("Operation cancelled");
      }

      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error("No workspace folder found");
      }

      if (progress) {
        progress.report({
          message: "Extracting dependencies...",
          increment: 20,
        });
      }

      const response = await this.httpClient.post<APIResponse<AnalysisResult>>(
        "/api/v1/analysis/comprehensive",
        {
          projectPath: workspaceFolder.uri.fsPath,
          includeVulnerabilities: true,
          includePolicyViolations: true,
          includeRecommendations: true,
          excludeScopes: this.config.excludeScopes,
          maxDependencies: this.config.maxDependencies,
        },
      );

      if (response.data.success && response.data.data) {
        log.info("Project analysis completed");
        return response.data.data;
      }

      return null;
    } catch (error) {
      log.error("Failed to analyze project", error);
      throw error;
    }
  }

  public async checkVulnerabilities(
    progress?: vscode.Progress<{ message?: string; increment?: number }>,
    token?: vscode.CancellationToken,
  ): Promise<Vulnerability[]> {
    try {
      log.info("Checking for vulnerabilities...");

      if (token?.isCancellationRequested) {
        throw new Error("Operation cancelled");
      }

      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error("No workspace folder found");
      }

      if (progress) {
        progress.report({
          message: "Scanning for vulnerabilities...",
          increment: 50,
        });
      }

      const response = await this.httpClient.post<APIResponse<Vulnerability[]>>(
        "/api/v1/vulnerabilities/scan",
        {
          projectPath: workspaceFolder.uri.fsPath,
          severity: ["critical", "high", "medium", "low"],
          includeTransitive: true,
        },
      );

      if (response.data.success && response.data.data) {
        log.info(`Found ${response.data.data.length} vulnerabilities`);
        return response.data.data;
      }

      return [];
    } catch (error) {
      log.error("Failed to check vulnerabilities", error);
      throw error;
    }
  }

  public async generateSBOM(
    progress?: vscode.Progress<{ message?: string; increment?: number }>,
  ): Promise<SBOM | null> {
    try {
      log.info("Generating SBOM...");

      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error("No workspace folder found");
      }

      if (progress) {
        progress.report({ message: "Generating SBOM...", increment: 50 });
      }

      const response = await this.httpClient.post<APIResponse<SBOM>>(
        "/api/v1/sbom/generate",
        {
          projectPath: workspaceFolder.uri.fsPath,
          format: "cyclonedx",
          includeVulnerabilities: true,
          includeDependencies: true,
        },
      );

      if (response.data.success && response.data.data) {
        log.info("SBOM generated successfully");
        return response.data.data;
      }

      return null;
    } catch (error) {
      log.error("Failed to generate SBOM", error);
      throw error;
    }
  }

  public async exportReport(
    progress?: vscode.Progress<{ message?: string; increment?: number }>,
  ): Promise<any | null> {
    try {
      log.info("Exporting report...");

      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error("No workspace folder found");
      }

      if (progress) {
        progress.report({ message: "Exporting report...", increment: 50 });
      }

      const response = await this.httpClient.post<APIResponse<any>>(
        "/api/v1/reports/export",
        {
          projectPath: workspaceFolder.uri.fsPath,
          format: "json",
          include: {
            dependencies: true,
            vulnerabilities: true,
            policyViolations: true,
            recommendations: true,
            metrics: true,
          },
        },
      );

      if (response.data.success && response.data.data) {
        log.info("Report exported successfully");
        return response.data.data;
      }

      return null;
    } catch (error) {
      log.error("Failed to export report", error);
      throw error;
    }
  }

  public async getProjects(params?: PaginatedRequest): Promise<Project[]> {
    try {
      const response = await this.httpClient.get<APIResponse<Project[]>>(
        "/api/v1/projects",
        { params },
      );

      if (response.data.success && response.data.data) {
        return response.data.data;
      }

      return [];
    } catch (error) {
      log.error("Failed to get projects", error);
      throw error;
    }
  }

  public async searchDependencies(params: SearchParams): Promise<Dependency[]> {
    try {
      const response = await this.httpClient.get<APIResponse<Dependency[]>>(
        "/api/v1/dependencies/search",
        { params },
      );

      if (response.data.success && response.data.data) {
        return response.data.data;
      }

      return [];
    } catch (error) {
      log.error("Failed to search dependencies", error);
      throw error;
    }
  }

  public async getDependencyDetails(
    ecosystem: Ecosystem,
    name: string,
    version: string,
  ): Promise<Dependency | null> {
    try {
      const response = await this.httpClient.get<APIResponse<Dependency>>(
        `/api/v1/dependencies/${ecosystem}/${name}/${version}`,
      );

      if (response.data.success && response.data.data) {
        return response.data.data;
      }

      return null;
    } catch (error) {
      log.error("Failed to get dependency details", error);
      throw error;
    }
  }

  public async approveDependency(dependencyId: string): Promise<boolean> {
    try {
      const response = await this.httpClient.post<APIResponse>(
        `/api/v1/dependencies/${dependencyId}/approve`,
      );

      return response.data.success;
    } catch (error) {
      log.error("Failed to approve dependency", error);
      throw error;
    }
  }

  public async excludeDependency(
    dependencyId: string,
    reason?: string,
  ): Promise<boolean> {
    try {
      const response = await this.httpClient.post<APIResponse>(
        `/api/v1/dependencies/${dependencyId}/exclude`,
        { reason },
      );

      return response.data.success;
    } catch (error) {
      log.error("Failed to exclude dependency", error);
      throw error;
    }
  }

  public async updateDependency(
    dependencyId: string,
    targetVersion: string,
  ): Promise<boolean> {
    try {
      const response = await this.httpClient.put<APIResponse>(
        `/api/v1/dependencies/${dependencyId}`,
        { version: targetVersion },
      );

      return response.data.success;
    } catch (error) {
      log.error("Failed to update dependency", error);
      throw error;
    }
  }

  public getServerUrl(): string {
    return this.baseUrl;
  }

  public isServerConnected(): boolean {
    return this.isConnected;
  }

  public async dispose(): Promise<void> {
    log.info("Disposing UPM Service...");

    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = undefined;
    }

    await super.dispose();
    log.info("UPM Service disposed");
  }
}
