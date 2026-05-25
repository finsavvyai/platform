// Users service for the SDLC.ai JavaScript SDK

import { BaseClient } from '../client/base';
import type {
  PaginatedResponse,
  PaginationParams,
  User,
  CreateUserRequest,
  UpdateUserRequest,
  Role,
  Permission
} from '../types';

export class UsersService {
  constructor(private client: BaseClient) {}

  /**
   * Get all users with pagination
   */
  async list(params?: PaginationParams & {
    search?: string;
    roles?: string[];
    isActive?: boolean;
    tenantId?: string;
  }): Promise<PaginatedResponse<User>> {
    const response = await this.client.get<PaginatedResponse<User>>(
      '/users',
      params as Record<string, unknown> | undefined,
    );
    return response.data;
  }

  /**
   * Get user by ID
   */
  async get(id: string): Promise<User> {
    const response = await this.client.get<User>(`/users/${id}`);
    return response.data;
  }

  /**
   * Create new user
   */
  async create(data: CreateUserRequest): Promise<User> {
    const response = await this.client.post<User>('/users', data);
    return response.data;
  }

  /**
   * Update user
   */
  async update(id: string, data: UpdateUserRequest): Promise<User> {
    const response = await this.client.patch<User>(`/users/${id}`, data);
    return response.data;
  }

  /**
   * Delete user
   */
  async delete(id: string): Promise<void> {
    await this.client.delete(`/users/${id}`);
  }

  /**
   * Bulk operations
   */
  async bulkUpdate(users: Array<{ id: string; data: UpdateUserRequest }>): Promise<User[]> {
    const response = await this.client.post<User[]>('/users/bulk-update', { users });
    return response.data;
  }

  async bulkDelete(ids: string[]): Promise<void> {
    await this.client.post('/users/bulk-delete', { ids });
  }

  /**
   * User permissions and roles
   */
  async getRoles(userId: string): Promise<Role[]> {
    const response = await this.client.get<Role[]>(`/users/${userId}/roles`);
    return response.data;
  }

  async assignRole(userId: string, roleId: string): Promise<void> {
    await this.client.post(`/users/${userId}/roles/${roleId}`);
  }

  async removeRole(userId: string, roleId: string): Promise<void> {
    await this.client.delete(`/users/${userId}/roles/${roleId}`);
  }

  async getPermissions(userId: string): Promise<Permission[]> {
    const response = await this.client.get<Permission[]>(`/users/${userId}/permissions`);
    return response.data;
  }

  /**
   * User activity
   */
  async getActivity(userId: string, params?: PaginationParams & {
    startDate?: string;
    endDate?: string;
    action?: string;
  }): Promise<PaginatedResponse<unknown>> {
    const response = await this.client.get<PaginatedResponse<unknown>>(
      `/users/${userId}/activity`,
      params as Record<string, unknown> | undefined,
    );
    return response.data;
  }

  /**
   * Search users
   */
  async search(query: string, options?: {
    limit?: number;
    filters?: {
      tenantId?: string;
      roles?: string[];
      isActive?: boolean;
    };
  }): Promise<User[]> {
    const response = await this.client.post<User[]>('/users/search', {
      query,
      ...options
    });
    return response.data;
  }
}
