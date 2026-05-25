// @ts-nocheck
/**
 * Policy testing and validation operations
 */

import {
  ValidatePolicyRequest,
  ValidatePolicyResponse,
  TestPolicyRequest,
  TestPolicyResponse,
  PolicyTestSuite,
} from '@/types/policy-management';

import { secureApiClient } from '@/utils/security/secure-api';
import { generateRequestId, handleApiError, auditLog } from '../helpers/request-helpers';

const baseUrl = '/api/v1/policies';

export async function validatePolicy(request: ValidatePolicyRequest): Promise<ValidatePolicyResponse> {
  try {
    const response = await secureApiClient.post(`${baseUrl}/validate`, {
      ...request,
      securityContext: { sanitizeInput: true, checkVulnerabilities: true, enforceStandards: true }
    }, {
      headers: { 'X-Request-ID': generateRequestId(), 'X-Security-Context': 'policy-validation', 'X-Content-Type': 'application/json' }
    });
    const data = await response.json();
    auditLog('policy_validated', { errors: data.errors?.length || 0, warnings: data.warnings?.length || 0 });
    return data;
  } catch (error) {
    console.error('Failed to validate policy:', error);
    throw handleApiError(error, 'Failed to validate policy');
  }
}

export async function testPolicy(request: TestPolicyRequest): Promise<TestPolicyResponse> {
  try {
    const response = await secureApiClient.post(`${baseUrl}/${request.policyId}/test`, {
      ...request,
      securityContext: { sandboxExecution: true, resourceLimits: { memory: 256, cpu: 0.5, duration: 30000 }, isolationLevel: 'strict' }
    }, {
      headers: { 'X-Request-ID': generateRequestId(), 'X-Security-Context': 'policy-testing', 'X-Content-Type': 'application/json' }
    });
    const data = await response.json();
    auditLog('policy_tested', { policyId: request.policyId, testRun: data.testRun, status: data.status, duration: data.summary?.duration || 0 });
    return data;
  } catch (error) {
    console.error('Failed to test policy:', error);
    throw handleApiError(error, 'Failed to test policy');
  }
}

export async function getTestSuites(policyId?: string): Promise<PolicyTestSuite[]> {
  try {
    const url = policyId ? `${baseUrl}/${policyId}/test-suites` : `${baseUrl}/test-suites`;
    const response = await secureApiClient.get(url, {
      headers: { 'X-Request-ID': generateRequestId(), 'X-Security-Context': 'test-suite-list' }
    });
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch test suites:', error);
    throw handleApiError(error, 'Failed to fetch test suites');
  }
}

export async function runTestSuite(
  policyId: string,
  testSuiteId: string,
  scenarios?: string[]
): Promise<TestPolicyResponse> {
  try {
    const response = await secureApiClient.post(
      `${baseUrl}/${policyId}/test-suites/${testSuiteId}/run`,
      { scenarios, securityContext: { sandboxExecution: true, isolateTests: true, limitResources: true } },
      { headers: { 'X-Request-ID': generateRequestId(), 'X-Security-Context': 'test-execution', 'X-Content-Type': 'application/json' } }
    );
    const data = await response.json();
    auditLog('test_suite_executed', { policyId, testSuiteId, scenarioCount: scenarios?.length || 0 });
    return data;
  } catch (error) {
    console.error('Failed to run test suite:', error);
    throw handleApiError(error, 'Failed to run test suite');
  }
}
