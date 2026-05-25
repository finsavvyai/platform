import { describe, it, expect } from 'vitest';
import {
  getApiTemplate,
  getWebhookTemplate,
  getCronTemplate,
  scaffoldProject,
} from '../src/index';

describe('cf-templates exports', () => {
  it('should export getApiTemplate', () => {
    expect(getApiTemplate).toBeDefined();
    expect(typeof getApiTemplate).toBe('function');
  });

  it('should export getWebhookTemplate', () => {
    expect(getWebhookTemplate).toBeDefined();
    expect(typeof getWebhookTemplate).toBe('function');
  });

  it('should export getCronTemplate', () => {
    expect(getCronTemplate).toBeDefined();
    expect(typeof getCronTemplate).toBe('function');
  });

  it('should export scaffoldProject', () => {
    expect(scaffoldProject).toBeDefined();
    expect(typeof scaffoldProject).toBe('function');
  });
});
