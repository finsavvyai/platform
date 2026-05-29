/**
 * Policy Management Service
 *
 * Enterprise-grade policy management API service with comprehensive security,
 * audit logging, and approval workflows for OPA policy management
 */

import { apiClient } from '@/lib/api-client';
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
  PolicyTemplate,
  PolicyTestSuite,
  PolicyDeployment,
  PolicyApproval,
  PolicyImpact,
  PolicyVersion,
  PolicyAnalytics,
  ApprovalStatus,
  DeploymentStatus,
  PolicyStatus,
  ValidationError,
  SecurityLevel
} from '@/types/policy-management';
import { secureLog, sanitizeInput } from '@/utils/security/audit-logger';
import { encryptData, decryptData } from '@/utils/security/encryption';
import { validateInput } from '@/utils/security/validation';

export class PolicyManagementService {
  private readonly baseUrl = '/api/v1/policies';
  private readonly templatesUrl = '/api/v1/policy-templates';
  private readonly testingUrl = '/api/v1/policy-testing';
  private readonly deploymentUrl = '/api/v1/policy-deployments';
  private readonly approvalUrl = '/api/v1/policy-approvals';
  private readonly analyticsUrl = '/api/v1/policy-analytics';

  /**
   * Policy CRUD Operations
   */

  async listPolicies(query: PolicyListQuery = {}): Promise<PolicyListResponse> {
    try {
      // Validate input parameters
      const sanitizedQuery = {
        ...query,
        search: query.search ? sanitizeInput(query.search) : undefined,
        limit: Math.min(query.limit || 50, 100), // Enforce maximum limit
        page: Math.max(query.page || 1, 1) // Ensure page is at least 1
      };

      const response = await apiClient.get<PolicyListResponse>(this.baseUrl, {
        params: sanitizedQuery
      });

      // Decrypt sensitive policy data if needed
      const policies = response.data.policies.map(policy =>
        this.decryptPolicyData(policy)
      );

      await secureLog('INFO', 'Policies listed', {
        count: policies.length,
        total: response.data.total,
        query: sanitizedQuery
      });

      return {
        ...response.data,
        policies
      };
    } catch (error) {
      await secureLog('ERROR', 'Failed to list policies', { error, query });
      throw this.handleError(error);
    }
  }

  async getPolicy(id: string, version?: number): Promise<Policy> {
    try {
      // Validate policy ID
      if (!validateInput(id, 'uuid')) {
        throw new Error('Invalid policy ID format');
      }

      const response = await apiClient.get<Policy>(`${this.baseUrl}/${id}`, {
        params: version ? { version } : undefined
      });

      const policy = this.decryptPolicyData(response.data);

      await secureLog('INFO', 'Policy retrieved', {
        policyId: id,
        version: version || policy.version,
        name: policy.name,
        category: policy.category
      });

      return policy;
    } catch (error) {
      await secureLog('ERROR', 'Failed to get policy', { error, policyId: id, version });
      throw this.handleError(error);
    }
  }

  async createPolicy(request: CreatePolicyRequest): Promise<Policy> {
    try {
      // Validate and sanitize input
      const sanitizedRequest = await this.sanitizePolicyRequest(request);

      // Encrypt sensitive data
      const encryptedRequest = await this.encryptPolicyData(sanitizedRequest);

      // Add security metadata
      const securedRequest = {
        ...encryptedRequest,
        securityContext: {
          classification: request.metadata?.risk?.score ?
            (request.metadata.risk.score > 0.7 ? 'high' : 'medium') : 'low',
          accessControls: ['RBAC'],
          encryption: {
            atRest: true,
            inTransit: true,
            algorithm: 'AES-256-GCM',
            keyRotation: 90,
            keyManagement: 'cloudflare-kms'
          },
          auditLogging: {
            logLevel: 'info',
            logRetention: 365,
            logDestinations: ['cloudflare-logs', 'siem'],
            sensitiveDataMasking: true,
            realTimeAlerts: true
          }
        }
      };

      const response = await apiClient.post<Policy>(this.baseUrl, securedRequest);

      const policy = this.decryptPolicyData(response.data);

      await secureLog('INFO', 'Policy created', {
        policyId: policy.id,
        name: policy.name,
        category: policy.category,
        createdBy: policy.createdBy
      });

      return policy;
    } catch (error) {
      await secureLog('ERROR', 'Failed to create policy', { error, request: request.name });
      throw this.handleError(error);
    }
  }

