import { eq, limit, offset } from 'drizzle-orm';
import { Repository, RepositoryOptions } from './base';
import { DatabaseClient } from '../client/types';
import { pgTables } from '../schema/tables';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
}

export class UserRepository implements Repository<User> {
  private db: DatabaseClient;
  private isPostgres: boolean;

  constructor(db: DatabaseClient) {
    this.db = db;
    this.isPostgres = db.config.type === 'postgres';
  }

  async findById(id: string): Promise<User | null> {
    const tables = this.isPostgres ? pgTables : pgTables;
    const result = await this.db.db
      .select()
      .from(tables.users)
      .where(eq(tables.users.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findAll(opts?: RepositoryOptions): Promise<User[]> {
    const tables = this.isPostgres ? pgTables : pgTables;
    let query = this.db.db.select().from(tables.users);

    if (opts?.limit !== undefined) {
      query = query.limit(opts.limit);
    }
    if (opts?.offset !== undefined) {
      query = query.offset(opts.offset);
    }

    return query;
  }

  async create(data: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const tables = this.isPostgres ? pgTables : pgTables;
    const result = await this.db.db
      .insert(tables.users)
      .values(data)
      .returning();

    return result[0];
  }

  async update(id: string, data: Partial<Omit<User, 'id'>>): Promise<User | null> {
    const tables = this.isPostgres ? pgTables : pgTables;
    const result = await this.db.db
      .update(tables.users)
      .set(data)
      .where(eq(tables.users.id, id))
      .returning();

    return result[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const tables = this.isPostgres ? pgTables : pgTables;
    const result = await this.db.db
      .delete(tables.users)
      .where(eq(tables.users.id, id));

    return (result.rowCount ?? 0) > 0;
  }
}
