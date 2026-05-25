// Monitoring service for the SDLC.ai JavaScript SDK

import { BaseClient } from "../client/base";
import type { Metric, HealthCheck, LogEntry } from "../types";

export class MonitoringService {
  constructor(private client: BaseClient) {}

  async getMetrics(params?: {
    startDate?: string;
    endDate?: string;
    names?: string[];
    labels?: Record<string, string>;
  }): Promise<Metric[]> {
    const response = await this.client.get<Metric[]>(
      "/monitoring/metrics",
      params,
    );
    return response.data;
  }

  async healthCheck(): Promise<HealthCheck> {
    const response = await this.client.get<HealthCheck>("/health");
    return response.data;
  }

  async getLogs(params?: {
    startDate?: string;
    endDate?: string;
    level?: string;
    service?: string;
    limit?: number;
  }): Promise<LogEntry[]> {
    const response = await this.client.get<LogEntry[]>(
      "/monitoring/logs",
      params,
    );
    return response.data;
  }

  async createAlert(config: {
    name: string;
    condition: string;
    threshold: number;
    channels: string[];
  }): Promise<void> {
    await this.client.post("/monitoring/alerts", config);
  }

  async getAlerts(): Promise<
    Array<{
      id: string;
      name: string;
      status: "active" | "inactive" | "triggered";
      lastTriggered?: string;
    }>
  > {
    const response = await this.client.get<
      Array<{
        id: string;
        name: string;
        status: "active" | "inactive" | "triggered";
        lastTriggered?: string;
      }>
    >("/monitoring/alerts");
    return response.data;
  }
}
