// @ts-nocheck
/**
 * PolicyService validation operations
 */

import { ValidatePolicyRequest, ValidatePolicyResponse } from '@/types/policy-management';
import { apiClient } from '@/lib/api-client';
import { auditLogger } from '@/utils/security/audit-logger';
import { validateInput } from '@/utils/security/validation';
import { performanceMonitor } from '@/utils/performance/monitor';

const baseUrl = '/api/v1/policies';

export async function validatePolicy(request: ValidatePolicyRequest): Promise<ValidatePolicyResponse> {
  const startTime = performance.now();
  try {
    const sanitizedRequest = validateInput(request, {
      regoCode: 'string',
      category: { type: 'enum', values: ['authentication', 'authorization', 'data_access', 'api_security', 'compliance', 'privacy', 'resource_management', 'audit', 'custom'] },
      context: 'object', strict: 'boolean'
    });

    const securityScan = await scanRegoCode(sanitizedRequest.regoCode);
    if (securityScan.vulnerabilities.length > 0) {
      return {
        valid: false,
        errors: securityScan.vulnerabilities.map(v => ({
          line: v.line || 1, column: v.column || 1, message: v.message,
          type: 'security' as const, severity: 'error' as const, rule: v.rule, fix: v.fix
        })),
        warnings: [], suggestions: [],
        metrics: { complexity: 0, maintainability: 0, testability: 0, security: 0, performance: 0 }
      };
    }

    const response = await apiClient.post<ValidatePolicyResponse>(`${baseUrl}/validate`, sanitizedRequest);
    await auditLogger.log({ action: 'policy.validate', resource: 'policy', details: { category: sanitizedRequest.category, valid: response.data.valid, errorCount: response.data.errors.length } });
    performanceMonitor.record('policy.validate', performance.now() - startTime);
    return response.data;
  } catch (error) {
    await auditLogger.log({ action: 'policy.validate.error', resource: 'policy', details: { error: error.message } });
    throw error;
  }
}

async function scanRegoCode(code: string): Promise<{ vulnerabilities: Array<{ line?: number; column?: number; message: string; rule?: string; fix?: string }> }> {
  const vulnerabilities: Array<{ line?: number; column?: number; message: string; rule?: string; fix?: string }> = [];
  const dangerousPatterns = [
    { pattern: /http\.get/g, message: 'Use of HTTP requests in policy', rule: 'no-http-requests' },
    { pattern: /http\.post/g, message: 'Use of HTTP requests in policy', rule: 'no-http-requests' },
    { pattern: /opa\.runtime/g, message: 'Access to OPA runtime', rule: 'no-runtime-access' },
    { pattern: /trace\.print/g, message: 'Debug trace statements should be removed', rule: 'no-debug-statements' },
    { pattern: /eval\(/g, message: 'Use of eval function detected', rule: 'no-eval' },
    { pattern: /import\s+crypto/g, message: 'Crypto module import detected', rule: 'no-crypto-import' },
    { pattern: /os\./g, message: 'OS module access detected', rule: 'no-os-access' }
  ];
  const lines = code.split('\n');
  lines.forEach((line, index) => {
    dangerousPatterns.forEach(({ pattern, message, rule }) => {
      if (pattern.test(line)) {
        vulnerabilities.push({ line: index + 1, column: line.search(pattern) + 1, message, rule, fix: 'Remove or replace the dangerous code' });
      }
    });
  });
  return { vulnerabilities };
}
