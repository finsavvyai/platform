// @ts-nocheck
/**
 * Policy Management Service
 *
 * Enterprise-grade policy management API service - facade re-export
 *
 * TODO: This service needs proper type-safe API client integration.
 */

import * as crud from './crud/pm-crud';
import * as operations from './crud/pm-testing';
import * as approval from './crud/pm-approval';

export class PolicyManagementService {
  listPolicies = crud.listPolicies;
  getPolicy = crud.getPolicy;
  createPolicy = crud.createPolicy;
  updatePolicy = crud.updatePolicy;
  deletePolicy = crud.deletePolicy;
  validatePolicy = operations.validatePolicy;
  testPolicy = operations.testPolicy;
  getTestResults = operations.getTestResults;
  deployPolicy = operations.deployPolicy;
  rollbackPolicy = operations.rollbackPolicy;
  getDeployment = operations.getDeployment;
  listDeployments = operations.listDeployments;
  submitForApproval = approval.submitForApproval;
  approvePolicy = approval.approvePolicy;
  getApproval = approval.getApproval;
  listTemplates = approval.listTemplates;
  getTemplate = approval.getTemplate;
  createPolicyFromTemplate = approval.createPolicyFromTemplate;
  getPolicyAnalytics = approval.getPolicyAnalytics;
  analyzePolicyImpact = approval.analyzePolicyImpact;
  getVersionHistory = approval.getVersionHistory;
  restoreVersion = approval.restoreVersion;
}

// Export singleton instance
export const policyManagementService = new PolicyManagementService();
