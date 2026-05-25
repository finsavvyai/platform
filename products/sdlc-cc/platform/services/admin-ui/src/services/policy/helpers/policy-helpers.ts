// @ts-nocheck
/**
 * Private helper methods for PolicyManagementService
 */

import { Policy, UpdatePolicyRequest, PolicyDeployment } from '@/types/policy-management';
import { sanitizeInput } from '@/utils/security/audit-logger';
import { encryptData, decryptData } from '@/utils/security/encryption';
import { CreatePolicyRequest } from '@/types/policy-management';

export async function sanitizePolicyRequest(request: CreatePolicyRequest): Promise<CreatePolicyRequest> {
  return {
    ...request,
    name: sanitizeInput(request.name),
    description: sanitizeInput(request.description),
    regoCode: sanitizeRegoCode(request.regoCode),
    tags: request.tags.map(tag => sanitizeInput(tag))
  };
}

export async function sanitizePolicyUpdateRequest(request: UpdatePolicyRequest): Promise<UpdatePolicyRequest> {
  const sanitized: UpdatePolicyRequest = {};
  if (request.name) sanitized.name = sanitizeInput(request.name);
  if (request.description) sanitized.description = sanitizeInput(request.description);
  if (request.regoCode) sanitized.regoCode = sanitizeRegoCode(request.regoCode);
  if (request.tags) sanitized.tags = request.tags.map(tag => sanitizeInput(tag));
  return sanitized;
}

export function sanitizeRegoCode(code: string): string {
  const dangerousPatterns = [
    /import\s+.*\s*http/gi,
    /http\.send/gi,
    /os\.exec/gi,
    /crypto\.random/gi
  ];
  let sanitized = code;
  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, '/* REMOVED */');
  }
  return sanitized;
}

export function sanitizeTestContext(context: any): any {
  const contextStr = JSON.stringify(context);
  const sanitized = sanitizeInput(contextStr);
  return JSON.parse(sanitized);
}

export async function encryptPolicyData(data: any): Promise<any> {
  const sensitiveFields = ['regoCode', 'metadata'];
  const encrypted = { ...data };
  for (const field of sensitiveFields) {
    if (encrypted[field]) {
      encrypted[field] = await encryptData(JSON.stringify(encrypted[field]));
    }
  }
  return encrypted;
}

export async function encryptPolicyUpdateData(data: UpdatePolicyRequest): Promise<UpdatePolicyRequest> {
  const encrypted = { ...data };
  if (encrypted.regoCode) {
    encrypted.regoCode = await encryptData(encrypted.regoCode);
  }
  return encrypted;
}

export function decryptPolicyData(policy: Policy): Policy {
  const sensitiveFields = ['regoCode', 'metadata'];
  const decrypted = { ...policy };
  for (const field of sensitiveFields) {
    if (decrypted[field]) {
      try {
        decrypted[field] = JSON.parse(decryptData(decrypted[field]));
      } catch {
        // If decryption fails, assume not encrypted (backward compat)
      }
    }
  }
  return decrypted;
}

export function getRequiredKeywords(category: string): string[] {
  const keywordMap: Record<string, string[]> = {
    authentication: ['allow', 'denied'],
    authorization: ['allow', 'denied'],
    data_access: ['allow', 'denied'],
    api_security: ['allow', 'denied'],
    compliance: ['violation', 'compliant'],
    privacy: ['allow', 'denied', 'pii'],
    resource_management: ['allow', 'denied'],
    audit: ['log', 'audit'],
    custom: []
  };
  return keywordMap[category] || [];
}

export function canUpdateDeployedPolicy(policy: Policy): boolean {
  return policy.status !== 'deployed' || hasAdminPrivileges();
}

export function canTestPolicy(policy: Policy): boolean {
  return true; // Would check actual permissions
}

export function canDeployPolicy(policy: Policy, environment: string): boolean {
  if (environment === 'production') {
    return policy.status === 'approved' && policy.lastTested && policy.approvalStatus === 'approved';
  }
  return policy.lastTested !== undefined;
}

export function canRollbackDeployment(deployment: PolicyDeployment): boolean {
  const now = new Date();
  const rollbackDeadline = deployment.rollbackDeadline;
  return deployment.status === 'deployment_failed' ||
    (rollbackDeadline && now < rollbackDeadline) ||
    hasAdminPrivileges();
}

export function hasAdminPrivileges(): boolean {
  return false;
}

export function handleServiceError(error: any): Error {
  if (error.response) {
    const status = error.response.status;
    const message = error.response.data?.message || error.message;
    switch (status) {
      case 400: return new Error(`Bad Request: ${message}`);
      case 401: return new Error('Authentication required');
      case 403: return new Error('Insufficient permissions');
      case 404: return new Error('Policy not found');
      case 409: return new Error(`Conflict: ${message}`);
      case 422: return new Error(`Validation Error: ${message}`);
      case 429: return new Error('Rate limit exceeded');
      case 500: return new Error('Internal server error');
      default: return new Error(`Error: ${message}`);
    }
  }
  return error;
}
