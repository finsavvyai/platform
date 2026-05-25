import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDb } from '../test/helpers.js';
import { incrementUsage } from './usage.js';

describe('incrementUsage', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
  });

  it('inserts new row when no existing usage for today', async () => {
    mockDb._setSelectResult([]);
    await incrementUsage(mockDb as never, 'tenant_1', 'verification');
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('updates existing row for verification', async () => {
    mockDb._setSelectResult([{ id: 'tenant_1_2025-01-15', tenantId: 'tenant_1', date: '2025-01-15' }]);
    await incrementUsage(mockDb as never, 'tenant_1', 'verification');
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('updates existing row for bind', async () => {
    mockDb._setSelectResult([{ id: 'tenant_1_2025-01-15', tenantId: 'tenant_1', date: '2025-01-15' }]);
    await incrementUsage(mockDb as never, 'tenant_1', 'bind');
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('updates existing row for stepUp', async () => {
    mockDb._setSelectResult([{ id: 'tenant_1_2025-01-15', tenantId: 'tenant_1', date: '2025-01-15' }]);
    await incrementUsage(mockDb as never, 'tenant_1', 'stepUp');
    expect(mockDb.update).toHaveBeenCalled();
  });
});
