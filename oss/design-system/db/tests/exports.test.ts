import { describe, it, expect } from 'vitest';

describe('Package Exports', () => {
  it('should export table definitions', async () => {
    const mod = await import('../src/schema/tables');
    expect(mod.users).toBeDefined();
    expect(mod.subscriptions).toBeDefined();
    expect(mod.apiKeys).toBeDefined();
    expect(mod.auditLog).toBeDefined();
    expect(mod.pgTables).toBeDefined();
  });

  it('should export relations', async () => {
    const mod = await import('../src/schema/relations');
    expect(mod.usersRelations).toBeDefined();
    expect(mod.subscriptionsRelations).toBeDefined();
    expect(mod.apiKeysRelations).toBeDefined();
    expect(mod.auditLogRelations).toBeDefined();
  });

  it('should export createPostgresClient', async () => {
    const mod = await import('../src/client/postgres');
    expect(mod.createPostgresClient).toBeDefined();
  });

  it('should export UserRepository', async () => {
    const mod = await import('../src/repository/user');
    expect(mod.UserRepository).toBeDefined();
  });

  it('should export SubscriptionRepository', async () => {
    const mod = await import('../src/repository/subscription');
    expect(mod.SubscriptionRepository).toBeDefined();
  });

  it('should export seedDatabase function', async () => {
    const mod = await import('../src/seed');
    expect(mod.seedDatabase).toBeDefined();
  });

  it('should export Repository interface type', async () => {
    const mod = await import('../src/repository/base');
    expect(mod).toBeDefined();
  });
});
