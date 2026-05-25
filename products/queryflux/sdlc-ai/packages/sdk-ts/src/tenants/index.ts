// Tenants service for the SDLC.ai JavaScript SDK

import { BaseClient } from "../client/base";
import {
  ApiResponse,
  PaginatedResponse,
  Tenant,
  CreateTenantRequest,
  SubscriptionLimits,
} from "../types";

export class TenantsService {
  constructor(private client: BaseClient) {}

  async list(): Promise<PaginatedResponse<Tenant>> {
    const response =
      await this.client.get<PaginatedResponse<Tenant>>("/tenants");
    return response.data;
  }

  async get(id: string): Promise<Tenant> {
    const response = await this.client.get<Tenant>(`/tenants/${id}`);
    return response.data;
  }

  async create(data: CreateTenantRequest): Promise<Tenant> {
    const response = await this.client.post<Tenant>("/tenants", data);
    return response.data;
  }

  async update(id: string, data: Partial<Tenant>): Promise<Tenant> {
    const response = await this.client.patch<Tenant>(`/tenants/${id}`, data);
    return response.data;
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(`/tenants/${id}`);
  }
}