  async updatePolicy(id: string, request: UpdatePolicyRequest): Promise<Policy> {
    try {
      // Validate policy ID
      if (!validateInput(id, 'uuid')) {
        throw new Error('Invalid policy ID format');
      }

      // Validate and sanitize input
      const sanitizedRequest = await this.sanitizePolicyUpdateRequest(request);

      // Check if user has permission to update this policy
      const currentPolicy = await this.getPolicy(id);
      if (currentPolicy.status === 'deployed' && !this.canUpdateDeployedPolicy(currentPolicy)) {
        throw new Error('Cannot update deployed policy. Create a new version instead.');
      }

      // Encrypt sensitive data
      const encryptedRequest = await this.encryptPolicyUpdateData(sanitizedRequest);

      const response = await apiClient.patch<Policy>(`${this.baseUrl}/${id}`, encryptedRequest);

      const policy = this.decryptPolicyData(response.data);

      await secureLog('INFO', 'Policy updated', {
        policyId: id,
        name: policy.name,
        version: policy.version,
        updatedBy: policy.updatedBy
      });

      return policy;
    } catch (error) {
      await secureLog('ERROR', 'Failed to update policy', { error, policyId: id });
      throw this.handleError(error);
    }
  }

  async deletePolicy(id: string, options: { force?: boolean; reason?: string } = {}): Promise<void> {
    try {
      // Validate policy ID
      if (!validateInput(id, 'uuid')) {
        throw new Error('Invalid policy ID format');
      }

      // Check if policy can be deleted
      const policy = await this.getPolicy(id);
      if (policy.status === 'deployed' && !options.force) {
        throw new Error('Cannot delete deployed policy. Undeploy it first or use force option.');
      }

      // Log deletion reason
      if (options.reason) {
        await secureLog('INFO', 'Policy deletion reason', {
          policyId: id,
          policyName: policy.name,
          reason: sanitizeInput(options.reason)
        });
      }

      await apiClient.delete(`${this.baseUrl}/${id}`, {
        params: {
          force: options.force,
          reason: options.reason
        }
      });

      await secureLog('INFO', 'Policy deleted', {
        policyId: id,
        policyName: policy.name,
        force: options.force
      });
    } catch (error) {
      await secureLog('ERROR', 'Failed to delete policy', { error, policyId: id });
      throw this.handleError(error);
    }
  }

  /**
   * Policy Validation
   */

  async validatePolicy(request: ValidatePolicyRequest): Promise<ValidatePolicyResponse> {
    try {
      // Validate Rego code
      const sanitizedCode = sanitizeInput(request.regoCode);

      // Perform client-side validation first
      const clientValidation = await this.performClientValidation(sanitizedCode, request.category);

      // Send to server for comprehensive validation
      const response = await apiClient.post<ValidatePolicyResponse>(
        `${this.baseUrl}/validate`,
        {
          ...request,
          regoCode: sanitizedCode
        }
      );

      // Combine client and server validation results
      const validationResponse = {
        ...response.data,
        errors: [...clientValidation.errors, ...response.data.errors],
        warnings: [...clientValidation.warnings, ...response.data.warnings]
      };

      await secureLog('INFO', 'Policy validated', {
        valid: validationResponse.valid,
        errorCount: validationResponse.errors.length,
        warningCount: validationResponse.warnings.length,
        category: request.category
      });

      return validationResponse;
    } catch (error) {
      await secureLog('ERROR', 'Failed to validate policy', { error });
      throw this.handleError(error);
    }
  }

  /**
   * Policy Testing
   */

