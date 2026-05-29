// Policies service for the SDLC.ai JavaScript SDK

import { BaseClient } from "../client/base";
import { Policy, PolicyTestRequest, PolicyTestResult } from "../types";

export class PoliciesService {
  constructor(private client: BaseClient) {}

  async list(): Promise<Policy[]> {
    const response = await this.client.get<Policy[]>("/policies");
    return response.data;
  }

  async get(id: string): Promise<Policy> {
    const response = await this.client.get<Policy>(`/policies/${id}`);
    return response.data;
  }

  async create(
    data: Omit<Policy, "id" | "createdAt" | "updatedAt" | "createdBy">,
  ): Promise<Policy> {
    const response = await this.client.post<Policy>("/policies", data);
    return response.data;
  }

  async update(id: string, data: Partial<Policy>): Promise<Policy> {
    const response = await this.client.patch<Policy>(`/policies/${id}`, data);
    return response.data;
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(`/policies/${id}`);
  }

  async test(request: PolicyTestRequest): Promise<PolicyTestResult[]> {
    const response = await this.client.post<PolicyTestResult[]>(
      `/policies/${request.policyId}/test`,
      request,
    );
    return response.data;
  }

  async deploy(id: string): Promise<void> {
    await this.client.post(`/policies/${id}/deploy`);
  }
}
