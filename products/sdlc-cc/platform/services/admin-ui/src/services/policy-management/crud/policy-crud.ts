// @ts-nocheck
/**
 * Policy CRUD operations
 */

import {
  Policy,
  PolicyListQuery,
  PolicyListResponse,
  CreatePolicyRequest,
  UpdatePolicyRequest,
} from '@/types/policy-management';

import {
  secureApiClient,
  secureCache
} from '@/utils/security/secure-api';

import { validateAndSanitize } from '@/utils/security/validation';
import { generateSecureChecksum } from '@/utils/security/crypto';
import { generateRequestId, getChanges, handleApiError, auditLog } from '../helpers/request-helpers';

const baseUrl = '/api/v1/policies';
const cache = new Map<string, any>();

export function invalidatePolicyCache(policyId?: string) {
  if (policyId) {
    const keysToDelete = Array.from(cache.keys()).filter(key =>
      key.includes(policyId) || key.startsWith('policies:list')
    );
    keysToDelete.forEach(key => cache.delete(key));
  } else {
    const keysToDelete = Array.from(cache.keys()).filter(key =>
      key.startsWith('policy:') || key.startsWith('policies:list') || key.startsWith('analytics:')
    );
    keysToDelete.forEach(key => cache.delete(key));
  }
}

export async function listPolicies(query: PolicyListQuery = {}): Promise<PolicyListResponse> {
  const cacheKey = `policies:list:${JSON.stringify(query)}`;
  const cached = secureCache.get(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams();
    if (query.page) params.append('page', query.page.toString());
    if (query.limit) params.append('limit', query.limit.toString());
    if (query.sort) params.append('sort', query.sort);
    if (query.order) params.append('order', query.order);
    if (query.search) params.append('search', query.search);
    if (query.filter) params.append('filter', JSON.stringify(query.filter));

    const response = await secureApiClient.get(`${baseUrl}?${params.toString()}`, {
      headers: { 'X-Request-ID': generateRequestId(), 'X-Security-Context': 'policy-list' }
    });
    const data = await response.json();
    secureCache.set(cacheKey, data, 5 * 60 * 1000);
    return data;
  } catch (error) {
    console.error('Failed to fetch policies:', error);
    throw handleApiError(error, 'Failed to fetch policies');
  }
}

export async function getPolicy(id: string, includeVersions = false): Promise<Policy> {
  const cacheKey = `policy:${id}:${includeVersions ? 'full' : 'basic'}`;
  const cached = secureCache.get(cacheKey);
  if (cached) return cached;

  try {
    const response = await secureApiClient.get(`${baseUrl}/${id}`, {
      headers: { 'X-Request-ID': generateRequestId(), 'X-Security-Context': 'policy-read', 'X-Include-Versions': includeVersions.toString() }
    });
    const data = await response.json();
    secureCache.set(cacheKey, data, 5 * 60 * 1000);
    return data;
  } catch (error) {
    console.error(`Failed to fetch policy ${id}:`, error);
    throw handleApiError(error, 'Failed to fetch policy');
  }
}

export async function createPolicy(request: CreatePolicyRequest): Promise<Policy> {
  const sanitized = await validateAndSanitize(request);
  const checksum = await generateSecureChecksum(JSON.stringify(sanitized));

  try {
    const response = await secureApiClient.post(baseUrl, {
      ...sanitized, checksum,
      securityContext: { classification: 'internal', requireApproval: true, auditLog: true }
    }, {
      headers: { 'X-Request-ID': generateRequestId(), 'X-Security-Context': 'policy-create', 'X-Content-Type': 'application/json' }
    });
    const data = await response.json();
    invalidatePolicyCache();
    auditLog('policy_created', { policyId: data.id, policyName: request.name, category: request.category });
    return data;
  } catch (error) {
    console.error('Failed to create policy:', error);
    throw handleApiError(error, 'Failed to create policy');
  }
}

export async function updatePolicy(id: string, request: UpdatePolicyRequest): Promise<Policy> {
  const sanitized = await validateAndSanitize(request);
  const current = await getPolicy(id);
  if (current.version !== request.version) {
    throw new Error('Policy has been modified by another user. Please refresh and try again.');
  }
  const checksum = await generateSecureChecksum(JSON.stringify(sanitized));

  try {
    const response = await secureApiClient.put(`${baseUrl}/${id}`, {
      ...sanitized, checksum, expectedVersion: current.version,
      securityContext: { classification: current.securityContext.classification, requireApproval: true, auditLog: true }
    }, {
      headers: { 'X-Request-ID': generateRequestId(), 'X-Security-Context': 'policy-update', 'X-Content-Type': 'application/json', 'If-Match': current.version.toString() }
    });
    const data = await response.json();
    invalidatePolicyCache(id);
    auditLog('policy_updated', { policyId: id, changes: getChanges(current, sanitized) });
    return data;
  } catch (error) {
    console.error(`Failed to update policy ${id}:`, error);
    throw handleApiError(error, 'Failed to update policy');
  }
}

export async function deletePolicy(id: string): Promise<void> {
  const policy = await getPolicy(id);
  if (policy.dependencies.length > 0) {
    throw new Error('Cannot delete policy with active dependencies. Remove dependencies first.');
  }
  try {
    await secureApiClient.delete(`${baseUrl}/${id}`, {
      headers: { 'X-Request-ID': generateRequestId(), 'X-Security-Context': 'policy-delete', 'X-Confirmation': 'DELETE_CONFIRMED' }
    });
    invalidatePolicyCache(id);
    auditLog('policy_deleted', { policyId: id, policyName: policy.name });
  } catch (error) {
    console.error(`Failed to delete policy ${id}:`, error);
    throw handleApiError(error, 'Failed to delete policy');
  }
}
