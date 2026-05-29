import { InMemoryStore } from './inMemoryStore';
import { SqliteStore } from './sqliteStore';

const isTest = process.env.NODE_ENV === 'test';

export const store: InMemoryStore | SqliteStore = isTest
  ? new InMemoryStore()
  : new SqliteStore();
