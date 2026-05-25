'use strict';

import { describe, it, expect, beforeEach } from 'vitest';
import { AuditLogger } from './AuditLogger.js';

describe('AuditLogger', () => {
  let logger: AuditLogger;

  beforeEach(() => {
    logger = new AuditLogger();
  });

  describe('log', () => {
    it('should log an audit entry', async () => {
      const entry = await logger.log({
        userId: 'user-123',
        userEmail: 'user@example.com',
        action: 'test.executed',
        category: 'test_execution',
        projectId: 'proj-456',
        description: 'Executed test: Login',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        status: 'success',
      });

      expect(entry.id).toBeDefined();
      expect(entry.timestamp).toBeDefined();
      expect(entry.userId).toBe('user-123');
      expect(entry.action).toBe('test.executed');
    });

    it('should create entry with timestamp', async () => {
      const before = new Date();
      const entry = await logger.log({
        userId: 'user-123',
        action: 'user.login',
        category: 'authentication',
        description: 'User login',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        status: 'success',
      });
      const after = new Date();

      expect(entry.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(entry.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await logger.log({
        userId: 'user-123',
        action: 'test.executed',
        category: 'test_execution',
        projectId: 'proj-456',
        description: 'Test 1',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        status: 'success',
      });

      await logger.log({
        userId: 'user-123',
        action: 'test.executed',
        category: 'test_execution',
        projectId: 'proj-456',
        description: 'Test 2',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        status: 'failure',
        errorMessage: 'Assertion failed',
      });

      await logger.log({
        userId: 'user-456',
        action: 'user.login',
        category: 'authentication',
        description: 'User login',
        ipAddress: '192.168.1.2',
        userAgent: 'Chrome',
        status: 'success',
      });
    });

    it('should filter by userId', async () => {
      const result = await logger.query({ userId: 'user-123' });
      expect(result.entries).toHaveLength(2);
      expect(result.entries.every((e) => e.userId === 'user-123')).toBe(true);
    });

    it('should filter by action', async () => {
      const result = await logger.query({ action: 'test.executed' });
      expect(result.entries.every((e) => e.action === 'test.executed')).toBe(true);
    });

    it('should filter by category', async () => {
      const result = await logger.query({ category: 'authentication' });
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].category).toBe('authentication');
    });

    it('should filter by status', async () => {
      const result = await logger.query({ status: 'failure' });
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].status).toBe('failure');
    });

    it('should filter by date range', async () => {
      const startDate = new Date(Date.now() - 1000);
      const endDate = new Date(Date.now() + 1000);

      const result = await logger.query({ startDate, endDate });
      expect(result.entries.length).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const result1 = await logger.query({ limit: 2, offset: 0 });
      const result2 = await logger.query({ limit: 2, offset: 2 });

      expect(result1.entries).toHaveLength(2);
      expect(result1.limit).toBe(2);
      expect(result1.offset).toBe(0);
      expect(result2.entries).toHaveLength(1);
    });

    it('should return total count', async () => {
      const result = await logger.query({ limit: 1 });
      expect(result.total).toBe(3);
    });
  });

  describe('getUserActivity', () => {
    beforeEach(async () => {
      for (let i = 0; i < 5; i++) {
        await logger.log({
          userId: 'user-123',
          action: 'test.executed',
          category: 'test_execution',
          description: `Activity ${i}`,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          status: 'success',
        });
      }
    });

    it('should get user activity for time period', async () => {
      const activities = await logger.getUserActivity('user-123', 30);
      expect(activities).toHaveLength(5);
      expect(activities.every((a) => a.userId === 'user-123')).toBe(true);
    });

    it('should return empty for non-existent user', async () => {
      const activities = await logger.getUserActivity('user-xyz', 30);
      expect(activities).toHaveLength(0);
    });
  });

  describe('getUserStats', () => {
    beforeEach(async () => {
      await logger.log({
        userId: 'user-123',
        action: 'test.executed',
        category: 'test_execution',
        description: 'Test 1',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        status: 'success',
      });

      await logger.log({
        userId: 'user-123',
        action: 'test.executed',
        category: 'test_execution',
        description: 'Test 2',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        status: 'failure',
      });
    });

    it('should calculate user statistics', async () => {
      const stats = await logger.getUserStats('user-123');

      expect(stats.totalActions).toBe(2);
      expect(stats.successRate).toBe(50);
      expect(stats.categories.test_execution).toBe(2);
      expect(stats.lastActivity).toBeDefined();
    });
  });

  describe('exportToCSV', () => {
    beforeEach(async () => {
      await logger.log({
        userId: 'user-123',
        action: 'test.executed',
        category: 'test_execution',
        description: 'Test export',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        status: 'success',
      });
    });

    it('should export audit logs to CSV', async () => {
      const csv = await logger.exportToCSV({});

      expect(csv).toContain('Timestamp');
      expect(csv).toContain('test.executed');
      expect(csv).toContain('user-123');
    });

    it('should include headers and data rows', async () => {
      const csv = await logger.exportToCSV({});
      const lines = csv.split('\n');

      expect(lines[0]).toContain('Timestamp,User ID');
      expect(lines.length).toBeGreaterThan(1);
    });
  });

  describe('generateComplianceReport', () => {
    beforeEach(async () => {
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);

      await logger.log({
        userId: 'user-123',
        userEmail: 'user@example.com',
        action: 'user.login',
        category: 'authentication',
        description: 'Login',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        status: 'success',
      });

      await logger.log({
        userId: 'user-456',
        userEmail: 'admin@example.com',
        action: 'role.assigned',
        category: 'security',
        description: 'Role assigned',
        ipAddress: '192.168.1.2',
        userAgent: 'Chrome',
        status: 'success',
      });

      await logger.log({
        userId: 'user-123',
        action: 'export.executed',
        category: 'data_export',
        description: 'Data export',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        status: 'success',
      });
    });

    it('should generate compliance report', async () => {
      const endDate = new Date();
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const report = await logger.generateComplianceReport(
        'org-123',
        startDate,
        endDate,
        'admin-user'
      );

      expect(report.id).toBeDefined();
      expect(report.organizationId).toBe('org-123');
      expect(report.summary.totalActions).toBe(3);
      expect(report.summary.successfulActions).toBe(3);
      expect(report.summary.uniqueUsers).toBe(2);
      expect(report.generatedAt).toBeDefined();
      expect(report.generatedBy).toBe('admin-user');
    });

    it('should include action breakdown', async () => {
      const endDate = new Date();
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const report = await logger.generateComplianceReport(
        'org-123',
        startDate,
        endDate,
        'admin-user'
      );

      expect(report.actionBreakdown.authentication).toBeGreaterThan(0);
      expect(report.actionBreakdown.security).toBeGreaterThan(0);
      expect(report.actionBreakdown.data_export).toBeGreaterThan(0);
    });

    it('should include user activity summary', async () => {
      const endDate = new Date();
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const report = await logger.generateComplianceReport(
        'org-123',
        startDate,
        endDate,
        'admin-user'
      );

      expect(report.userActivity.length).toBe(2);
      expect(report.userActivity[0].actionCount).toBeGreaterThan(0);
      expect(report.userActivity[0].lastActivity).toBeDefined();
    });
  });
});
