// @ts-nocheck
/**
 * Policy approval, templates, analytics, versions for PolicyManagementService
 */

import { apiClient } from '@/lib/api-client';
import {
  PolicyApproval,
  PolicyTemplate,
  PolicyVersion,
  PolicyImpact,
  PolicyAnalytics,
  Policy,
} from '@/types/policy-management';
import { secureLog, sanitizeInput } from '@/utils/security/audit-logger';
import { decryptPolicyData, handleServiceError } from '../helpers/policy-helpers';

const baseUrl = '/api/v1/policies';
const approvalUrl = '/api/v1/policy-approvals';
const templatesUrl = '/api/v1/policy-templates';
const analyticsUrl = '/api/v1/policy-analytics';

export async function submitForApproval(policyId: string, version: number, approvers: string[]): Promise<PolicyApproval> {
  try {
    const response = await apiClient.post<PolicyApproval>(`${approvalUrl}/submit`, { policyId, version, approvers, type: 'deployment' });
    await secureLog('INFO', 'Policy submitted for approval', { policyId, version, approvers, approvalId: response.data.id });
    return response.data;
  } catch (error) {
    await secureLog('ERROR', 'Failed to submit for approval', { error, policyId, version });
    throw handleServiceError(error);
  }
}

export async function approvePolicy(approvalId: string, decision: 'approve' | 'reject' | 'request_changes', comment?: string): Promise<PolicyApproval> {
  try {
    const sanitizedComment = comment ? sanitizeInput(comment) : undefined;
    const response = await apiClient.patch<PolicyApproval>(`${approvalUrl}/${approvalId}/decide`, { decision, comment: sanitizedComment });
    await secureLog('INFO', 'Policy approval decision recorded', { approvalId, decision, hasComment: !!comment });
    return response.data;
  } catch (error) {
    await secureLog('ERROR', 'Failed to record approval decision', { error, approvalId, decision });
    throw handleServiceError(error);
  }
}

export async function getApproval(approvalId: string): Promise<PolicyApproval> {
  try {
    const response = await apiClient.get<PolicyApproval>(`${approvalUrl}/${approvalId}`);
    return response.data;
  } catch (error) {
    await secureLog('ERROR', 'Failed to get approval', { error, approvalId });
    throw handleServiceError(error);
  }
}

export async function listTemplates(category?: string): Promise<PolicyTemplate[]> {
  try {
    const response = await apiClient.get<PolicyTemplate[]>(templatesUrl, { params: category ? { category } : undefined });
    return response.data;
  } catch (error) {
    await secureLog('ERROR', 'Failed to list templates', { error, category });
    throw handleServiceError(error);
  }
}

export async function getTemplate(id: string): Promise<PolicyTemplate> {
  try {
    const response = await apiClient.get<PolicyTemplate>(`${templatesUrl}/${id}`);
    return response.data;
  } catch (error) {
    await secureLog('ERROR', 'Failed to get template', { error, templateId: id });
    throw handleServiceError(error);
  }
}

export async function createPolicyFromTemplate(templateId: string, parameters: Record<string, any>): Promise<Policy> {
  try {
    const response = await apiClient.post<Policy>(`${templatesUrl}/${templateId}/create`, { parameters });
    const policy = decryptPolicyData(response.data);
    await secureLog('INFO', 'Policy created from template', { templateId, policyId: policy.id, policyName: policy.name });
    return policy;
  } catch (error) {
    await secureLog('ERROR', 'Failed to create policy from template', { error, templateId });
    throw handleServiceError(error);
  }
}

export async function getPolicyAnalytics(policyId: string, timeRange: { start: Date; end: Date }): Promise<PolicyAnalytics> {
  try {
    const response = await apiClient.get<PolicyAnalytics>(`${analyticsUrl}/${policyId}`, { params: { start: timeRange.start.toISOString(), end: timeRange.end.toISOString() } });
    return response.data;
  } catch (error) {
    await secureLog('ERROR', 'Failed to get policy analytics', { error, policyId, timeRange });
    throw handleServiceError(error);
  }
}

export async function analyzePolicyImpact(policyId: string, compareToVersion?: number): Promise<PolicyImpact> {
  try {
    const response = await apiClient.get<PolicyImpact>(`${baseUrl}/${policyId}/impact`, { params: compareToVersion ? { compareToVersion } : undefined });
    await secureLog('INFO', 'Policy impact analysis completed', { policyId, compareToVersion, riskLevel: response.data.riskLevel });
    return response.data;
  } catch (error) {
    await secureLog('ERROR', 'Failed to analyze policy impact', { error, policyId, compareToVersion });
    throw handleServiceError(error);
  }
}

export async function getVersionHistory(policyId: string): Promise<PolicyVersion[]> {
  try {
    const response = await apiClient.get<PolicyVersion[]>(`${baseUrl}/${policyId}/versions`);
    return response.data;
  } catch (error) {
    await secureLog('ERROR', 'Failed to get version history', { error, policyId });
    throw handleServiceError(error);
  }
}

export async function restoreVersion(policyId: string, version: number): Promise<Policy> {
  try {
    const response = await apiClient.post<Policy>(`${baseUrl}/${policyId}/versions/${version}/restore`);
    const policy = decryptPolicyData(response.data);
    await secureLog('INFO', 'Policy version restored', { policyId, restoredVersion: version, newVersion: policy.version });
    return policy;
  } catch (error) {
    await secureLog('ERROR', 'Failed to restore policy version', { error, policyId, version });
    throw handleServiceError(error);
  }
}
