import { eq, and, limit, offset } from 'drizzle-orm';
import { Repository, RepositoryOptions } from './base';
import { DatabaseClient } from '../client/types';
import { pgTables } from '../schema/tables';

export interface Subscription {
  id: string;
  userId: string;
  plan: string;
  status: string;
  startDate: Date;
  endDate: Date | null;
  createdAt: Date;
}

export class SubscriptionRepository implements Repository<Subscription> {
  private db: DatabaseClient;
  private isPostgres: boolean;

  constructor(db: DatabaseClient) {
    this.db = db;
    this.isPostgres = db.config.type === 'postgres';
  }

  async findById(id: string): Promise<Subscription | null> {
    const tables = this.isPostgres ? pgTables : pgTables;
    const result = await this.db.db
      .select()
      .from(tables.subscriptions)
      .where(eq(tables.subscriptions.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findAll(opts?: RepositoryOptions): Promise<Subscription[]> {
    const tables = this.isPostgres ? pgTables : pgTables;
    let query = this.db.db.select().from(tables.subscriptions);

    if (opts?.limit !== undefined) {
      query = query.limit(opts.limit);
    }
    if (opts?.offset !== undefined) {
      query = query.offset(opts.offset);
    }

    return query;
  }

  async findByUserId(userId: string): Promise<Subscription[]> {
    const tables = this.isPostgres ? pgTables : pgTables;
    return this.db.db
      .select()
      .from(tables.subscriptions)
      .where(eq(tables.subscriptions.userId, userId));
  }

  async create(data: Omit<Subscription, 'id' | 'createdAt'>): Promise<Subscription> {
    const tables = this.isPostgres ? pgTables : pgTables;
    const result = await this.db.db
      .insert(tables.subscriptions)
      .values(data)
      .returning();

    return result[0];
  }

  async update(
    id: string,
    data: Partial<Omit<Subscription, 'id'>>
  ): Promise<Subscription | null> {
    const tables = this.isPostgres ? pgTables : pgTables;
    const result = await this.db.db
      .update(tables.subscriptions)
      .set(data)
      .where(eq(tables.subscriptions.id, id))
      .returning();

    return result[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const tables = this.isPostgres ? pgTables : pgTables;
    const result = await this.db.db
      .delete(tables.subscriptions)
      .where(eq(tables.subscriptions.id, id));

    return (result.rowCount ?? 0) > 0;
  }
}
