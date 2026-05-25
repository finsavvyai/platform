// @ts-nocheck
/**
 * Policy Management Service
 *
 * Enterprise-grade policy management service - facade re-export
 *
 * TODO: This service needs proper type-safe API client integration.
 */

export {
  listPolicies,
  getPolicy,
  createPolicy,
  updatePolicy,
  deletePolicy,
  invalidatePolicyCache,
} from './crud/policy-crud';

export {
  validatePolicy,
  testPolicy,
  getTestSuites,
  runTestSuite,
} from './crud/policy-testing';

export {
  deployPolicy,
  rollbackPolicy,
  getDeploymentHistory,
  getVersionHistory,
  getVersion,
  restoreVersion,
  analyzeImpact,
  getAnalytics,
} from './crud/policy-deployment';

export {
  getApprovals,
  submitForApproval,
  reviewApproval,
  getTemplates,
  createFromTemplate,
  exportPolicies,
  importPolicies,
} from './crud/policy-approval';

// Backward-compatible default export as object
import * as crud from './crud/policy-crud';
import * as testing from './crud/policy-testing';
import * as deployment from './crud/policy-deployment';
import * as approval from './crud/policy-approval';

const policyService = {
  ...crud,
  ...testing,
  ...deployment,
  ...approval,
};

export { policyService };
export default policyService;
