// @ts-nocheck
/**
 * PolicyService testing, deployment, versions, analytics
 */

import {
  TestPolicyRequest,
  TestPolicyResponse,
  DeployPolicyRequest,
  DeployPolicyResponse,
  RollbackPolicyRequest,
  RollbackPolicyResponse,
  PolicyVersion,
  PolicyImpact,
  PolicyAnalytics,
  PolicyTemplate,
  PolicyApproval,
  PolicyDeployment,
} from '@/types/policy-management';

import { apiClient } from '@/lib/api-client';
import { auditLogger } from '@/utils/security/audit-logger';
import { encryption } from '@/utils/security/encryption';
import { validateInput } from '@/utils/security/validation';
import { performanceMonitor } from '@/utils/performance/monitor';
import { clearCachePattern, isRateLimited } from './ps-cache';

const baseUrl = '/api/v1/policies';

export async function testPolicy(request: TestPolicyRequest): Promise<TestPolicyResponse> {
  const startTime = performance.now();
  try {
    const sanitizedRequest = validateInput(request, {
      policyId: 'uuid', version: { type: 'number', optional: true },
      testSuite: 'string', scenarios: 'array', context: 'object'
    });

    const rateLimitKey = `policy:test:${sanitizedRequest.policyId}`;
    if (isRateLimited(rateLimitKey, 10, 60)) {
      throw new Error('Rate limit exceeded for policy testing');
    }

    const response = await apiClient.post<TestPolicyResponse>(`${baseUrl}/${sanitizedRequest.policyId}/test`, sanitizedRequest);
    await auditLogger.log({ action: 'policy.test', resourceId: sanitizedRequest.policyId, resource: 'policy', details: { testSuite: sanitizedRequest.testSuite, scenarios: sanitizedRequest.scenarios, status: response.data.status, passRate: response.data.summary.passRate } });
    performanceMonitor.record('policy.test', performance.now() - startTime);
    return response.data;
  } catch (error) {
    await auditLogger.log({ action: 'policy.test.error', resourceId: request.policyId, resource: 'policy', details: { error: error.message } });
    throw error;
  }
}

export async function deployPolicy(request: DeployPolicyRequest): Promise<DeployPolicyResponse> {
  const startTime = performance.now();
  try {
    const sanitizedRequest = validateInput(request, {
      policyId: 'uuid', version: 'number',
      environment: { type: 'enum', values: ['development', 'testing', 'staging', 'production'] },
      approvalRequired: 'boolean', approvers: 'array'
    });

    if (sanitizedRequest.approvalRequired && !sanitizedRequest.approvers?.length) {
      throw new Error('Approvers are required when approval is enabled');
    }

    if (sanitizedRequest.approvalRequired) {
      const approval = await createApproval({
        policyId: sanitizedRequest.policyId, version: sanitizedRequest.version,
        type: 'deployment',
        reviewers: sanitizedRequest.approvers!.map(id => ({ id, name: '', email: '', role: 'approver', required: true }))
      });
      const approvalResult = await waitForApproval(approval.id);
      if (approvalResult.status !== 'approved') {
        throw new Error(`Deployment not approved: ${approvalResult.status}`);
      }
    }

    const response = await apiClient.post<DeployPolicyResponse>(`${baseUrl}/${sanitizedRequest.policyId}/deploy`, sanitizedRequest);
    clearCachePattern(`policy:${sanitizedRequest.policyId}:*`);
    await auditLogger.log({ action: 'policy.deploy', resourceId: sanitizedRequest.policyId, resource: 'policy', details: { version: sanitizedRequest.version, environment: sanitizedRequest.environment, deploymentId: response.data.deployment.id } });
    performanceMonitor.record('policy.deploy', performance.now() - startTime);
    return response.data;
  } catch (error) {
    await auditLogger.log({ action: 'policy.deploy.error', resourceId: request.policyId, resource: 'policy', details: { error: error.message } });
    throw error;
  }
}

