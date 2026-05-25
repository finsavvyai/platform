import { DatabaseClient } from './client/types';
import { pgTables } from './schema/tables';
import { UserRepository } from './repository/user';
import { SubscriptionRepository } from './repository/subscription';

export async function seedDatabase(db: DatabaseClient): Promise<void> {
  const isPostgres = db.config.type === 'postgres';
  const tables = isPostgres ? pgTables : pgTables;

  const users = [
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      email: 'alice@example.com',
      name: 'Alice Johnson',
      role: 'user',
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      email: 'bob@example.com',
      name: 'Bob Smith',
      role: 'admin',
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      email: 'charlie@example.com',
      name: 'Charlie Brown',
      role: 'user',
    },
  ];

  const subscriptions = [
    {
      id: '650e8400-e29b-41d4-a716-446655440001',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      plan: 'pro',
      status: 'active',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2025-01-01'),
    },
    {
      id: '650e8400-e29b-41d4-a716-446655440002',
      userId: '550e8400-e29b-41d4-a716-446655440002',
      plan: 'enterprise',
      status: 'active',
      startDate: new Date('2023-06-01'),
      endDate: null,
    },
  ];

  const apiKeys = [
    {
      id: '750e8400-e29b-41d4-a716-446655440001',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      key: 'sk_test_alice_123456',
      name: 'Development Key',
    },
    {
      id: '750e8400-e29b-41d4-a716-446655440002',
      userId: '550e8400-e29b-41d4-a716-446655440002',
      key: 'sk_test_bob_789012',
      name: 'Production Key',
    },
  ];

  // Insert users
  await db.db.insert(tables.users).values(users).onConflictDoNothing();

  // Insert subscriptions
  await db.db.insert(tables.subscriptions).values(subscriptions).onConflictDoNothing();

  // Insert API keys
  await db.db.insert(tables.apiKeys).values(apiKeys).onConflictDoNothing();
}
