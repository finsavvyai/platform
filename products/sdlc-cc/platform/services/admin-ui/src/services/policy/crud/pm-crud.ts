// @ts-nocheck
/**
 * Policy CRUD operations for PolicyManagementService
 */

import { apiClient } from '@/lib/api-client';
import {
  Policy,
  PolicyListQuery,
  PolicyListResponse,
  CreatePolicyRequest,
  UpdatePolicyRequest,
} from '@/types/policy-management';
import { secureLog, sanitizeInput } from '@/utils/security/audit-logger';
import { validateInput } from '@/utils/security/validation';
import {
  sanitizePolicyRequest,
  sanitizePolicyUpdateRequest,
  encryptPolicyData,
  encryptPolicyUpdateData,
  decryptPolicyData,
  canUpdateDeployedPolicy,
  handleServiceError,
} from '../helpers/policy-helpers';

const baseUrl = '/api/v1/policies';

export async function listPolicies(query: PolicyListQuery = {}): Promise<PolicyListResponse> {
  try {
    const sanitizedQuery = {
      ...query,
      search: query.search ? sanitizeInput(query.search) : undefined,
      limit: Math.min(query.limit || 50, 100),
      page: Math.max(query.page || 1, 1)
    };
    const response = await apiClient.get<PolicyListResponse>(baseUrl, { params: sanitizedQuery });
    const policies = response.data.policies.map(policy => decryptPolicyData(policy));
    await secureLog('INFO', 'Policies listed', { count: policies.length, total: response.data.total, query: sanitizedQuery });
    return { ...response.data, policies };
  } catch (error) {
    await secureLog('ERROR', 'Failed to list policies', { error, query });
    throw handleServiceError(error);
  }
}

export async function getPolicy(id: string, version?: number): Promise<Policy> {
  try {
    if (!validateInput(id, 'uuid')) throw new Error('Invalid policy ID format');
    const response = await apiClient.get<Policy>(`${baseUrl}/${id}`, { params: version ? { version } : undefined });
    const policy = decryptPolicyData(response.data);
    await secureLog('INFO', 'Policy retrieved', { policyId: id, version: version || policy.version, name: policy.name, category: policy.category });
    return policy;
  } catch (error) {
    await secureLog('ERROR', 'Failed to get policy', { error, policyId: id, version });
    throw handleServiceError(error);
  }
}

export async function createPolicy(request: CreatePolicyRequest): Promise<Policy> {
  try {
    const sanitizedRequest = await sanitizePolicyRequest(request);
    const encryptedRequest = await encryptPolicyData(sanitizedRequest);
    const securedRequest = {
      ...encryptedRequest,
      securityContext: {
        classification: request.metadata?.risk?.score ? (request.metadata.risk.score > 0.7 ? 'high' : 'medium') : 'low',
        accessControls: ['RBAC'],
        encryption: { atRest: true, inTransit: true, algorithm: 'AES-256-GCM', keyRotation: 90, keyManagement: 'cloudflare-kms' },
        auditLogging: { logLevel: 'info', logRetention: 365, logDestinations: ['cloudflare-logs', 'siem'], sensitiveDataMasking: true, realTimeAlerts: true }
      }
    };
    const response = await apiClient.post<Policy>(baseUrl, securedRequest);
    const policy = decryptPolicyData(response.data);
    await secureLog('INFO', 'Policy created', { policyId: policy.id, name: policy.name, category: policy.category, createdBy: policy.createdBy });
    return policy;
  } catch (error) {
    await secureLog('ERROR', 'Failed to create policy', { error, request: request.name });
    throw handleServiceError(error);
  }
}

export async function updatePolicy(id: string, request: UpdatePolicyRequest): Promise<Policy> {
  try {
    if (!validateInput(id, 'uuid')) throw new Error('Invalid policy ID format');
    const sanitizedRequest = await sanitizePolicyUpdateRequest(request);
    const currentPolicy = await getPolicy(id);
    if (currentPolicy.status === 'deployed' && !canUpdateDeployedPolicy(currentPolicy)) {
      throw new Error('Cannot update deployed policy. Create a new version instead.');
    }
    const encryptedRequest = await encryptPolicyUpdateData(sanitizedRequest);
    const response = await apiClient.patch<Policy>(`${baseUrl}/${id}`, encryptedRequest);
    const policy = decryptPolicyData(response.data);
    await secureLog('INFO', 'Policy updated', { policyId: id, name: policy.name, version: policy.version, updatedBy: policy.updatedBy });
    return policy;
  } catch (error) {
    await secureLog('ERROR', 'Failed to update policy', { error, policyId: id });
    throw handleServiceError(error);
  }
}

export async function deletePolicy(id: string, options: { force?: boolean; reason?: string } = {}): Promise<void> {
  try {
    if (!validateInput(id, 'uuid')) throw new Error('Invalid policy ID format');
    const policy = await getPolicy(id);
    if (policy.status === 'deployed' && !options.force) {
      throw new Error('Cannot delete deployed policy. Undeploy it first or use force option.');
    }
    if (options.reason) {
      await secureLog('INFO', 'Policy deletion reason', { policyId: id, policyName: policy.name, reason: sanitizeInput(options.reason) });
    }
    await apiClient.delete(`${baseUrl}/${id}`, { params: { force: options.force, reason: options.reason } });
    await secureLog('INFO', 'Policy deleted', { policyId: id, policyName: policy.name, force: options.force });
  } catch (error) {
    await secureLog('ERROR', 'Failed to delete policy', { error, policyId: id });
    throw handleServiceError(error);
  }
}
