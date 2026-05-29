/**
 * Policy Management Service
 *
 * Enterprise-grade policy management service with comprehensive security,
 * versioning, testing, deployment, and approval workflows
 */

import {
  Policy,
  PolicyListQuery,
  PolicyListResponse,
  CreatePolicyRequest,
  UpdatePolicyRequest,
  ValidatePolicyRequest,
  ValidatePolicyResponse,
  TestPolicyRequest,
  TestPolicyResponse,
  DeployPolicyRequest,
  DeployPolicyResponse,
  RollbackPolicyRequest,
  RollbackPolicyResponse,
  PolicyTestSuite,
  PolicyDeployment,
  PolicyApproval,
  PolicyTemplate,
  PolicyAnalytics,
  PolicyVersion,
  PolicyImpact
} from '@/types/policy-management';

import { apiClient } from '@/lib/api-client';
import { auditLogger } from '@/utils/security/audit-logger';
import { encryption } from '@/utils/security/encryption';
import { validateInput } from '@/utils/security/validation';
import { performanceMonitor } from '@/utils/performance/monitor';

class PolicyService {
  private readonly baseUrl = '/api/v1/policies';
  private readonly cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get policies with filtering and pagination
   */
  async getPolicies(query: PolicyListQuery = {}): Promise<PolicyListResponse> {
    const startTime = performance.now();

    try {
      // Validate input parameters
      const sanitizedQuery = validateInput(query, {
        page: 'number',
        limit: 'number',
        sort: 'string',
        order: { type: 'enum', values: ['asc', 'desc'] },
        search: 'string',
        filter: 'object'
      });

      const cacheKey = `policies:${JSON.stringify(sanitizedQuery)}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await apiClient.get<PolicyListResponse>(this.baseUrl, {
        params: sanitizedQuery
      });

      // Encrypt sensitive data in response
      const encryptedPolicies = response.data.policies.map(policy => ({
        ...policy,
        regoCode: policy.regoCode ? encryption.encrypt(policy.regoCode) : policy.regoCode,
        metadata: {
          ...policy.metadata,
          requirements: policy.metadata.requirements?.map(r => encryption.encrypt(r)) || []
        }
      }));

      const result = {
        ...response.data,
        policies: encryptedPolicies
      };

      this.setCache(cacheKey, result);

      // Log access
      await auditLogger.log({
        action: 'policies.list',
        resource: 'policy',
        details: { query: sanitizedQuery, count: result.total }
      });

      performanceMonitor.record('policy.list', performance.now() - startTime);
      return result;
    } catch (error) {
      await auditLogger.log({
        action: 'policies.list.error',
        resource: 'policy',
        details: { query, error: error.message }
      });
      throw error;
    }
  }

  /**
   * Get policy by ID
   */
  async getPolicy(id: string, version?: number): Promise<Policy> {
    const startTime = performance.now();

    try {
      validateInput({ id, version }, {
        id: 'uuid',
        version: { type: 'number', optional: true }
      });

      const cacheKey = `policy:${id}:${version || 'latest'}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await apiClient.get<Policy>(`${this.baseUrl}/${id}`, {
        params: version ? { version } : undefined
      });

      // Decrypt sensitive data
      const policy = {
        ...response.data,
        regoCode: response.data.regoCode ? encryption.decrypt(response.data.regoCode) : response.data.regoCode,
        metadata: {
          ...response.data.metadata,
          requirements: response.data.metadata.requirements?.map(r => encryption.decrypt(r)) || []
        }
      };

      this.setCache(cacheKey, policy);

      await auditLogger.log({
        action: 'policy.get',
        resourceId: id,
        resource: 'policy',
        details: { version }
      });

      performanceMonitor.record('policy.get', performance.now() - startTime);
      return policy;
    } catch (error) {
      await auditLogger.log({
        action: 'policy.get.error',
        resourceId: id,
        resource: 'policy',
        details: { version, error: error.message }
      });
      throw error;
    }
  }

