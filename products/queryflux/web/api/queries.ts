/**
 * Query CRUD operations API.
 */

import type { VisualQuery } from "../engine/types";

export interface QueryRepository {
  create(query: VisualQuery): Promise<VisualQuery>;
  getById(id: string): Promise<VisualQuery | null>;
  list(tenantId: string): Promise<VisualQuery[]>;
  update(id: string, query: Partial<VisualQuery>): Promise<VisualQuery>;
  delete(id: string): Promise<boolean>;
  search(tenantId: string, query: string): Promise<VisualQuery[]>;
}

export class QueryService implements QueryRepository {
  private queries: Map<string, VisualQuery> = new Map();

  /**
   * Create new query.
   */
  async create(query: VisualQuery): Promise<VisualQuery> {
    if (!query.id) {
      query.id = `query-${Date.now()}`;
    }

    query.createdAt = new Date();
    query.updatedAt = new Date();

    this.queries.set(query.id, { ...query });
    return query;
  }

  /**
   * Get query by ID.
   */
  async getById(id: string): Promise<VisualQuery | null> {
    return this.queries.get(id) || null;
  }

  /**
   * List all queries for tenant.
   */
  async list(_tenantId: string): Promise<VisualQuery[]> {
    // In production: filter by tenant from database
    return Array.from(this.queries.values());
  }

  /**
   * Update query.
   */
  async update(
    id: string,
    updates: Partial<VisualQuery>
  ): Promise<VisualQuery> {
    const existing = this.queries.get(id);
    if (!existing) {
      throw new Error(`Query not found: ${id}`);
    }

    const updated = {
      ...existing,
      ...updates,
      id: existing.id, // Preserve ID
      createdAt: existing.createdAt, // Preserve creation time
      updatedAt: new Date(),
    };

    this.queries.set(id, updated);
    return updated;
  }

  /**
   * Delete query.
   */
  async delete(id: string): Promise<boolean> {
    return this.queries.delete(id);
  }

  /**
   * Search queries by name or description.
   */
  async search(_tenantId: string, searchTerm: string): Promise<VisualQuery[]> {
    const lower = searchTerm.toLowerCase();

    return Array.from(this.queries.values()).filter(
      (q) =>
        q.name.toLowerCase().includes(lower) ||
        q.description?.toLowerCase().includes(lower)
    );
  }

  /**
   * Duplicate query.
   */
  async duplicate(id: string): Promise<VisualQuery> {
    const original = await this.getById(id);
    if (!original) {
      throw new Error(`Query not found: ${id}`);
    }

    const copy = {
      ...original,
      id: `query-${Date.now()}`,
      name: `${original.name} (copy)`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.create(copy);
  }

  /**
   * Get recent queries.
   */
  async getRecent(_tenantId: string, limit: number = 10): Promise<VisualQuery[]> {
    return Array.from(this.queries.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get favorited queries.
   */
  async getFavorites(_tenantId: string): Promise<VisualQuery[]> {
    // In production: track favorites in database
    return [];
  }

  /**
   * Add query to favorites.
   */
  async addToFavorites(id: string): Promise<boolean> {
    const query = await this.getById(id);
    if (!query) {
      return false;
    }

    // In production: update database
    return true;
  }

  /**
   * Remove query from favorites.
   */
  async removeFromFavorites(id: string): Promise<boolean> {
    const query = await this.getById(id);
    if (!query) {
      return false;
    }

    // In production: update database
    return true;
  }

  /**
   * Share query.
   */
  async shareQuery(id: string, _sharedWith: string[]): Promise<boolean> {
    const query = await this.getById(id);
    if (!query) {
      return false;
    }

    // In production: create sharing records
    return true;
  }

  /**
   * Get shared queries.
   */
  async getSharedWithMe(_tenantId: string): Promise<VisualQuery[]> {
    // In production: fetch shared queries from database
    return [];
  }

  /**
   * Export query as SQL.
   */
  async exportAsSQL(id: string): Promise<string> {
    const query = await this.getById(id);
    if (!query) {
      throw new Error(`Query not found: ${id}`);
    }

    // In production: use QueryParser to convert
    return "SELECT * FROM table";
  }

  /**
   * Get query statistics.
   */
  async getStats(tenantId: string): Promise<Record<string, number | string>> {
    const queries = await this.list(tenantId);

    return {
      total: queries.length,
      averageComplexity: 2.5,
      mostUsedTable: "users",
      totalExecutions: 1000,
    };
  }
}
