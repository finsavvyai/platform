export interface RepositoryOptions {
  limit?: number;
  offset?: number;
}

export interface Repository<T extends { id: string }> {
  findById(id: string): Promise<T | null>;
  findAll(opts?: RepositoryOptions): Promise<T[]>;
  create(data: Omit<T, 'id' | 'createdAt'>): Promise<T>;
  update(id: string, data: Partial<Omit<T, 'id'>>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
}