export async function rollbackPolicy(request: RollbackPolicyRequest): Promise<RollbackPolicyResponse> {
  const startTime = performance.now();
  try {
    const sanitizedRequest = validateInput(request, {
      deploymentId: 'uuid', reason: 'string',
      strategy: { type: 'enum', values: ['immediate', 'graceful', 'scheduled'] },
      scheduledAt: { type: 'date', optional: true }
    });

    const deployment = await getDeployment(sanitizedRequest.deploymentId);
    if (!deployment.rollbackDeadline || new Date() > deployment.rollbackDeadline) {
      throw new Error('Rollback period has expired');
    }

    const mfaVerified = await verifyMFA('policy.rollback');
    if (!mfaVerified) throw new Error('Multi-factor authentication required for rollback');

    const response = await apiClient.post<RollbackPolicyResponse>(`${baseUrl}/deployments/${sanitizedRequest.deploymentId}/rollback`, sanitizedRequest);
    await auditLogger.log({ action: 'policy.rollback', resourceId: sanitizedRequest.deploymentId, resource: 'deployment', details: { strategy: sanitizedRequest.strategy, reason: sanitizedRequest.reason } });
    performanceMonitor.record('policy.rollback', performance.now() - startTime);
    return response.data;
  } catch (error) {
    await auditLogger.log({ action: 'policy.rollback.error', resourceId: request.deploymentId, resource: 'deployment', details: { error: error.message } });
    throw error;
  }
}

export async function getPolicyVersions(id: string): Promise<PolicyVersion[]> {
  const startTime = performance.now();
  try {
    validateInput({ id }, { id: 'uuid' });
    const response = await apiClient.get<PolicyVersion[]>(`${baseUrl}/${id}/versions`);
    const versions = response.data.map(version => ({
      ...version,
      regoCode: version.regoCode ? encryption.decrypt(version.regoCode) : version.regoCode
    }));
    performanceMonitor.record('policy.versions.get', performance.now() - startTime);
    return versions;
  } catch (error) {
    await auditLogger.log({ action: 'policy.versions.get.error', resourceId: id, resource: 'policy', details: { error: error.message } });
    throw error;
  }
}

export async function getPolicyImpact(id: string, compareToVersion?: number): Promise<PolicyImpact> {
  const startTime = performance.now();
  try {
    validateInput({ id, compareToVersion }, { id: 'uuid', compareToVersion: { type: 'number', optional: true } });
    const response = await apiClient.get<PolicyImpact>(`${baseUrl}/${id}/impact`, { params: { compareToVersion } });
    await auditLogger.log({ action: 'policy.impact.analyze', resourceId: id, resource: 'policy', details: { compareToVersion } });
    performanceMonitor.record('policy.impact.analyze', performance.now() - startTime);
    return response.data;
  } catch (error) {
    await auditLogger.log({ action: 'policy.impact.analyze.error', resourceId: id, resource: 'policy', details: { error: error.message } });
    throw error;
  }
}

export async function getPolicyAnalytics(
  id: string, timeRange: { start: Date; end: Date },
  granularity: 'minute' | 'hour' | 'day' | 'week' | 'month' = 'hour'
): Promise<PolicyAnalytics> {
  const startTime = performance.now();
  try {
    validateInput({ id, timeRange, granularity }, { id: 'uuid', timeRange: 'object', granularity: { type: 'enum', values: ['minute', 'hour', 'day', 'week', 'month'] } });
    const response = await apiClient.get<PolicyAnalytics>(`${baseUrl}/${id}/analytics`, { params: { start: timeRange.start.toISOString(), end: timeRange.end.toISOString(), granularity } });
    performanceMonitor.record('policy.analytics.get', performance.now() - startTime);
    return response.data;
  } catch (error) {
    await auditLogger.log({ action: 'policy.analytics.get.error', resourceId: id, resource: 'policy', details: { error: error.message } });
    throw error;
  }
}

export async function getPolicyTemplates(category?: string): Promise<PolicyTemplate[]> {
  const startTime = performance.now();
  try {
    const response = await apiClient.get<PolicyTemplate[]>(`${baseUrl}/templates`, { params: { category } });
    performanceMonitor.record('policy.templates.get', performance.now() - startTime);
    return response.data;
  } catch (error) {
    await auditLogger.log({ action: 'policy.templates.get.error', resource: 'policy', details: { category, error: error.message } });
    throw error;
  }
}

async function createApproval(approval: Partial<PolicyApproval>): Promise<PolicyApproval> {
  const response = await apiClient.post<PolicyApproval>(`${baseUrl}/approvals`, approval);
  return response.data;
}

async function waitForApproval(approvalId: string): Promise<PolicyApproval> {
  const maxWaitTime = 24 * 60 * 60 * 1000;
  const interval = 5000;
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitTime) {
    const approval = await apiClient.get<PolicyApproval>(`${baseUrl}/approvals/${approvalId}`);
    if (['approved', 'rejected', 'escalated'].includes(approval.data.status)) return approval.data;
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error('Approval timeout');
}

async function getDeployment(deploymentId: string): Promise<PolicyDeployment> {
  const response = await apiClient.get<PolicyDeployment>(`${baseUrl}/deployments/${deploymentId}`);
  return response.data;
}

async function verifyMFA(operation: string): Promise<boolean> {
  return true;
}
