// @ts-nocheck
/**
 * Policy validation, testing, deployment for PolicyManagementService
 */

import { apiClient } from '@/lib/api-client';
import {
  ValidatePolicyRequest,
  ValidatePolicyResponse,
  TestPolicyRequest,
  TestPolicyResponse,
  DeployPolicyRequest,
  DeployPolicyResponse,
  RollbackPolicyRequest,
  RollbackPolicyResponse,
  PolicyDeployment,
} from '@/types/policy-management';
import { secureLog, sanitizeInput } from '@/utils/security/audit-logger';
import { encryptData } from '@/utils/security/encryption';
import { validateInput } from '@/utils/security/validation';
import {
  sanitizeTestContext,
  canTestPolicy,
  canDeployPolicy,
  canRollbackDeployment,
  handleServiceError,
} from '../helpers/policy-helpers';
import { performClientValidation } from '../helpers/client-validation';
import { getPolicy } from './pm-crud';

const baseUrl = '/api/v1/policies';
const testingUrl = '/api/v1/policy-testing';
const deploymentUrl = '/api/v1/policy-deployments';

export async function validatePolicy(request: ValidatePolicyRequest): Promise<ValidatePolicyResponse> {
  try {
    const sanitizedCode = sanitizeInput(request.regoCode);
    const clientValidation = await performClientValidation(sanitizedCode, request.category);
    const response = await apiClient.post<ValidatePolicyResponse>(`${baseUrl}/validate`, { ...request, regoCode: sanitizedCode });
    const validationResponse = {
      ...response.data,
      errors: [...clientValidation.errors, ...response.data.errors],
      warnings: [...clientValidation.warnings, ...response.data.warnings]
    };
    await secureLog('INFO', 'Policy validated', { valid: validationResponse.valid, errorCount: validationResponse.errors.length, warningCount: validationResponse.warnings.length, category: request.category });
    return validationResponse;
  } catch (error) {
    await secureLog('ERROR', 'Failed to validate policy', { error });
    throw handleServiceError(error);
  }
}

export async function testPolicy(request: TestPolicyRequest): Promise<TestPolicyResponse> {
  try {
    if (!validateInput(request.policyId, 'uuid')) throw new Error('Invalid policy ID format');
    const policy = await getPolicy(request.policyId);
    if (!canTestPolicy(policy)) throw new Error('Insufficient permissions to test this policy');
    const sanitizedRequest = { ...request, context: request.context ? sanitizeTestContext(request.context) : undefined };
    const response = await apiClient.post<TestPolicyResponse>(`${testingUrl}/run`, sanitizedRequest);
    await secureLog('INFO', 'Policy test completed', { policyId: request.policyId, testRun: response.data.testRun, status: response.data.status, totalTests: response.data.summary.total, passRate: response.data.summary.passRate });
    return response.data;
  } catch (error) {
    await secureLog('ERROR', 'Failed to test policy', { error, policyId: request.policyId });
    throw handleServiceError(error);
  }
}

export async function getTestResults(testRunId: string): Promise<TestPolicyResponse> {
  try {
    const response = await apiClient.get<TestPolicyResponse>(`${testingUrl}/results/${testRunId}`);
    return response.data;
  } catch (error) {
    await secureLog('ERROR', 'Failed to get test results', { error, testRunId });
    throw handleServiceError(error);
  }
}

export async function deployPolicy(request: DeployPolicyRequest): Promise<DeployPolicyResponse> {
  try {
    if (!validateInput(request.policyId, 'uuid')) throw new Error('Invalid policy ID format');
    const policy = await getPolicy(request.policyId);
    if (!canDeployPolicy(policy, request.environment)) throw new Error('Policy must be tested and approved before deployment');
    const encryptedConfig = request.config ? await encryptData(JSON.stringify(request.config)) : undefined;
    const response = await apiClient.post<DeployPolicyResponse>(`${deploymentUrl}/deploy`, { ...request, config: encryptedConfig });
    await secureLog('INFO', 'Policy deployment initiated', { policyId: request.policyId, version: request.version, environment: request.environment, deploymentId: response.data.deployment.id, strategy: request.config?.strategy || 'immediate' });
    return response.data;
  } catch (error) {
    await secureLog('ERROR', 'Failed to deploy policy', { error, policyId: request.policyId, environment: request.environment });
    throw handleServiceError(error);
  }
}

export async function rollbackPolicy(request: RollbackPolicyRequest): Promise<RollbackPolicyResponse> {
  try {
    if (!validateInput(request.deploymentId, 'uuid')) throw new Error('Invalid deployment ID format');
    const deployment = await getDeployment(request.deploymentId);
    if (!canRollbackDeployment(deployment)) throw new Error('Rollback not allowed for this deployment');
    const sanitizedReason = sanitizeInput(request.reason);
    const response = await apiClient.post<RollbackPolicyResponse>(`${deploymentUrl}/rollback`, { ...request, reason: sanitizedReason });
    await secureLog('WARN', 'Policy rollback initiated', { deploymentId: request.deploymentId, reason: sanitizedReason, strategy: request.strategy, rollbackId: response.data.rollback.id });
    return response.data;
  } catch (error) {
    await secureLog('ERROR', 'Failed to rollback policy', { error, deploymentId: request.deploymentId });
    throw handleServiceError(error);
  }
}

export async function getDeployment(id: string): Promise<PolicyDeployment> {
  try {
    const response = await apiClient.get<PolicyDeployment>(`${deploymentUrl}/${id}`);
    return response.data;
  } catch (error) {
    await secureLog('ERROR', 'Failed to get deployment', { error, deploymentId: id });
    throw handleServiceError(error);
  }
}

export async function listDeployments(policyId?: string): Promise<PolicyDeployment[]> {
  try {
    const response = await apiClient.get<PolicyDeployment[]>(deploymentUrl, { params: policyId ? { policyId } : undefined });
    return response.data;
  } catch (error) {
    await secureLog('ERROR', 'Failed to list deployments', { error, policyId });
    throw handleServiceError(error);
  }
}
