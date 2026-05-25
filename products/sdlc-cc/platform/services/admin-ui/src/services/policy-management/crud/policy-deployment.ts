// @ts-nocheck
/**
 * Policy deployment and rollback operations
 */

import {
  DeployPolicyRequest,
  DeployPolicyResponse,
  RollbackPolicyRequest,
  RollbackPolicyResponse,
  PolicyDeployment,
  PolicyVersion,
  PolicyImpact,
  PolicyAnalytics,
  PolicyApproval,
  PolicyTemplate,
  Policy,
} from '@/types/policy-management';

import { secureApiClient, secureCache } from '@/utils/security/secure-api';
import { generateRequestId, handleApiError, auditLog } from '../helpers/request-helpers';
import { invalidatePolicyCache, getPolicy } from './policy-crud';

const baseUrl = '/api/v1/policies';

export async function deployPolicy(request: DeployPolicyRequest): Promise<DeployPolicyResponse> {
  const policy = await getPolicy(request.policyId);
  try {
    const response = await secureApiClient.post(`${baseUrl}/${request.policyId}/deploy`, {
      ...request,
      securityContext: {
        requireApproval: policy.securityContext.classification !== 'public',
        validateBeforeDeploy: true,
        autoRollback: request.config?.autoRollback ?? true,
        encryptionRequired: true
      }
    }, {
      headers: { 'X-Request-ID': generateRequestId(), 'X-Security-Context': 'policy-deployment', 'X-Content-Type': 'application/json' }
    });
    const data = await response.json();
    invalidatePolicyCache(request.policyId);
    auditLog('policy_deployed', { policyId: request.policyId, environment: request.environment, deploymentId: data.deployment.id });
    return data;
  } catch (error) {
    console.error('Failed to deploy policy:', error);
    throw handleApiError(error, 'Failed to deploy policy');
  }
}

export async function rollbackPolicy(request: RollbackPolicyRequest): Promise<RollbackPolicyResponse> {
  try {
    const response = await secureApiClient.post(
      `${baseUrl}/deployments/${request.deploymentId}/rollback`,
      { ...request, securityContext: { requireApproval: true, validateRollback: true, backupRequired: true, notifyStakeholders: true } },
      { headers: { 'X-Request-ID': generateRequestId(), 'X-Security-Context': 'policy-rollback', 'X-Content-Type': 'application/json' } }
    );
    const data = await response.json();
    auditLog('policy_rolled_back', { deploymentId: request.deploymentId, reason: request.reason, strategy: request.strategy });
    return data;
  } catch (error) {
    console.error('Failed to rollback policy:', error);
    throw handleApiError(error, 'Failed to rollback policy');
  }
}

export async function getDeploymentHistory(policyId: string): Promise<PolicyDeployment[]> {
  try {
    const response = await secureApiClient.get(`${baseUrl}/${policyId}/deployments`, {
      headers: { 'X-Request-ID': generateRequestId(), 'X-Security-Context': 'deployment-history' }
    });
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch deployment history:', error);
    throw handleApiError(error, 'Failed to fetch deployment history');
  }
}

export async function getVersionHistory(policyId: string): Promise<PolicyVersion[]> {
  try {
    const response = await secureApiClient.get(`${baseUrl}/${policyId}/versions`, {
      headers: { 'X-Request-ID': generateRequestId(), 'X-Security-Context': 'version-history' }
    });
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch version history:', error);
    throw handleApiError(error, 'Failed to fetch version history');
  }
}

export async function getVersion(policyId: string, version: number): Promise<PolicyVersion> {
  try {
    const response = await secureApiClient.get(`${baseUrl}/${policyId}/versions/${version}`, {
      headers: { 'X-Request-ID': generateRequestId(), 'X-Security-Context': 'version-read' }
    });
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch policy version:', error);
    throw handleApiError(error, 'Failed to fetch policy version');
  }
}

export async function restoreVersion(policyId: string, version: number, reason: string): Promise<Policy> {
  try {
    const response = await secureApiClient.post(
      `${baseUrl}/${policyId}/versions/${version}/restore`,
      { reason, securityContext: { requireApproval: true, createBackup: true, notifyUsers: true } },
      { headers: { 'X-Request-ID': generateRequestId(), 'X-Security-Context': 'version-restore', 'X-Content-Type': 'application/json' } }
    );
    const data = await response.json();
    invalidatePolicyCache(policyId);
    auditLog('policy_restored', { policyId, version, reason });
    return data;
  } catch (error) {
    console.error('Failed to restore policy version:', error);
    throw handleApiError(error, 'Failed to restore policy version');
  }
}

export async function analyzeImpact(policyId: string, compareToVersion?: number): Promise<PolicyImpact> {
  try {
    const response = await secureApiClient.post(
      `${baseUrl}/${policyId}/analyze`,
      { compareToVersion, includeSecurity: true, includePerformance: true, includeCompliance: true, securityContext: { deepAnalysis: true, checkAllResources: true, simulateExecution: true } },
      { headers: { 'X-Request-ID': generateRequestId(), 'X-Security-Context': 'policy-analysis', 'X-Content-Type': 'application/json' } }
    );
    return await response.json();
  } catch (error) {
    console.error('Failed to analyze policy impact:', error);
    throw handleApiError(error, 'Failed to analyze policy impact');
  }
}

export async function getAnalytics(
  policyId: string,
  timeRange: { start: Date; end: Date },
  granularity: 'hour' | 'day' | 'week' = 'day'
): Promise<PolicyAnalytics> {
  const cacheKey = `analytics:${policyId}:${timeRange.start.getTime()}:${timeRange.end.getTime()}:${granularity}`;
  const cached = secureCache.get(cacheKey);
  if (cached) return cached;

  try {
    const response = await secureApiClient.get(`${baseUrl}/${policyId}/analytics`, {
      params: { start: timeRange.start.toISOString(), end: timeRange.end.toISOString(), granularity },
      headers: { 'X-Request-ID': generateRequestId(), 'X-Security-Context': 'policy-analytics' }
    });
    const data = await response.json();
    secureCache.set(cacheKey, data, 60000);
    return data;
  } catch (error) {
    console.error('Failed to fetch policy analytics:', error);
    throw handleApiError(error, 'Failed to fetch policy analytics');
  }
}
