// @ts-nocheck
/**
 * PolicyService CRUD operations
 */

import {
  Policy,
  PolicyListQuery,
  PolicyListResponse,
  CreatePolicyRequest,
  UpdatePolicyRequest,
} from '@/types/policy-management';

import { apiClient } from '@/lib/api-client';
import { auditLogger } from '@/utils/security/audit-logger';
import { encryption } from '@/utils/security/encryption';
import { validateInput } from '@/utils/security/validation';
import { performanceMonitor } from '@/utils/performance/monitor';
import { getFromCache, setCache, clearCachePattern } from './ps-cache';
import { validatePolicy } from './ps-validation';

const baseUrl = '/api/v1/policies';

export async function getPolicies(query: PolicyListQuery = {}): Promise<PolicyListResponse> {
  const startTime = performance.now();
  try {
    const sanitizedQuery = validateInput(query, {
      page: 'number', limit: 'number', sort: 'string',
      order: { type: 'enum', values: ['asc', 'desc'] }, search: 'string', filter: 'object'
    });
    const cacheKey = `policies:${JSON.stringify(sanitizedQuery)}`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    const response = await apiClient.get<PolicyListResponse>(baseUrl, { params: sanitizedQuery });
    const encryptedPolicies = response.data.policies.map(policy => ({
      ...policy,
      regoCode: policy.regoCode ? encryption.encrypt(policy.regoCode) : policy.regoCode,
      metadata: { ...policy.metadata, requirements: policy.metadata.requirements?.map(r => encryption.encrypt(r)) || [] }
    }));
    const result = { ...response.data, policies: encryptedPolicies };
    setCache(cacheKey, result);
    await auditLogger.log({ action: 'policies.list', resource: 'policy', details: { query: sanitizedQuery, count: result.total } });
    performanceMonitor.record('policy.list', performance.now() - startTime);
    return result;
  } catch (error) {
    await auditLogger.log({ action: 'policies.list.error', resource: 'policy', details: { query, error: error.message } });
    throw error;
  }
}

export async function getPolicy(id: string, version?: number): Promise<Policy> {
  const startTime = performance.now();
  try {
    validateInput({ id, version }, { id: 'uuid', version: { type: 'number', optional: true } });
    const cacheKey = `policy:${id}:${version || 'latest'}`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    const response = await apiClient.get<Policy>(`${baseUrl}/${id}`, { params: version ? { version } : undefined });
    const policy = {
      ...response.data,
      regoCode: response.data.regoCode ? encryption.decrypt(response.data.regoCode) : response.data.regoCode,
      metadata: { ...response.data.metadata, requirements: response.data.metadata.requirements?.map(r => encryption.decrypt(r)) || [] }
    };
    setCache(cacheKey, policy);
    await auditLogger.log({ action: 'policy.get', resourceId: id, resource: 'policy', details: { version } });
    performanceMonitor.record('policy.get', performance.now() - startTime);
    return policy;
  } catch (error) {
    await auditLogger.log({ action: 'policy.get.error', resourceId: id, resource: 'policy', details: { version, error: error.message } });
    throw error;
  }
}

export async function createPolicy(request: CreatePolicyRequest): Promise<Policy> {
  const startTime = performance.now();
  try {
    const sanitizedRequest = validateInput(request, {
      name: 'string', description: 'string',
      category: { type: 'enum', values: ['authentication', 'authorization', 'data_access', 'api_security', 'compliance', 'privacy', 'resource_management', 'audit', 'custom'] },
      priority: { type: 'enum', values: ['critical', 'high', 'medium', 'low'] },
      regoCode: 'string', tags: 'array', templateId: { type: 'uuid', optional: true }, parameters: 'object'
    });

    const validation = await validatePolicy({ regoCode: sanitizedRequest.regoCode, category: sanitizedRequest.category, strict: true });
    if (!validation.valid) throw new Error(`Policy validation failed: ${validation.errors.map(e => e.message).join(', ')}`);

    const encryptedRequest = {
      ...sanitizedRequest,
      regoCode: encryption.encrypt(sanitizedRequest.regoCode),
      metadata: { ...sanitizedRequest.metadata, requirements: sanitizedRequest.metadata?.requirements?.map(r => encryption.encrypt(r)) || [] }
    };
    const response = await apiClient.post<Policy>(baseUrl, encryptedRequest);
    clearCachePattern('policies:*');
    await auditLogger.log({ action: 'policy.create', resourceId: response.data.id, resource: 'policy', details: { name: sanitizedRequest.name, category: sanitizedRequest.category, templateId: sanitizedRequest.templateId } });
    performanceMonitor.record('policy.create', performance.now() - startTime);
    return response.data;
  } catch (error) {
    await auditLogger.log({ action: 'policy.create.error', resource: 'policy', details: { request, error: error.message } });
    throw error;
  }
}

export async function updatePolicy(id: string, request: UpdatePolicyRequest): Promise<Policy> {
  const startTime = performance.now();
  try {
    validateInput({ id }, { id: 'uuid' });
    const sanitizedRequest = validateInput(request, {
      name: 'string', description: 'string',
      category: { type: 'enum', values: ['authentication', 'authorization', 'data_access', 'api_security', 'compliance', 'privacy', 'resource_management', 'audit', 'custom'] },
      priority: { type: 'enum', values: ['critical', 'high', 'medium', 'low'] },
      regoCode: 'string', tags: 'array', version: 'number'
    });

    if (sanitizedRequest.regoCode) {
      const validation = await validatePolicy({ regoCode: sanitizedRequest.regoCode, category: sanitizedRequest.category, strict: true });
      if (!validation.valid) throw new Error(`Policy validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    const encryptedRequest = {
      ...sanitizedRequest,
      regoCode: sanitizedRequest.regoCode ? encryption.encrypt(sanitizedRequest.regoCode) : undefined,
      metadata: sanitizedRequest.metadata ? { ...sanitizedRequest.metadata, requirements: sanitizedRequest.metadata.requirements?.map(r => encryption.encrypt(r)) || [] } : undefined
    };
    const response = await apiClient.put<Policy>(`${baseUrl}/${id}`, encryptedRequest);
    clearCachePattern(`policy:${id}:*`);
    clearCachePattern('policies:*');
    await auditLogger.log({ action: 'policy.update', resourceId: id, resource: 'policy', details: { version: sanitizedRequest.version, fields: Object.keys(sanitizedRequest) } });
    performanceMonitor.record('policy.update', performance.now() - startTime);
    return response.data;
  } catch (error) {
    await auditLogger.log({ action: 'policy.update.error', resourceId: id, resource: 'policy', details: { request, error: error.message } });
    throw error;
  }
}

export async function deletePolicy(id: string): Promise<void> {
  const startTime = performance.now();
  try {
    validateInput({ id }, { id: 'uuid' });
    await apiClient.delete(`${baseUrl}/${id}`);
    clearCachePattern(`policy:${id}:*`);
    clearCachePattern('policies:*');
    await auditLogger.log({ action: 'policy.delete', resourceId: id, resource: 'policy' });
    performanceMonitor.record('policy.delete', performance.now() - startTime);
  } catch (error) {
    await auditLogger.log({ action: 'policy.delete.error', resourceId: id, resource: 'policy', details: { error: error.message } });
    throw error;
  }
}

// validatePolicy is in ps-validation.ts
export { validatePolicy } from './ps-validation';