  async testPolicy(request: TestPolicyRequest): Promise<TestPolicyResponse> {
    try {
      // Validate test request
      if (!validateInput(request.policyId, 'uuid')) {
        throw new Error('Invalid policy ID format');
      }

      // Get policy for security context
      const policy = await this.getPolicy(request.policyId);

      // Check if user has permission to test this policy
      if (!this.canTestPolicy(policy)) {
        throw new Error('Insufficient permissions to test this policy');
      }

      // Sanitize test context
      const sanitizedRequest = {
        ...request,
        context: request.context ? this.sanitizeTestContext(request.context) : undefined
      };

      const response = await apiClient.post<TestPolicyResponse>(
        `${this.testingUrl}/run`,
        sanitizedRequest
      );

      await secureLog('INFO', 'Policy test completed', {
        policyId: request.policyId,
        testRun: response.data.testRun,
        status: response.data.status,
        totalTests: response.data.summary.total,
        passRate: response.data.summary.passRate
      });

      return response.data;
    } catch (error) {
      await secureLog('ERROR', 'Failed to test policy', { error, policyId: request.policyId });
      throw this.handleError(error);
    }
  }

  async getTestResults(testRunId: string): Promise<TestPolicyResponse> {
    try {
      const response = await apiClient.get<TestPolicyResponse>(
        `${this.testingUrl}/results/${testRunId}`
      );

      return response.data;
    } catch (error) {
      await secureLog('ERROR', 'Failed to get test results', { error, testRunId });
      throw this.handleError(error);
    }
  }

  /**
   * Policy Deployment
   */

  async deployPolicy(request: DeployPolicyRequest): Promise<DeployPolicyResponse> {
    try {
      // Validate deployment request
      if (!validateInput(request.policyId, 'uuid')) {
        throw new Error('Invalid policy ID format');
      }

      // Get policy for security validation
      const policy = await this.getPolicy(request.policyId);

      // Ensure policy has been tested and approved
      if (!this.canDeployPolicy(policy, request.environment)) {
        throw new Error('Policy must be tested and approved before deployment');
      }

      // Encrypt deployment config if it contains sensitive data
      const encryptedConfig = request.config ?
        await encryptData(JSON.stringify(request.config)) : undefined;

      const deploymentRequest = {
        ...request,
        config: encryptedConfig
      };

      const response = await apiClient.post<DeployPolicyResponse>(
        `${this.deploymentUrl}/deploy`,
        deploymentRequest
      );

      await secureLog('INFO', 'Policy deployment initiated', {
        policyId: request.policyId,
        version: request.version,
        environment: request.environment,
        deploymentId: response.data.deployment.id,
        strategy: request.config?.strategy || 'immediate'
      });

      return response.data;
    } catch (error) {
      await secureLog('ERROR', 'Failed to deploy policy', {
        error,
        policyId: request.policyId,
        environment: request.environment
      });
      throw this.handleError(error);
    }
  }

  async rollbackPolicy(request: RollbackPolicyRequest): Promise<RollbackPolicyResponse> {
    try {
      // Validate rollback request
      if (!validateInput(request.deploymentId, 'uuid')) {
        throw new Error('Invalid deployment ID format');
      }

      // Get current deployment for validation
      const deployment = await this.getDeployment(request.deploymentId);

      // Check if rollback is allowed
      if (!this.canRollbackDeployment(deployment)) {
        throw new Error('Rollback not allowed for this deployment');
      }

      // Sanitize rollback reason
      const sanitizedReason = sanitizeInput(request.reason);

      const rollbackRequest = {
        ...request,
        reason: sanitizedReason
      };

      const response = await apiClient.post<RollbackPolicyResponse>(
        `${this.deploymentUrl}/rollback`,
        rollbackRequest
      );

      await secureLog('WARN', 'Policy rollback initiated', {
        deploymentId: request.deploymentId,
        reason: sanitizedReason,
        strategy: request.strategy,
        rollbackId: response.data.rollback.id
      });

      return response.data;
    } catch (error) {
      await secureLog('ERROR', 'Failed to rollback policy', {
        error,
        deploymentId: request.deploymentId
      });
      throw this.handleError(error);
    }
  }

