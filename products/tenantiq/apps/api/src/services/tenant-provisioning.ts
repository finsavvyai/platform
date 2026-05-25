/**
 * Tenant Provisioning Service
 *
 * Handles automated provisioning of new customer organizations including:
 * - Organization creation
 * - Subscription setup
 * - Admin user creation
 * - Initial configuration
 * - Invitation emails
 *
 * This barrel re-exports from the provisioning/ directory.
 */

export type { ProvisionTenantParams, ProvisionedTenant } from './provisioning/types';
export { TIER_CONFIG } from './provisioning/types';
export { provisionTenant } from './provisioning/setup';
export { deprovisionTenant } from './provisioning/deprovision';
export { validateProvisioningParams } from './provisioning/validation';