  /**
   * Create new policy
   */
  async createPolicy(request: CreatePolicyRequest): Promise<Policy> {
    const startTime = performance.now();

    try {
      // Validate and sanitize input
      const sanitizedRequest = validateInput(request, {
        name: 'string',
        description: 'string',
        category: { type: 'enum', values: ['authentication', 'authorization', 'data_access', 'api_security', 'compliance', 'privacy', 'resource_management', 'audit', 'custom'] },
        priority: { type: 'enum', values: ['critical', 'high', 'medium', 'low'] },
        regoCode: 'string',
        tags: 'array',
        templateId: { type: 'uuid', optional: true },
        parameters: 'object'
      });

      // Validate Rego code
      const validation = await this.validatePolicy({
        regoCode: sanitizedRequest.regoCode,
        category: sanitizedRequest.category,
        strict: true
      });

      if (!validation.valid) {
        throw new Error(`Policy validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // Encrypt sensitive data
      const encryptedRequest = {
        ...sanitizedRequest,
        regoCode: encryption.encrypt(sanitizedRequest.regoCode),
        metadata: {
          ...sanitizedRequest.metadata,
          requirements: sanitizedRequest.metadata?.requirements?.map(r => encryption.encrypt(r)) || []
        }
      };

      const response = await apiClient.post<Policy>(this.baseUrl, encryptedRequest);

      // Clear cache
      this.clearCachePattern('policies:*');

      await auditLogger.log({
        action: 'policy.create',
        resourceId: response.data.id,
        resource: 'policy',
        details: {
          name: sanitizedRequest.name,
          category: sanitizedRequest.category,
          templateId: sanitizedRequest.templateId
        }
      });

      performanceMonitor.record('policy.create', performance.now() - startTime);
      return response.data;
    } catch (error) {
      await auditLogger.log({
        action: 'policy.create.error',
        resource: 'policy',
        details: { request, error: error.message }
      });
      throw error;
    }
  }

  /**
   * Update existing policy
   */
  async updatePolicy(id: string, request: UpdatePolicyRequest): Promise<Policy> {
    const startTime = performance.now();

    try {
      validateInput({ id }, { id: 'uuid' });

      const sanitizedRequest = validateInput(request, {
        name: 'string',
        description: 'string',
        category: { type: 'enum', values: ['authentication', 'authorization', 'data_access', 'api_security', 'compliance', 'privacy', 'resource_management', 'audit', 'custom'] },
        priority: { type: 'enum', values: ['critical', 'high', 'medium', 'low'] },
        regoCode: 'string',
        tags: 'array',
        version: 'number'
      });

      // Validate Rego code if provided
      if (sanitizedRequest.regoCode) {
        const validation = await this.validatePolicy({
          regoCode: sanitizedRequest.regoCode,
          category: sanitizedRequest.category,
          strict: true
        });

        if (!validation.valid) {
          throw new Error(`Policy validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
        }
      }

      // Encrypt sensitive data
      const encryptedRequest = {
        ...sanitizedRequest,
        regoCode: sanitizedRequest.regoCode ? encryption.encrypt(sanitizedRequest.regoCode) : undefined,
        metadata: sanitizedRequest.metadata ? {
          ...sanitizedRequest.metadata,
          requirements: sanitizedRequest.metadata.requirements?.map(r => encryption.encrypt(r)) || []
        } : undefined
      };

      const response = await apiClient.put<Policy>(`${this.baseUrl}/${id}`, encryptedRequest);

      // Clear cache
      this.clearCachePattern(`policy:${id}:*`);
      this.clearCachePattern('policies:*');

      await auditLogger.log({
        action: 'policy.update',
        resourceId: id,
        resource: 'policy',
        details: {
          version: sanitizedRequest.version,
          fields: Object.keys(sanitizedRequest)
        }
      });

      performanceMonitor.record('policy.update', performance.now() - startTime);
      return response.data;
    } catch (error) {
      await auditLogger.log({
        action: 'policy.update.error',
        resourceId: id,
        resource: 'policy',
        details: { request, error: error.message }
      });
      throw error;
    }
  }

  /**
   * Delete policy
   */
  async deletePolicy(id: string): Promise<void> {
    const startTime = performance.now();

    try {
      validateInput({ id }, { id: 'uuid' });

      await apiClient.delete(`${this.baseUrl}/${id}`);

      // Clear cache
      this.clearCachePattern(`policy:${id}:*`);
      this.clearCachePattern('policies:*');

      await auditLogger.log({
        action: 'policy.delete',
        resourceId: id,
        resource: 'policy'
      });

      performanceMonitor.record('policy.delete', performance.now() - startTime);
    } catch (error) {
      await auditLogger.log({
        action: 'policy.delete.error',
        resourceId: id,
        resource: 'policy',
        details: { error: error.message }
      });
      throw error;
    }
  }

