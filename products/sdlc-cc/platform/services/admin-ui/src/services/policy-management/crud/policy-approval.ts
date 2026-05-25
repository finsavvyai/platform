// @ts-nocheck
/**
 * Policy approval and template operations
 */

import {
  PolicyApproval,
  PolicyTemplate,
  CreatePolicyRequest,
  Policy,
} from '@/types/policy-management';

import { secureApiClient, secureCache } from '@/utils/security/secure-api';
import { generateRequestId, handleApiError, auditLog } from '../helpers/request-helpers';
import { invalidatePolicyCache } from './policy-crud';

const baseUrl = '/api/v1/policies';

export async function getApprovals(policyId?: string): Promise<PolicyApproval[]> {
  try {
    const url = policyId ? `${baseUrl}/${policyId}/approvals` : `${baseUrl}/approvals`;
    const response = await secureApiClient.get(url, {
      headers: { 'X-Request-ID': generateRequestId(), 'X-Security-Context': 'approval-list' }
    });
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch approvals:', error);
    throw handleApiError(error, 'Failed to fetch approvals');
  }
}

export async function submitForApproval(
  policyId: string, version: number, approvers: string[], message?: string
): Promise<PolicyApproval> {
  try {
    const response = await secureApiClient.post(`${baseUrl}/${policyId}/approvals`, {
      version, approvers, message,
      securityContext: { requireMultiFactor: true, encryptComments: true, auditTrail: true }
    }, {
      headers: { 'X-Request-ID': generateRequestId(), 'X-Security-Context': 'approval-submit', 'X-Content-Type': 'application/json' }
    });
    const data = await response.json();
    auditLog('approval_submitted', { policyId, version, approvers: approvers.length });
    return data;
  } catch (error) {
    console.error('Failed to submit for approval:', error);
    throw handleApiError(error, 'Failed to submit for approval');
  }
}

export async function reviewApproval(
  approvalId: string, decision: 'approve' | 'reject' | 'request_changes',
  comment?: string, conditions?: string[]
): Promise<PolicyApproval> {
  try {
    const response = await secureApiClient.put(`${baseUrl}/approvals/${approvalId}`, {
      decision, comment, conditions,
      securityContext: { requireSignature: true, timestampSignature: true, nonRepudiation: true }
    }, {
      headers: { 'X-Request-ID': generateRequestId(), 'X-Security-Context': 'approval-review', 'X-Content-Type': 'application/json' }
    });
    const data = await response.json();
    auditLog('approval_reviewed', { approvalId, decision, hasComment: !!comment });
    return data;
  } catch (error) {
    console.error('Failed to review approval:', error);
    throw handleApiError(error, 'Failed to review approval');
  }
}

export async function getTemplates(category?: string): Promise<PolicyTemplate[]> {
  const cacheKey = `policy-templates:${category || 'all'}`;
  const cached = secureCache.get(cacheKey);
  if (cached) return cached;

  try {
    const response = await secureApiClient.get(`${baseUrl}/templates`, {
      params: category ? { category } : {},
      headers: { 'X-Request-ID': generateRequestId(), 'X-Security-Context': 'template-list' }
    });
    const data = await response.json();
    secureCache.set(cacheKey, data, 10 * 60 * 1000);
    return data;
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    throw handleApiError(error, 'Failed to fetch templates');
  }
}

export async function createFromTemplate(
  templateId: string, parameters: Record<string, any>, customizations: Partial<CreatePolicyRequest>
): Promise<Policy> {
  try {
    const response = await secureApiClient.post(`${baseUrl}/templates/${templateId}/create`, {
      parameters, ...customizations,
      securityContext: { validateParameters: true, sanitizeInput: true, requireApproval: true }
    }, {
      headers: { 'X-Request-ID': generateRequestId(), 'X-Security-Context': 'template-create', 'X-Content-Type': 'application/json' }
    });
    const data = await response.json();
    invalidatePolicyCache();
    auditLog('policy_created_from_template', { templateId, policyId: data.id });
    return data;
  } catch (error) {
    console.error('Failed to create policy from template:', error);
    throw handleApiError(error, 'Failed to create policy from template');
  }
}

export async function exportPolicies(
  policyIds: string[], format: 'json' | 'yaml' | 'rego' = 'json', includeVersions = false
): Promise<Blob> {
  try {
    const response = await secureApiClient.post(`${baseUrl}/export`, {
      policyIds, format, includeVersions,
      securityContext: { encryptExport: true, signExport: true, watermarkExport: true }
    }, {
      headers: { 'X-Request-ID': generateRequestId(), 'X-Security-Context': 'policy-export', 'X-Content-Type': 'application/json' }
    });
    auditLog('policies_exported', { count: policyIds.length, format, includeVersions });
    return await response.blob();
  } catch (error) {
    console.error('Failed to export policies:', error);
    throw handleApiError(error, 'Failed to export policies');
  }
}

export async function importPolicies(
  file: File, options: { overwrite?: boolean; validateBeforeImport?: boolean; requireApproval?: boolean } = {}
): Promise<{ imported: Policy[]; errors: string[] }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('options', JSON.stringify({
    ...options,
    securityContext: { sanitizeImport: true, validateSecurity: true, scanMalware: true, checkSignatures: true }
  }));

  try {
    const response = await secureApiClient.post(`${baseUrl}/import`, formData, {
      headers: { 'X-Request-ID': generateRequestId(), 'X-Security-Context': 'policy-import' }
    });
    const data = await response.json();
    invalidatePolicyCache();
    auditLog('policies_imported', { fileName: file.name, fileSize: file.size, imported: data.imported.length, errors: data.errors.length });
    return data;
  } catch (error) {
    console.error('Failed to import policies:', error);
    throw handleApiError(error, 'Failed to import policies');
  }
}
