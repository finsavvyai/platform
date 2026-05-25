// @ts-nocheck
/**
 * Policy Service
 *
 * Enterprise-grade policy management service - facade re-export
 *
 * TODO: This service needs proper type-safe API client integration.
 * Current implementation uses untyped response.data patterns.
 */

import * as crud from './crud/ps-crud';
import * as operations from './crud/ps-operations';

class PolicyService {
  getPolicies = crud.getPolicies;
  getPolicy = crud.getPolicy;
  createPolicy = crud.createPolicy;
  updatePolicy = crud.updatePolicy;
  deletePolicy = crud.deletePolicy;
  validatePolicy = crud.validatePolicy;
  testPolicy = operations.testPolicy;
  deployPolicy = operations.deployPolicy;
  rollbackPolicy = operations.rollbackPolicy;
  getPolicyVersions = operations.getPolicyVersions;
  getPolicyImpact = operations.getPolicyImpact;
  getPolicyAnalytics = operations.getPolicyAnalytics;
  getPolicyTemplates = operations.getPolicyTemplates;
}

export const policyService = new PolicyService();
