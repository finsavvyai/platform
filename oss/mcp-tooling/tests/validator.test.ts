import { describe, it, expect, beforeEach } from 'vitest';
import { MCPValidator } from '../src/services/validator';

describe('MCPValidator', () => {
  let validator: MCPValidator;

  beforeEach(() => {
    validator = new MCPValidator();
  });

  it('should validate correct manifest', () => {
    const manifest = {
      name: 'Test Server',
      version: '1.0.0',
      description: 'A test server',
      tools: [{ name: 'tool1', description: 'Tool 1' }],
      resources: [{ name: 'res1', mimeType: 'text/plain', uri: 'http://example.com' }],
    };
    const result = validator.validate(manifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should report missing name', () => {
    const result = validator.validate({
      name: '',
      version: '1.0.0',
      description: 'Desc',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Manifest must have a name');
  });

  it('should report missing version', () => {
    const result = validator.validate({
      name: 'Test',
      version: '',
      description: 'Desc',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Manifest must have a version');
  });

  it('should report invalid version format', () => {
    const result = validator.validate({
      name: 'Test',
      version: 'not-semver',
      description: 'Desc',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Version must follow semver format (e.g., 1.0.0)');
  });

  it('should validate semver versions', () => {
    expect(validator.isValidVersion('1.0.0')).toBe(true);
    expect(validator.isValidVersion('1.0.0-alpha')).toBe(true);
    expect(validator.isValidVersion('1.0.0+build')).toBe(true);
    expect(validator.isValidVersion('not-semver')).toBe(false);
  });

  it('should validate tools', () => {
    expect(validator.validateTool({ name: 'tool1', description: 'desc' })).toBe(true);
    expect(validator.validateTool({ name: '', description: 'desc' })).toBe(false);
  });

  it('should validate resources', () => {
    expect(validator.validateResource({ name: 'res1', mimeType: 'text/plain', uri: 'http://example.com' })).toBe(true);
    expect(validator.validateResource({ name: '', mimeType: 'text/plain', uri: 'http://example.com' })).toBe(false);
  });

  it('should warn on missing tool description', () => {
    const result = validator.validate({
      name: 'Test',
      version: '1.0.0',
      description: 'Desc',
      tools: [{ name: 'tool1' }],
    });
    expect(result.warnings).toContain('Tool 0: missing description');
  });

  it('should report missing resource name', () => {
    const result = validator.validate({
      name: 'Test',
      version: '1.0.0',
      description: 'Desc',
      resources: [{ name: '', mimeType: 'text/plain', uri: 'http://example.com' }],
    });
    expect(result.errors).toContain('Resource 0: missing name');
  });

  it('should report missing resource uri', () => {
    const result = validator.validate({
      name: 'Test',
      version: '1.0.0',
      description: 'Desc',
      resources: [{ name: 'res1', mimeType: 'text/plain', uri: '' }],
    });
    expect(result.errors).toContain('Resource 0: missing uri');
  });

  it('should validate multiple errors', () => {
    const result = validator.validate({
      name: '',
      version: 'bad-version',
      description: '',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});
