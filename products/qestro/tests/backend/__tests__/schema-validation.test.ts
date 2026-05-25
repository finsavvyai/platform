import { describe, it, expect } from '@jest/globals';
import { schema } from '../schema';

describe('Database Schema Validation', () => {
  it('should have all required plugin tables', () => {
    expect(schema.plugins).toBeDefined();
    expect(schema.pluginVersions).toBeDefined();
    expect(schema.pluginDependencies).toBeDefined();
    expect(schema.pluginInstallations).toBeDefined();
    expect(schema.pluginExecutionLogs).toBeDefined();
    expect(schema.pluginAnalytics).toBeDefined();
    expect(schema.pluginReviews).toBeDefined();
    expect(schema.pluginReviewHelpfulness).toBeDefined();
    expect(schema.pluginCategories).toBeDefined();
    expect(schema.pluginTags).toBeDefined();
    expect(schema.pluginTagAssociations).toBeDefined();
  });

  it('should have all required voice tables', () => {
    expect(schema.voiceRecordings).toBeDefined();
    expect(schema.voiceCommands).toBeDefined();
    expect(schema.voiceCommandHistory).toBeDefined();
    expect(schema.voiceAnnotations).toBeDefined();
    expect(schema.voicePreferences).toBeDefined();
    expect(schema.voiceAnalytics).toBeDefined();
  });

  it('should have all existing tables', () => {
    expect(schema.users).toBeDefined();
    expect(schema.projects).toBeDefined();
    expect(schema.recordingSessions).toBeDefined();
    expect(schema.recordedActions).toBeDefined();
    expect(schema.testSuites).toBeDefined();
    expect(schema.testCases).toBeDefined();
    expect(schema.testRuns).toBeDefined();
  });

  it('should export schema as default', () => {
    expect(schema).toBeDefined();
    expect(typeof schema).toBe('object');
  });
});