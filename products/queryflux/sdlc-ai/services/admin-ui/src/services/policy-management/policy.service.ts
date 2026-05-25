/**
 * Policy Management Service
 *
 * Enterprise-grade policy management service with comprehensive security,
 * validation, testing, deployment, and approval workflows
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
  PolicyApproval,
  PolicyDeployment,
  PolicyTestResult,
  PolicyVersion,
  PolicyImpact,
  PolicyTemplate,
  PolicyAnalytics,
  PolicyTestSuite
} from '@/types/policy-management';

import {
  secureApiClient,
  withEncryption,
  withAuditLogging,
  withRateLimiting,
  secureCache
} from '@/utils/security/secure-api';

import { validateAndSanitize } from '@/utils/security/validation';
import { generateSecureChecksum } from '@/utils/security/crypto';

class PolicyManagementService {
  private baseUrl = '/api/v1/policies';
  private cache = new Map<string, any>();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  /**
   * List policies with filtering and pagination
   */
  async listPolicies(query: PolicyListQuery = {}): Promise<PolicyListResponse> {
    const cacheKey = `policies:list:${JSON.stringify(query)}`;
    const cached = secureCache.get(cacheKey);
    if (cached) return cached;

    try {
      const params = new URLSearchParams();
      if (query.page) params.append('page', query.page.toString());
      if (query.limit) params.append('limit', query.limit.toString());
      if (query.sort) params.append('sort', query.sort);
      if (query.order) params.append('order', query.order);
      if (query.search) params.append('search', query.search);
      if (query.filter) params.append('filter', JSON.stringify(query.filter));

      const response = await secureApiClient.get(`${this.baseUrl}?${params.toString()}`, {
        headers: {
          'X-Request-ID': this.generateRequestId(),
          'X-Security-Context': 'policy-list'
        }
      });

      const data = await response.json();
      secureCache.set(cacheKey, data, this.cacheTTL);

      return data;
    } catch (error) {
      console.error('Failed to fetch policies:', error);
      throw this.handleError(error, 'Failed to fetch policies');
    }
  }

  /**
   * Get a single policy by ID
   */
  async getPolicy(id: string, includeVersions = false): Promise<Policy> {
    const cacheKey = `policy:${id}:${includeVersions ? 'full' : 'basic'}`;
    const cached = secureCache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await secureApiClient.get(`${this.baseUrl}/${id}`, {
        headers: {
          'X-Request-ID': this.generateRequestId(),
          'X-Security-Context': 'policy-read',
          'X-Include-Versions': includeVersions.toString()
        }
      });

      const data = await response.json();
      secureCache.set(cacheKey, data, this.cacheTTL);

      return data;
    } catch (error) {
      console.error(`Failed to fetch policy ${id}:`, error);
      throw this.handleError(error, 'Failed to fetch policy');
    }
  }

  /**
   * Create a new policy
   */
  async createPolicy(request: CreatePolicyRequest): Promise<Policy> {
    // Validate and sanitize input
    const sanitized = await validateAndSanitize(request);

    // Generate checksum for integrity
    const checksum = await generateSecureChecksum(JSON.stringify(sanitized));

    try {
      const response = await secureApiClient.post(this.baseUrl, {
        ...sanitized,
        checksum,
        securityContext: {
          classification: 'internal',
          requireApproval: true,
          auditLog: true
        }
      }, {
        headers: {
          'X-Request-ID': this.generateRequestId(),
          'X-Security-Context': 'policy-create',
          'X-Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      // Clear cache
      this.invalidatePolicyCache();

      // Log creation
      this.auditLog('policy_created', {
        policyId: data.id,
        policyName: request.name,
        category: request.category
      });

      return data;
    } catch (error) {
      console.error('Failed to create policy:', error);
      throw this.handleError(error, 'Failed to create policy');
    }
  }

  /**
   * Update an existing policy
   */
  async updatePolicy(id: string, request: UpdatePolicyRequest): Promise<Policy> {
    // Validate and sanitize input
    const sanitized = await validateAndSanitize(request);

    // Check for conflicts
    const current = await this.getPolicy(id);
    if (current.version !== request.version) {
      throw new Error('Policy has been modified by another user. Please refresh and try again.');
    }

    // Generate checksum for integrity
    const checksum = await generateSecureChecksum(JSON.stringify(sanitized));

    try {
      const response = await secureApiClient.put(`${this.baseUrl}/${id}`, {
        ...sanitized,
        checksum,
        expectedVersion: current.version,
        securityContext: {
          classification: current.securityContext.classification,
          requireApproval: true,
          auditLog: true
        }
      }, {
        headers: {
          'X-Request-ID': this.generateRequestId(),
          'X-Security-Context': 'policy-update',
          'X-Content-Type': 'application/json',
          'If-Match': current.version.toString()
        }
      });

      const data = await response.json();

      // Clear cache
      this.invalidatePolicyCache(id);

      // Log update
      this.auditLog('policy_updated', {
        policyId: id,
        changes: this.getChanges(current, sanitized)
      });

      return data;
    } catch (error) {
      console.error(`Failed to update policy ${id}:`, error);
      throw this.handleError(error, 'Failed to update policy');
    }
  }

  /**
   * Delete a policy
   */
  async deletePolicy(id: string): Promise<void> {
    // Check dependencies
    const policy = await this.getPolicy(id);
    if (policy.dependencies.length > 0) {
      throw new Error('Cannot delete policy with active dependencies. Remove dependencies first.');
    }

    try {
      await secureApiClient.delete(`${this.baseUrl}/${id}`, {
        headers: {
          'X-Request-ID': this.generateRequestId(),
          'X-Security-Context': 'policy-delete',
          'X-Confirmation': 'DELETE_CONFIRMED'
        }
      });

      // Clear cache
      this.invalidatePolicyCache(id);

      // Log deletion
      this.auditLog('policy_deleted', {
        policyId: id,
        policyName: policy.name
      });
    } catch (error) {
      console.error(`Failed to delete policy ${id}:`, error);
      throw this.handleError(error, 'Failed to delete policy');
    }
  }

  /**
   * Validate policy Rego code
   */
  async validatePolicy(request: ValidatePolicyRequest): Promise<ValidatePolicyResponse> {
    try {
      const response = await secureApiClient.post(`${this.baseUrl}/validate`, {
        ...request,
        securityContext: {
          sanitizeInput: true,
          checkVulnerabilities: true,
          enforceStandards: true
        }
      }, {
        headers: {
          'X-Request-ID': this.generateRequestId(),
          'X-Security-Context': 'policy-validation',
          'X-Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      // Log validation
      this.auditLog('policy_validated', {
        errors: data.errors?.length || 0,
        warnings: data.warnings?.length || 0
      });

      return data;
    } catch (error) {
      console.error('Failed to validate policy:', error);
      throw this.handleError(error, 'Failed to validate policy');
    }
  }

  /**
   * Test policy execution
   */
  async testPolicy(request: TestPolicyRequest): Promise<TestPolicyResponse> {
    try {
      const response = await secureApiClient.post(`${this.baseUrl}/${request.policyId}/test`, {
        ...request,
        securityContext: {
          sandboxExecution: true,
          resourceLimits: {
            memory: 256,
            cpu: 0.5,
            duration: 30000
          },
          isolationLevel: 'strict'
        }
      }, {
        headers: {
          'X-Request-ID': this.generateRequestId(),
          'X-Security-Context': 'policy-testing',
          'X-Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      // Log test execution
      this.auditLog('policy_tested', {
        policyId: request.policyId,
        testRun: data.testRun,
        status: data.status,
        duration: data.summary?.duration || 0
      });

      return data;
    } catch (error) {
      console.error('Failed to test policy:', error);
      throw this.handleError(error, 'Failed to test policy');
    }
  }

  /**
   * Deploy policy to environment
   */
  async deployPolicy(request: DeployPolicyRequest): Promise<DeployPolicyResponse> {
    // Check approval requirements
    const policy = await this.getPolicy(request.policyId);

    try {
      const response = await secureApiClient.post(`${this.baseUrl}/${request.policyId}/deploy`, {
        ...request,
        securityContext: {
          requireApproval: policy.securityContext.classification !== 'public',
          validateBeforeDeploy: true,
          autoRollback: request.config?.autoRollback ?? true,
          encryptionRequired: true
        }
      }, {
        headers: {
          'X-Request-ID': this.generateRequestId(),
          'X-Security-Context': 'policy-deployment',
          'X-Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      // Clear cache
      this.invalidatePolicyCache(request.policyId);

      // Log deployment
      this.auditLog('policy_deployed', {
        policyId: request.policyId,
        environment: request.environment,
        deploymentId: data.deployment.id
      });

      return data;
    } catch (error) {
      console.error('Failed to deploy policy:', error);
      throw this.handleError(error, 'Failed to deploy policy');
    }
  }

  /**
   * Rollback policy deployment
   */
  async rollbackPolicy(request: RollbackPolicyRequest): Promise<RollbackPolicyResponse> {
    try {
      const response = await secureApiClient.post(
        `${this.baseUrl}/deployments/${request.deploymentId}/rollback`,
        {
          ...request,
          securityContext: {
            requireApproval: true,
            validateRollback: true,
            backupRequired: true,
            notifyStakeholders: true
          }
        },
        {
          headers: {
            'X-Request-ID': this.generateRequestId(),
            'X-Security-Context': 'policy-rollback',
            'X-Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      // Log rollback
      this.auditLog('policy_rolled_back', {
        deploymentId: request.deploymentId,
        reason: request.reason,
        strategy: request.strategy
      });

      return data;
    } catch (error) {
      console.error('Failed to rollback policy:', error);
      throw this.handleError(error, 'Failed to rollback policy');
    }
  }

  /**
   * Get policy deployment history
   */
  async getDeploymentHistory(policyId: string): Promise<PolicyDeployment[]> {
    try {
      const response = await secureApiClient.get(
        `${this.baseUrl}/${policyId}/deployments`,
        {
          headers: {
            'X-Request-ID': this.generateRequestId(),
            'X-Security-Context': 'deployment-history'
          }
        }
      );

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch deployment history:', error);
      throw this.handleError(error, 'Failed to fetch deployment history');
    }
  }

  /**
   * Get policy version history
   */
  async getVersionHistory(policyId: string): Promise<PolicyVersion[]> {
    try {
      const response = await secureApiClient.get(
        `${this.baseUrl}/${policyId}/versions`,
        {
          headers: {
            'X-Request-ID': this.generateRequestId(),
            'X-Security-Context': 'version-history'
          }
        }
      );

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch version history:', error);
      throw this.handleError(error, 'Failed to fetch version history');
    }
  }

  /**
   * Get specific policy version
   */
  async getVersion(policyId: string, version: number): Promise<PolicyVersion> {
    try {
      const response = await secureApiClient.get(
        `${this.baseUrl}/${policyId}/versions/${version}`,
        {
          headers: {
            'X-Request-ID': this.generateRequestId(),
            'X-Security-Context': 'version-read'
          }
        }
      );

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch policy version:', error);
      throw this.handleError(error, 'Failed to fetch policy version');
    }
  }

  /**
   * Restore policy to specific version
   */
  async restoreVersion(policyId: string, version: number, reason: string): Promise<Policy> {
    try {
      const response = await secureApiClient.post(
        `${this.baseUrl}/${policyId}/versions/${version}/restore`,
        {
          reason,
          securityContext: {
            requireApproval: true,
            createBackup: true,
            notifyUsers: true
          }
        },
        {
          headers: {
            'X-Request-ID': this.generateRequestId(),
            'X-Security-Context': 'version-restore',
            'X-Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      // Clear cache
      this.invalidatePolicyCache(policyId);

      // Log restoration
      this.auditLog('policy_restored', {
        policyId,
        version,
        reason
      });

      return data;
    } catch (error) {
      console.error('Failed to restore policy version:', error);
      throw this.handleError(error, 'Failed to restore policy version');
    }
  }

  /**
   * Analyze policy impact
   */
  async analyzeImpact(policyId: string, compareToVersion?: number): Promise<PolicyImpact> {
    try {
      const response = await secureApiClient.post(
        `${this.baseUrl}/${policyId}/analyze`,
        {
          compareToVersion,
          includeSecurity: true,
          includePerformance: true,
          includeCompliance: true,
          securityContext: {
            deepAnalysis: true,
            checkAllResources: true,
            simulateExecution: true
          }
        },
        {
          headers: {
            'X-Request-ID': this.generateRequestId(),
            'X-Security-Context': 'policy-analysis',
            'X-Content-Type': 'application/json'
          }
        }
      );

      return await response.json();
    } catch (error) {
      console.error('Failed to analyze policy impact:', error);
      throw this.handleError(error, 'Failed to analyze policy impact');
    }
  }

  /**
   * Get policy analytics
   */
  async getAnalytics(
    policyId: string,
    timeRange: { start: Date; end: Date },
    granularity: 'hour' | 'day' | 'week' = 'day'
  ): Promise<PolicyAnalytics> {
    const cacheKey = `analytics:${policyId}:${timeRange.start.getTime()}:${timeRange.end.getTime()}:${granularity}`;
    const cached = secureCache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await secureApiClient.get(
        `${this.baseUrl}/${policyId}/analytics`,
        {
          params: {
            start: timeRange.start.toISOString(),
            end: timeRange.end.toISOString(),
            granularity
          },
          headers: {
            'X-Request-ID': this.generateRequestId(),
            'X-Security-Context': 'policy-analytics'
          }
        }
      );

      const data = await response.json();
      secureCache.set(cacheKey, data, 60000); // 1 minute cache

      return data;
    } catch (error) {
      console.error('Failed to fetch policy analytics:', error);
      throw this.handleError(error, 'Failed to fetch policy analytics');
    }
  }

  /**
   * Get policy approval workflows
   */
  async getApprovals(policyId?: string): Promise<PolicyApproval[]> {
    try {
      const url = policyId
        ? `${this.baseUrl}/${policyId}/approvals`
        : `${this.baseUrl}/approvals`;

      const response = await secureApiClient.get(url, {
        headers: {
          'X-Request-ID': this.generateRequestId(),
          'X-Security-Context': 'approval-list'
        }
      });

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch approvals:', error);
      throw this.handleError(error, 'Failed to fetch approvals');
    }
  }

  /**
   * Submit policy for approval
   */
  async submitForApproval(
    policyId: string,
    version: number,
    approvers: string[],
    message?: string
  ): Promise<PolicyApproval> {
    try {
      const response = await secureApiClient.post(
        `${this.baseUrl}/${policyId}/approvals`,
        {
          version,
          approvers,
          message,
          securityContext: {
            requireMultiFactor: true,
            encryptComments: true,
            auditTrail: true
          }
        },
        {
          headers: {
            'X-Request-ID': this.generateRequestId(),
            'X-Security-Context': 'approval-submit',
            'X-Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      // Log submission
      this.auditLog('approval_submitted', {
        policyId,
        version,
        approvers: approvers.length
      });

      return data;
    } catch (error) {
      console.error('Failed to submit for approval:', error);
      throw this.handleError(error, 'Failed to submit for approval');
    }
  }

  /**
   * Approve or reject policy
   */
  async reviewApproval(
    approvalId: string,
    decision: 'approve' | 'reject' | 'request_changes',
    comment?: string,
    conditions?: string[]
  ): Promise<PolicyApproval> {
    try {
      const response = await secureApiClient.put(
        `${this.baseUrl}/approvals/${approvalId}`,
        {
          decision,
          comment,
          conditions,
          securityContext: {
            requireSignature: true,
            timestampSignature: true,
            nonRepudiation: true
          }
        },
        {
          headers: {
            'X-Request-ID': this.generateRequestId(),
            'X-Security-Context': 'approval-review',
            'X-Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      // Log decision
      this.auditLog('approval_reviewed', {
        approvalId,
        decision,
        hasComment: !!comment
      });

      return data;
    } catch (error) {
      console.error('Failed to review approval:', error);
      throw this.handleError(error, 'Failed to review approval');
    }
  }

  /**
   * Get policy templates
   */
  async getTemplates(category?: string): Promise<PolicyTemplate[]> {
    const cacheKey = `policy-templates:${category || 'all'}`;
    const cached = secureCache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await secureApiClient.get(`${this.baseUrl}/templates`, {
        params: category ? { category } : {},
        headers: {
          'X-Request-ID': this.generateRequestId(),
          'X-Security-Context': 'template-list'
        }
      });

      const data = await response.json();
      secureCache.set(cacheKey, data, 10 * 60 * 1000); // 10 minutes

      return data;
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      throw this.handleError(error, 'Failed to fetch templates');
    }
  }

  /**
   * Create policy from template
   */
  async createFromTemplate(
    templateId: string,
    parameters: Record<string, any>,
    customizations: Partial<CreatePolicyRequest>
  ): Promise<Policy> {
    try {
      const response = await secureApiClient.post(
        `${this.baseUrl}/templates/${templateId}/create`,
        {
          parameters,
          ...customizations,
          securityContext: {
            validateParameters: true,
            sanitizeInput: true,
            requireApproval: true
          }
        },
        {
          headers: {
            'X-Request-ID': this.generateRequestId(),
            'X-Security-Context': 'template-create',
            'X-Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      // Clear cache
      this.invalidatePolicyCache();

      // Log creation from template
      this.auditLog('policy_created_from_template', {
        templateId,
        policyId: data.id
      });

      return data;
    } catch (error) {
      console.error('Failed to create policy from template:', error);
      throw this.handleError(error, 'Failed to create policy from template');
    }
  }

  /**
   * Get test suites
   */
  async getTestSuites(policyId?: string): Promise<PolicyTestSuite[]> {
    try {
      const url = policyId
        ? `${this.baseUrl}/${policyId}/test-suites`
        : `${this.baseUrl}/test-suites`;

      const response = await secureApiClient.get(url, {
        headers: {
          'X-Request-ID': this.generateRequestId(),
          'X-Security-Context': 'test-suite-list'
        }
      });

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch test suites:', error);
      throw this.handleError(error, 'Failed to fetch test suites');
    }
  }

  /**
   * Run test suite
   */
  async runTestSuite(
    policyId: string,
    testSuiteId: string,
    scenarios?: string[]
  ): Promise<TestPolicyResponse> {
    try {
      const response = await secureApiClient.post(
        `${this.baseUrl}/${policyId}/test-suites/${testSuiteId}/run`,
        {
          scenarios,
          securityContext: {
            sandboxExecution: true,
            isolateTests: true,
            limitResources: true
          }
        },
        {
          headers: {
            'X-Request-ID': this.generateRequestId(),
            'X-Security-Context': 'test-execution',
            'X-Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      // Log test execution
      this.auditLog('test_suite_executed', {
        policyId,
        testSuiteId,
        scenarioCount: scenarios?.length || 0
      });

      return data;
    } catch (error) {
      console.error('Failed to run test suite:', error);
      throw this.handleError(error, 'Failed to run test suite');
    }
  }

  /**
   * Export policies
   */
  async exportPolicies(
    policyIds: string[],
    format: 'json' | 'yaml' | 'rego' = 'json',
    includeVersions = false
  ): Promise<Blob> {
    try {
      const response = await secureApiClient.post(
        `${this.baseUrl}/export`,
        {
          policyIds,
          format,
          includeVersions,
          securityContext: {
            encryptExport: true,
            signExport: true,
            watermarkExport: true
          }
        },
        {
          headers: {
            'X-Request-ID': this.generateRequestId(),
            'X-Security-Context': 'policy-export',
            'X-Content-Type': 'application/json'
          }
        }
      );

      // Log export
      this.auditLog('policies_exported', {
        count: policyIds.length,
        format,
        includeVersions
      });

      return await response.blob();
    } catch (error) {
      console.error('Failed to export policies:', error);
      throw this.handleError(error, 'Failed to export policies');
    }
  }

  /**
   * Import policies
   */
  async importPolicies(
    file: File,
    options: {
      overwrite?: boolean;
      validateBeforeImport?: boolean;
      requireApproval?: boolean;
    } = {}
  ): Promise<{ imported: Policy[]; errors: string[] }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('options', JSON.stringify({
      ...options,
      securityContext: {
        sanitizeImport: true,
        validateSecurity: true,
        scanMalware: true,
        checkSignatures: true
      }
    }));

    try {
      const response = await secureApiClient.post(
        `${this.baseUrl}/import`,
        formData,
        {
          headers: {
            'X-Request-ID': this.generateRequestId(),
            'X-Security-Context': 'policy-import'
          }
        }
      );

      const data = await response.json();

      // Clear cache
      this.invalidatePolicyCache();

      // Log import
      this.auditLog('policies_imported', {
        fileName: file.name,
        fileSize: file.size,
        imported: data.imported.length,
        errors: data.errors.length
      });

      return data;
    } catch (error) {
      console.error('Failed to import policies:', error);
      throw this.handleError(error, 'Failed to import policies');
    }
  }

  // Private helper methods

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private invalidatePolicyCache(policyId?: string) {
    if (policyId) {
      // Invalidate specific policy cache
      const keysToDelete = Array.from(this.cache.keys()).filter(key =>
        key.includes(policyId) || key.startsWith('policies:list')
      );
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      // Invalidate all policy cache
      const keysToDelete = Array.from(this.cache.keys()).filter(key =>
        key.startsWith('policy:') || key.startsWith('policies:list') || key.startsWith('analytics:')
      );
      keysToDelete.forEach(key => this.cache.delete(key));
    }
  }

  private getChanges(current: any, updates: any): Record<string, any> {
    const changes: Record<string, any> = {};

    for (const key in updates) {
      if (JSON.stringify(current[key]) !== JSON.stringify(updates[key])) {
        changes[key] = {
          from: current[key],
          to: updates[key]
        };
      }
    }

    return changes;
  }

  private handleError(error: any, defaultMessage: string): Error {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 400:
          return new Error(data.message || 'Invalid request data');
        case 401:
          return new Error('Authentication required');
        case 403:
          return new Error('Insufficient permissions');
        case 404:
          return new Error('Policy not found');
        case 409:
          return new Error(data.message || 'Policy conflict detected');
        case 422:
          return new Error(data.message || 'Validation failed');
        case 429:
          return new Error('Too many requests. Please try again later');
        case 500:
          return new Error('Internal server error');
        default:
          return new Error(data.message || defaultMessage);
      }
    }

    return new Error(defaultMessage);
  }

  private auditLog(action: string, details: Record<string, any>) {
    // This would integrate with your audit logging service
    console.log('AUDIT:', {
      timestamp: new Date().toISOString(),
      action,
      service: 'policy-management',
      ...details
    });
  }
}

export const policyService = new PolicyManagementService();
export default policyService;