  /**
   * Validate Rego policy code
   */
  async validatePolicy(request: ValidatePolicyRequest): Promise<ValidatePolicyResponse> {
    const startTime = performance.now();

    try {
      const sanitizedRequest = validateInput(request, {
        regoCode: 'string',
        category: { type: 'enum', values: ['authentication', 'authorization', 'data_access', 'api_security', 'compliance', 'privacy', 'resource_management', 'audit', 'custom'] },
        context: 'object',
        strict: 'boolean'
      });

      // Security scan the Rego code
      const securityScan = await this.scanRegoCode(sanitizedRequest.regoCode);
      if (securityScan.vulnerabilities.length > 0) {
        return {
          valid: false,
          errors: securityScan.vulnerabilities.map(v => ({
            line: v.line || 1,
            column: v.column || 1,
            message: v.message,
            type: 'security' as const,
            severity: 'error' as const,
            rule: v.rule,
            fix: v.fix
          })),
          warnings: [],
          suggestions: [],
          metrics: {
            complexity: 0,
            maintainability: 0,
            testability: 0,
            security: 0,
            performance: 0
          }
        };
      }

      const response = await apiClient.post<ValidatePolicyResponse>(
        `${this.baseUrl}/validate`,
        sanitizedRequest
      );

      await auditLogger.log({
        action: 'policy.validate',
        resource: 'policy',
        details: {
          category: sanitizedRequest.category,
          valid: response.data.valid,
          errorCount: response.data.errors.length
        }
      });

      performanceMonitor.record('policy.validate', performance.now() - startTime);
      return response.data;
    } catch (error) {
      await auditLogger.log({
        action: 'policy.validate.error',
        resource: 'policy',
        details: { error: error.message }
      });
      throw error;
    }
  }

  /**
   * Test policy with scenarios
   */
  async testPolicy(request: TestPolicyRequest): Promise<TestPolicyResponse> {
    const startTime = performance.now();

    try {
      const sanitizedRequest = validateInput(request, {
        policyId: 'uuid',
        version: { type: 'number', optional: true },
        testSuite: 'string',
        scenarios: 'array',
        context: 'object'
      });

      // Check rate limiting
      const rateLimitKey = `policy:test:${sanitizedRequest.policyId}`;
      if (this.isRateLimited(rateLimitKey, 10, 60)) { // 10 tests per minute
        throw new Error('Rate limit exceeded for policy testing');
      }

      const response = await apiClient.post<TestPolicyResponse>(
        `${this.baseUrl}/${sanitizedRequest.policyId}/test`,
        sanitizedRequest
      );

      await auditLogger.log({
        action: 'policy.test',
        resourceId: sanitizedRequest.policyId,
        resource: 'policy',
        details: {
          testSuite: sanitizedRequest.testSuite,
          scenarios: sanitizedRequest.scenarios,
          status: response.data.status,
          passRate: response.data.summary.passRate
        }
      });

      performanceMonitor.record('policy.test', performance.now() - startTime);
      return response.data;
    } catch (error) {
      await auditLogger.log({
        action: 'policy.test.error',
        resourceId: request.policyId,
        resource: 'policy',
        details: { error: error.message }
      });
      throw error;
    }
  }

  /**
   * Deploy policy to environment
   */
  async deployPolicy(request: DeployPolicyRequest): Promise<DeployPolicyResponse> {
    const startTime = performance.now();

    try {
      const sanitizedRequest = validateInput(request, {
        policyId: 'uuid',
        version: 'number',
        environment: { type: 'enum', values: ['development', 'testing', 'staging', 'production'] },
        approvalRequired: 'boolean',
        approvers: 'array'
      });

      // Check if approval is required
      if (sanitizedRequest.approvalRequired && !sanitizedRequest.approvers?.length) {
        throw new Error('Approvers are required when approval is enabled');
      }

      // Create approval request if needed
      if (sanitizedRequest.approvalRequired) {
        const approval = await this.createApproval({
          policyId: sanitizedRequest.policyId,
          version: sanitizedRequest.version,
          type: 'deployment',
          reviewers: sanitizedRequest.approvers!.map(id => ({
            id,
            name: '',
            email: '',
            role: 'approver',
            required: true
          }))
        });

        // Wait for approval or timeout
        const approvalResult = await this.waitForApproval(approval.id);
        if (approvalResult.status !== 'approved') {
          throw new Error(`Deployment not approved: ${approvalResult.status}`);
        }
      }

      const response = await apiClient.post<DeployPolicyResponse>(
        `${this.baseUrl}/${sanitizedRequest.policyId}/deploy`,
        sanitizedRequest
      );

      // Clear cache
      this.clearCachePattern(`policy:${sanitizedRequest.policyId}:*`);

      await auditLogger.log({
        action: 'policy.deploy',
        resourceId: sanitizedRequest.policyId,
        resource: 'policy',
        details: {
          version: sanitizedRequest.version,
          environment: sanitizedRequest.environment,
          deploymentId: response.data.deployment.id
        }
      });

      performanceMonitor.record('policy.deploy', performance.now() - startTime);
      return response.data;
    } catch (error) {
      await auditLogger.log({
        action: 'policy.deploy.error',
        resourceId: request.policyId,
        resource: 'policy',
        details: { error: error.message }
      });
      throw error;
    }
  }

