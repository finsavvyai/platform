/**
 * Tenant CRUD service — core create, read, update, delete, list, and validation.
 */
import { nanoid } from 'nanoid';
import { z } from 'zod';

const TenantSchema = z.object({
  orgId: z.string().min(1),
  name: z.string().min(1).max(255),
  domain: z.string().regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/),
  config: z.object({
    region: z.enum(['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1']).optional()
  }).optional()
});

export interface Tenant {
  id: string;
  orgId: string;
  name: string;
  domain: string;
  config?: Record<string, any>;
  healthScore: number;
  lastHealthCheck?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const tenants = new Map<string, Tenant>();

export async function createTenant(data: z.infer<typeof TenantSchema>): Promise<Tenant> {
  const validated = TenantSchema.parse(data);
  const orgTenants = Array.from(tenants.values()).filter(t => t.orgId === validated.orgId && !t.deletedAt);

  if (orgTenants.some(t => t.name === validated.name)) {
    throw new Error(`Tenant with name ${validated.name} already exists in organization`);
  }

  const tenant: Tenant = {
    id: nanoid(),
    orgId: validated.orgId,
    name: validated.name,
    domain: validated.domain,
    config: validated.config || {},
    healthScore: 100,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  tenants.set(tenant.id, tenant);
  return tenant;
}

export async function getTenant(id: string, orgId: string): Promise<Tenant | null> {
  const tenant = tenants.get(id);
  if (!tenant || tenant.orgId !== orgId || tenant.deletedAt) {
    return null;
  }
  return tenant;
}

export async function updateTenant(
  id: string,
  orgId: string,
  updates: Partial<Omit<Tenant, 'id' | 'createdAt'>>
): Promise<Tenant | null> {
  const tenant = await getTenant(id, orgId);
  if (!tenant) return null;

  if (updates.domain) {
    TenantSchema.pick({ domain: true }).parse({ domain: updates.domain });
  }
  if (updates.name) {
    if (typeof updates.name !== 'string' || updates.name.length === 0) {
      throw new Error('Invalid name');
    }
  }

  const updated: Tenant = {
    ...tenant,
    ...updates,
    updatedAt: new Date()
  };

  tenants.set(id, updated);
  return updated;
}

export async function deleteTenant(id: string, orgId: string): Promise<boolean> {
  const tenant = await getTenant(id, orgId);
  if (!tenant) return false;

  tenant.deletedAt = new Date();
  tenants.set(id, tenant);
  return true;
}

export async function listTenants(
  orgId: string,
  options?: { limit?: number; offset?: number; sortBy?: string }
): Promise<Tenant[]> {
  let results = Array.from(tenants.values()).filter(t => t.orgId === orgId && !t.deletedAt);

  if (options?.sortBy === 'healthScore') {
    results.sort((a, b) => b.healthScore - a.healthScore);
  }

  const offset = options?.offset || 0;
  const limit = options?.limit || Infinity;

  return results.slice(offset, offset + limit);
}

export function validateTenantName(name: string): boolean {
  return name.length > 0 && name.length <= 255;
}

export function validateTenantConfig(config: Record<string, any>): boolean {
  if (!config) return true;
  const validRegions = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'];
  if (config.region && !validRegions.includes(config.region)) {
    return false;
  }
  return true;
}

// Re-export operations so existing imports continue to work
export {
  getTenantHealth,
  getTenantMetrics,
  getTenantAlerts,
  bulkImportTenants,
  searchTenants,
} from './tenant-operations';
