// Documents service for the SDLC.ai JavaScript SDK

import { BaseClient } from "../client/base";
import {
  Document,
  DocumentType,
  UploadOptions,
  UploadProgress,
  PaginatedResponse,
} from "../types";

export class DocumentsService {
  constructor(private client: BaseClient) {}

  async list(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    type?: DocumentType;
    tags?: string[];
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }): Promise<PaginatedResponse<Document>> {
    const response = await this.client.get<PaginatedResponse<Document>>(
      "/documents",
      params,
    );
    return response.data;
  }

  async get(id: string): Promise<Document> {
    const response = await this.client.get<Document>(`/documents/${id}`);
    return response.data;
  }

  async upload(file: File | Blob, options?: UploadOptions): Promise<Document> {
    if (file instanceof File && typeof window !== "undefined") {
      // Browser upload
      return (this.client as any).uploadFile(file, options);
    } else {
      // Node.js upload
      return (this.client as any).uploadFile(file, options);
    }
  }

  async update(
    id: string,
    data: {
      name?: string;
      metadata?: Record<string, any>;
      tags?: string[];
    },
  ): Promise<Document> {
    const response = await this.client.patch<Document>(
      `/documents/${id}`,
      data,
    );
    return response.data;
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(`/documents/${id}`);
  }

  async getContent(id: string): Promise<string> {
    const response = await this.client.get<string>(`/documents/${id}/content`);
    return response.data;
  }

  async downloadUrl(id: string): Promise<string> {
    const response = await this.client.get<{ url: string }>(
      `/documents/${id}/download`,
    );
    return response.data.url;
  }
}