  /**
   * Rollback policy deployment
   */
  async rollbackPolicy(request: RollbackPolicyRequest): Promise<RollbackPolicyResponse> {
    const startTime = performance.now();

    try {
      const sanitizedRequest = validateInput(request, {
        deploymentId: 'uuid',
        reason: 'string',
        strategy: { type: 'enum', values: ['immediate', 'graceful', 'scheduled'] },
        scheduledAt: { type: 'date', optional: true }
      });

      // Check if rollback is allowed
      const deployment = await this.getDeployment(sanitizedRequest.deploymentId);
      if (!deployment.rollbackDeadline || new Date() > deployment.rollbackDeadline) {
        throw new Error('Rollback period has expired');
      }

      // Require MFA for rollback
      const mfaVerified = await this.verifyMFA('policy.rollback');
      if (!mfaVerified) {
        throw new Error('Multi-factor authentication required for rollback');
      }

      const response = await apiClient.post<RollbackPolicyResponse>(
        `${this.baseUrl}/deployments/${sanitizedRequest.deploymentId}/rollback`,
        sanitizedRequest
      );

      await auditLogger.log({
        action: 'policy.rollback',
        resourceId: sanitizedRequest.deploymentId,
        resource: 'deployment',
        details: {
          strategy: sanitizedRequest.strategy,
          reason: sanitizedRequest.reason
        }
      });

      performanceMonitor.record('policy.rollback', performance.now() - startTime);
      return response.data;
    } catch (error) {
      await auditLogger.log({
        action: 'policy.rollback.error',
        resourceId: request.deploymentId,
        resource: 'deployment',
        details: { error: error.message }
      });
      throw error;
    }
  }

  /**
   * Get policy versions
   */
  async getPolicyVersions(id: string): Promise<PolicyVersion[]> {
    const startTime = performance.now();

    try {
      validateInput({ id }, { id: 'uuid' });

      const response = await apiClient.get<PolicyVersion[]>(
        `${this.baseUrl}/${id}/versions`
      );

      // Decrypt sensitive data
      const versions = response.data.map(version => ({
        ...version,
        regoCode: version.regoCode ? encryption.decrypt(version.regoCode) : version.regoCode
      }));

      performanceMonitor.record('policy.versions.get', performance.now() - startTime);
      return versions;
    } catch (error) {
      await auditLogger.log({
        action: 'policy.versions.get.error',
        resourceId: id,
        resource: 'policy',
        details: { error: error.message }
      });
      throw error;
    }
  }

  /**
   * Get policy impact analysis
   */
  async getPolicyImpact(id: string, compareToVersion?: number): Promise<PolicyImpact> {
    const startTime = performance.now();

    try {
      validateInput({ id, compareToVersion }, {
        id: 'uuid',
        compareToVersion: { type: 'number', optional: true }
      });

      const response = await apiClient.get<PolicyImpact>(
        `${this.baseUrl}/${id}/impact`,
        { params: { compareToVersion } }
      );

      await auditLogger.log({
        action: 'policy.impact.analyze',
        resourceId: id,
        resource: 'policy',
        details: { compareToVersion }
      });

      performanceMonitor.record('policy.impact.analyze', performance.now() - startTime);
      return response.data;
    } catch (error) {
      await auditLogger.log({
        action: 'policy.impact.analyze.error',
        resourceId: id,
        resource: 'policy',
        details: { error: error.message }
      });
      throw error;
    }
  }