  async getDeployment(id: string): Promise<PolicyDeployment> {
    try {
      const response = await apiClient.get<PolicyDeployment>(
        `${this.deploymentUrl}/${id}`
      );

      return response.data;
    } catch (error) {
      await secureLog('ERROR', 'Failed to get deployment', { error, deploymentId: id });
      throw this.handleError(error);
    }
  }

  async listDeployments(policyId?: string): Promise<PolicyDeployment[]> {
    try {
      const response = await apiClient.get<PolicyDeployment[]>(
        this.deploymentUrl,
        {
          params: policyId ? { policyId } : undefined
        }
      );

      return response.data;
    } catch (error) {
      await secureLog('ERROR', 'Failed to list deployments', { error, policyId });
      throw this.handleError(error);
    }
  }

  /**
   * Policy Approval Workflow
   */

  async submitForApproval(policyId: string, version: number, approvers: string[]): Promise<PolicyApproval> {
    try {
      // Validate inputs
      if (!validateInput(policyId, 'uuid')) {
        throw new Error('Invalid policy ID format');
      }

      const response = await apiClient.post<PolicyApproval>(
        `${this.approvalUrl}/submit`,
        {
          policyId,
          version,
          approvers,
          type: 'deployment'
        }
      );

      await secureLog('INFO', 'Policy submitted for approval', {
        policyId,
        version,
        approvers,
        approvalId: response.data.id
      });

      return response.data;
    } catch (error) {
      await secureLog('ERROR', 'Failed to submit for approval', {
        error,
        policyId,
        version
      });
      throw this.handleError(error);
    }
  }

  async approvePolicy(approvalId: string, decision: 'approve' | 'reject' | 'request_changes', comment?: string): Promise<PolicyApproval> {
    try {
      const sanitizedComment = comment ? sanitizeInput(comment) : undefined;

      const response = await apiClient.patch<PolicyApproval>(
        `${this.approvalUrl}/${approvalId}/decide`,
        {
          decision,
          comment: sanitizedComment
        }
      );

      await secureLog('INFO', 'Policy approval decision recorded', {
        approvalId,
        decision,
        hasComment: !!comment
      });

      return response.data;
    } catch (error) {
      await secureLog('ERROR', 'Failed to record approval decision', {
        error,
        approvalId,
        decision
      });
      throw this.handleError(error);
    }
  }

  async getApproval(approvalId: string): Promise<PolicyApproval> {
    try {
      const response = await apiClient.get<PolicyApproval>(
        `${this.approvalUrl}/${approvalId}`
      );

      return response.data;
    } catch (error) {
      await secureLog('ERROR', 'Failed to get approval', { error, approvalId });
      throw this.handleError(error);
    }
  }

  /**
   * Policy Templates
   */

  async listTemplates(category?: string): Promise<PolicyTemplate[]> {
    try {
      const response = await apiClient.get<PolicyTemplate[]>(
        this.templatesUrl,
        {
          params: category ? { category } : undefined
        }
      );

      return response.data;
    } catch (error) {
      await secureLog('ERROR', 'Failed to list templates', { error, category });
      throw this.handleError(error);
    }
  }

  async getTemplate(id: string): Promise<PolicyTemplate> {
    try {
      const response = await apiClient.get<PolicyTemplate>(
        `${this.templatesUrl}/${id}`
      );

      return response.data;
    } catch (error) {
      await secureLog('ERROR', 'Failed to get template', { error, templateId: id });
      throw this.handleError(error);
    }
  }

  async createPolicyFromTemplate(templateId: string, parameters: Record<string, any>): Promise<Policy> {
    try {
      const response = await apiClient.post<Policy>(
        `${this.templatesUrl}/${templateId}/create`,
        { parameters }
      );

      const policy = this.decryptPolicyData(response.data);

      await secureLog('INFO', 'Policy created from template', {
        templateId,
        policyId: policy.id,
        policyName: policy.name
      });

      return policy;
    } catch (error) {
      await secureLog('ERROR', 'Failed to create policy from template', {
        error,
        templateId
      });
      throw this.handleError(error);
    }
  }

  /**
   * Policy Analytics
   */

