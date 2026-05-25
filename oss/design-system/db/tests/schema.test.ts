import { describe, it, expect } from 'vitest';
import { users, subscriptions, apiKeys, auditLog, pgTables } from '../src/schema/tables';
import {
  usersRelations,
  subscriptionsRelations,
  apiKeysRelations,
  auditLogRelations,
} from '../src/schema/relations';

describe('Schema - Tables Definition', () => {
  describe('users table', () => {
    it('should be defined with correct columns', () => {
      expect(users).toBeDefined();
      expect(users.id).toBeDefined();
      expect(users.email).toBeDefined();
      expect(users.name).toBeDefined();
      expect(users.role).toBeDefined();
      expect(users.createdAt).toBeDefined();
    });
  });

  describe('subscriptions table', () => {
    it('should be defined with correct columns', () => {
      expect(subscriptions).toBeDefined();
      expect(subscriptions.id).toBeDefined();
      expect(subscriptions.userId).toBeDefined();
      expect(subscriptions.plan).toBeDefined();
      expect(subscriptions.status).toBeDefined();
      expect(subscriptions.startDate).toBeDefined();
      expect(subscriptions.endDate).toBeDefined();
    });
  });

  describe('api_keys table', () => {
    it('should be defined with correct columns', () => {
      expect(apiKeys).toBeDefined();
      expect(apiKeys.id).toBeDefined();
      expect(apiKeys.userId).toBeDefined();
      expect(apiKeys.key).toBeDefined();
      expect(apiKeys.name).toBeDefined();
    });
  });

  describe('audit_log table', () => {
    it('should be defined with correct columns', () => {
      expect(auditLog).toBeDefined();
      expect(auditLog.id).toBeDefined();
      expect(auditLog.userId).toBeDefined();
      expect(auditLog.action).toBeDefined();
      expect(auditLog.resource).toBeDefined();
      expect(auditLog.timestamp).toBeDefined();
    });
  });

  describe('pgTables grouped export', () => {
    it('should contain all tables', () => {
      expect(pgTables.users).toBe(users);
      expect(pgTables.subscriptions).toBe(subscriptions);
      expect(pgTables.apiKeys).toBe(apiKeys);
      expect(pgTables.auditLog).toBe(auditLog);
    });
  });

  describe('relations', () => {
    it('should define relations for all tables', () => {
      expect(usersRelations).toBeDefined();
      expect(subscriptionsRelations).toBeDefined();
      expect(apiKeysRelations).toBeDefined();
      expect(auditLogRelations).toBeDefined();
    });
  });
});