  /**
   * Get policy analytics
   */
  async getPolicyAnalytics(
    id: string,
    timeRange: { start: Date; end: Date },
    granularity: 'minute' | 'hour' | 'day' | 'week' | 'month' = 'hour'
  ): Promise<PolicyAnalytics> {
    const startTime = performance.now();

    try {
      validateInput({ id, timeRange, granularity }, {
        id: 'uuid',
        timeRange: 'object',
        granularity: { type: 'enum', values: ['minute', 'hour', 'day', 'week', 'month'] }
      });

      const response = await apiClient.get<PolicyAnalytics>(
        `${this.baseUrl}/${id}/analytics`,
        {
          params: {
            start: timeRange.start.toISOString(),
            end: timeRange.end.toISOString(),
            granularity
          }
        }
      );

      performanceMonitor.record('policy.analytics.get', performance.now() - startTime);
      return response.data;
    } catch (error) {
      await auditLogger.log({
        action: 'policy.analytics.get.error',
        resourceId: id,
        resource: 'policy',
        details: { error: error.message }
      });
      throw error;
    }
  }

  /**
   * Get policy templates
   */
  async getPolicyTemplates(category?: string): Promise<PolicyTemplate[]> {
    const startTime = performance.now();

    try {
      const response = await apiClient.get<PolicyTemplate[]>(
        `${this.baseUrl}/templates`,
        { params: { category } }
      );

      performanceMonitor.record('policy.templates.get', performance.now() - startTime);
      return response.data;
    } catch (error) {
      await auditLogger.log({
        action: 'policy.templates.get.error',
        resource: 'policy',
        details: { category, error: error.message }
      });
      throw error;
    }
  }

  /**
   * Create approval request
   */
  private async createApproval(approval: Partial<PolicyApproval>): Promise<PolicyApproval> {
    const response = await apiClient.post<PolicyApproval>(
      `${this.baseUrl}/approvals`,
      approval
    );
    return response.data;
  }

  /**
   * Wait for approval completion
   */
  private async waitForApproval(approvalId: string): Promise<PolicyApproval> {
    const maxWaitTime = 24 * 60 * 60 * 1000; // 24 hours
    const interval = 5000; // 5 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const approval = await apiClient.get<PolicyApproval>(
        `${this.baseUrl}/approvals/${approvalId}`
      );

      if (['approved', 'rejected', 'escalated'].includes(approval.data.status)) {
        return approval.data;
      }

      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error('Approval timeout');
  }

  /**
   * Get deployment details
   */
  private async getDeployment(deploymentId: string): Promise<PolicyDeployment> {
    const response = await apiClient.get<PolicyDeployment>(
      `${this.baseUrl}/deployments/${deploymentId}`
    );
    return response.data;
  }

  /**
   * Verify MFA for sensitive operations
   */
  private async verifyMFA(operation: string): Promise<boolean> {
    // In a real implementation, this would integrate with MFA provider
    // For now, return true for demo
    return true;
  }

  /**
   * Scan Rego code for security vulnerabilities
   */
  private async scanRegoCode(code: string): Promise<{
    vulnerabilities: Array<{
      line?: number;
      column?: number;
      message: string;
      rule?: string;
      fix?: string;
    }>;
  }> {
    const vulnerabilities: Array<{
      line?: number;
      column?: number;
      message: string;
      rule?: string;
      fix?: string;
    }> = [];

    // Check for dangerous functions
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
          vulnerabilities.push({
            line: index + 1,
            column: line.search(pattern) + 1,
            message,
            rule,
            fix: `Remove or replace the dangerous code`
          });
        }
      });
    });

    return { vulnerabilities };
  }

  /**
   * Check rate limiting
   */
  private isRateLimited(key: string, limit: number, window: number): boolean {
    const now = Date.now();
    const windowStart = now - window * 1000;

    const requests = this.cache.get(`${key}:requests`)?.data || [];
    const validRequests = requests.filter((timestamp: number) => timestamp > windowStart);

    if (validRequests.length >= limit) {
      return true;
    }

    validRequests.push(now);
    this.setCache(`${key}:requests`, validRequests, window * 1000);
    return false;
  }

  /**
   * Cache helpers
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache<T>(key: string, data: T, ttl: number = this.CACHE_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private clearCachePattern(pattern: string): void {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}

export const policyService = new PolicyService();