  async getPolicyAnalytics(policyId: string, timeRange: { start: Date; end: Date }): Promise<PolicyAnalytics> {
    try {
      const response = await apiClient.get<PolicyAnalytics>(
        `${this.analyticsUrl}/${policyId}`,
        {
          params: {
            start: timeRange.start.toISOString(),
            end: timeRange.end.toISOString()
          }
        }
      );

      return response.data;
    } catch (error) {
      await secureLog('ERROR', 'Failed to get policy analytics', {
        error,
        policyId,
        timeRange
      });
      throw this.handleError(error);
    }
  }

  /**
   * Policy Impact Analysis
   */

  async analyzePolicyImpact(policyId: string, compareToVersion?: number): Promise<PolicyImpact> {
    try {
      const response = await apiClient.get<PolicyImpact>(
        `${this.baseUrl}/${policyId}/impact`,
        {
          params: compareToVersion ? { compareToVersion } : undefined
        }
      );

      await secureLog('INFO', 'Policy impact analysis completed', {
        policyId,
        compareToVersion,
        riskLevel: response.data.riskLevel
      });

      return response.data;
    } catch (error) {
      await secureLog('ERROR', 'Failed to analyze policy impact', {
        error,
        policyId,
        compareToVersion
      });
      throw this.handleError(error);
    }
  }

  /**
   * Policy Version Management
   */

  async getVersionHistory(policyId: string): Promise<PolicyVersion[]> {
    try {
      const response = await apiClient.get<PolicyVersion[]>(
        `${this.baseUrl}/${policyId}/versions`
      );

      return response.data;
    } catch (error) {
      await secureLog('ERROR', 'Failed to get version history', { error, policyId });
      throw this.handleError(error);
    }
  }

  async restoreVersion(policyId: string, version: number): Promise<Policy> {
    try {
      const response = await apiClient.post<Policy>(
        `${this.baseUrl}/${policyId}/versions/${version}/restore`
      );

      const policy = this.decryptPolicyData(response.data);

      await secureLog('INFO', 'Policy version restored', {
        policyId,
        restoredVersion: version,
        newVersion: policy.version
      });

      return policy;
    } catch (error) {
      await secureLog('ERROR', 'Failed to restore policy version', {
        error,
        policyId,
        version
      });
      throw this.handleError(error);
    }
  }

  /**
   * Private Helper Methods
   */

  private async sanitizePolicyRequest(request: CreatePolicyRequest): Promise<CreatePolicyRequest> {
    return {
      ...request,
      name: sanitizeInput(request.name),
      description: sanitizeInput(request.description),
      regoCode: this.sanitizeRegoCode(request.regoCode),
      tags: request.tags.map(tag => sanitizeInput(tag))
    };
  }

  private async sanitizePolicyUpdateRequest(request: UpdatePolicyRequest): Promise<UpdatePolicyRequest> {
    const sanitized: UpdatePolicyRequest = {};

    if (request.name) sanitized.name = sanitizeInput(request.name);
    if (request.description) sanitized.description = sanitizeInput(request.description);
    if (request.regoCode) sanitized.regoCode = this.sanitizeRegoCode(request.regoCode);
    if (request.tags) sanitized.tags = request.tags.map(tag => sanitizeInput(tag));

    return sanitized;
  }

