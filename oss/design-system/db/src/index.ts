// Schema
export {
  users,
  subscriptions,
  apiKeys,
  auditLog,
} from './schema/tables';
export type {
  User,
  NewUser,
  SubscriptionRow,
  NewSubscription,
  ApiKeyRow,
  NewApiKey,
  AuditLogRow,
  NewAuditLog,
} from './schema/tables';

// Relations
export {
  usersRelations,
  subscriptionsRelations,
  apiKeysRelations,
  auditLogRelations,
} from './schema/relations';

// Client
export { createPostgresClient } from './client/postgres';
export { createSqliteClient } from './client/sqlite';
export type { DatabaseClient } from './client/types';

// Repository
export type { Repository } from './repository/base';
export { UserRepository } from './repository/user';
export { SubscriptionRepository } from './repository/subscription';

// Seed
export { seedDatabase } from './seed';
