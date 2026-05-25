/**
 * Multi-Cloud Manager Tests
 */
import { describe, it, expect } from 'vitest';
import { validateCloudConfig, getProviderRegions } from './multi-cloud-manager.js';

describe('Multi-Cloud Manager', () => {
  it('validates AWS config', () => {
    const result = validateCloudConfig({
      provider: 'aws', displayName: 'Prod AWS', roleArn: 'arn:aws:iam::role/test',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects AWS without roleArn', () => {
    const result = validateCloudConfig({ provider: 'aws', displayName: 'Test' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('roleArn');
  });

  it('validates GCP config', () => {
    const result = validateCloudConfig({
      provider: 'gcp', displayName: 'Prod GCP', projectId: 'my-project',
    });
    expect(result.valid).toBe(true);
  });

  it('validates Azure config', () => {
    const result = validateCloudConfig({
      provider: 'azure', displayName: 'Prod Azure',
      tenantId: 't-1', subscriptionId: 's-1',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid provider', () => {
    const result = validateCloudConfig({ provider: 'oracle', displayName: 'Test' });
    expect(result.valid).toBe(false);
  });

  it('returns regions for provider', () => {
    expect(getProviderRegions('aws').length).toBeGreaterThan(0);
    expect(getProviderRegions('gcp').length).toBeGreaterThan(0);
    expect(getProviderRegions('azure').length).toBeGreaterThan(0);
  });
});