  private sanitizeRegoCode(code: string): string {
    // Remove potentially dangerous code patterns
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

  private sanitizeTestContext(context: any): any {
    // Sanitize test context to prevent injection
    const contextStr = JSON.stringify(context);
    const sanitized = sanitizeInput(contextStr);
    return JSON.parse(sanitized);
  }

  private async encryptPolicyData(data: any): Promise<any> {
    // Encrypt sensitive fields
    const sensitiveFields = ['regoCode', 'metadata'];
    const encrypted = { ...data };

    for (const field of sensitiveFields) {
      if (encrypted[field]) {
        encrypted[field] = await encryptData(JSON.stringify(encrypted[field]));
      }
    }

    return encrypted;
  }

  private async encryptPolicyUpdateData(data: UpdatePolicyRequest): Promise<UpdatePolicyRequest> {
    const encrypted = { ...data };

    if (encrypted.regoCode) {
      encrypted.regoCode = await encryptData(encrypted.regoCode);
    }

    return encrypted;
  }

  private decryptPolicyData(policy: Policy): Policy {
    // Decrypt sensitive fields
    const sensitiveFields = ['regoCode', 'metadata'];
    const decrypted = { ...policy };

    for (const field of sensitiveFields) {
      if (decrypted[field]) {
        try {
          decrypted[field] = JSON.parse(decryptData(decrypted[field]));
        } catch {
          // If decryption fails, assume it's not encrypted
          // This maintains backward compatibility
        }
      }
    }

    return decrypted;
  }

  private async performClientValidation(code: string, category: string): Promise<{
    errors: ValidationError[];
    warnings: ValidationWarning[];
  }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic syntax validation
    try {
      // Check for balanced braces
      const openBraces = (code.match(/\{/g) || []).length;
      const closeBraces = (code.match(/\}/g) || []).length;
      if (openBraces !== closeBraces) {
        errors.push({
          line: 0,
          column: 0,
          message: 'Unbalanced braces in Rego code',
          type: 'syntax',
          severity: 'error',
          rule: 'balanced_braces'
        });
      }

      // Check for required keywords based on category
      const requiredKeywords = this.getRequiredKeywords(category);
      for (const keyword of requiredKeywords) {
        if (!code.includes(keyword)) {
          warnings.push({
            line: 0,
            column: 0,
            message: `Policy might be missing required keyword: ${keyword}`,
            type: 'missing_keyword',
            suggestion: `Consider adding '${keyword}' to your policy`
          });
        }
      }

      // Security validation
      if (code.includes('http.send')) {
        errors.push({
          line: 0,
          column: 0,
          message: 'HTTP requests are not allowed in policies',
          type: 'security',
          severity: 'error',
          rule: 'no_http_requests',
          fix: 'Remove HTTP requests from policy or use external data'
        });
      }

    } catch (error) {
      errors.push({
        line: 0,
        column: 0,
        message: 'Unexpected error during validation',
        type: 'semantic',
        severity: 'error'
      });
    }

    return { errors, warnings };
  }

  private getRequiredKeywords(category: string): string[] {
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

  private canUpdateDeployedPolicy(policy: Policy): boolean {
    // Only allow updates to deployed policies in development environment
    // or if user has admin privileges
    return policy.status !== 'deployed' || this.hasAdminPrivileges();
  }

  private canTestPolicy(policy: Policy): boolean {
    // Users can test policies they created or if they have test permissions
    return true; // This would check actual permissions
  }

  private canDeployPolicy(policy: Policy, environment: string): boolean {
    // Policy must be tested and approved for production deployment
    if (environment === 'production') {
      return policy.status === 'approved' &&
             policy.lastTested &&
             policy.approvalStatus === 'approved';
    }

    // For non-production, just need to be tested
    return policy.lastTested !== undefined;
  }

  private canRollbackDeployment(deployment: PolicyDeployment): boolean {
    // Can rollback if deployment is in failed state or within rollback window
    const now = new Date();
    const rollbackDeadline = deployment.rollbackDeadline;

    return deployment.status === 'deployment_failed' ||
           (rollbackDeadline && now < rollbackDeadline) ||
           this.hasAdminPrivileges();
  }

  private hasAdminPrivileges(): boolean {
    // Check if current user has admin privileges
    // This would integrate with the auth system
    return false;
  }

  private handleError(error: any): Error {
    // Centralized error handling
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.message;

      switch (status) {
        case 400:
          return new Error(`Bad Request: ${message}`);
        case 401:
          return new Error('Authentication required');
        case 403:
          return new Error('Insufficient permissions');
        case 404:
          return new Error('Policy not found');
        case 409:
          return new Error(`Conflict: ${message}`);
        case 422:
          return new Error(`Validation Error: ${message}`);
        case 429:
          return new Error('Rate limit exceeded');
        case 500:
          return new Error('Internal server error');
        default:
          return new Error(`Error: ${message}`);
      }
    }

    return error;
  }
}

// Export singleton instance
export const policyManagementService = new PolicyManagementService();
