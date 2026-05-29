import { describe, it, expect } from 'vitest';
import {
  DatabaseTypeSchema,
  ConnectionConfigSchema,
} from './api';

describe('Zod schemas', () => {
  describe('DatabaseTypeSchema', () => {
    const validTypes = [
      'postgresql',
      'mysql',
      'mongodb',
      'redis',
      'sqlite',
      'mariadb',
      'mssql',
      'oracle',
      'snowflake',
      'bigquery',
      'redshift',
      'clickhouse',
      'cassandra',
      'dynamodb',
      'firestore',
      'cockroachdb',
      'timescaledb',
      'influxdb',
    ];

    it.each(validTypes)('should accept valid type: %s', (type) => {
      const result = DatabaseTypeSchema.safeParse(type);
      expect(result.success).toBe(true);
    });

    it('should reject an invalid database type', () => {
      const result = DatabaseTypeSchema.safeParse('invalid-db');
      expect(result.success).toBe(false);
    });

    it('should reject empty string', () => {
      const result = DatabaseTypeSchema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('should reject a number', () => {
      const result = DatabaseTypeSchema.safeParse(123);
      expect(result.success).toBe(false);
    });

    it('should reject null', () => {
      const result = DatabaseTypeSchema.safeParse(null);
      expect(result.success).toBe(false);
    });

    it('should reject undefined', () => {
      const result = DatabaseTypeSchema.safeParse(undefined);
      expect(result.success).toBe(false);
    });
  });

  describe('ConnectionConfigSchema', () => {
    const validConfig = {
      name: 'My Database',
      type: 'postgresql',
    };

    it('should accept a valid minimal connection config', () => {
      const result = ConnectionConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should accept a full connection config without metadata', () => {
      const full = {
        id: 'conn-1',
        name: 'Production DB',
        type: 'mysql',
        host: 'db.example.com',
        port: 3306,
        database: 'mydb',
        username: 'admin',
        password: 'secret',
        ssl: true,
        connectionString: 'mysql://admin:secret@db.example.com:3306/mydb',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-02-28T00:00:00Z',
      };

      const result = ConnectionConfigSchema.safeParse(full);
      expect(result.success).toBe(true);
    });

    it('should accept metadata as a record of string keys', () => {
      const config = {
        name: 'Production DB',
        type: 'mysql' as const,
        metadata: { region: 'us-east-1' },
      };

      const result = ConnectionConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should fail when name is missing', () => {
      const result = ConnectionConfigSchema.safeParse({ type: 'postgresql' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const nameError = result.error.issues.find(
          (issue) => issue.path[0] === 'name'
        );
        expect(nameError).toBeDefined();
      }
    });

    it('should fail when name is an empty string', () => {
      const result = ConnectionConfigSchema.safeParse({
        name: '',
        type: 'postgresql',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const nameError = result.error.issues.find(
          (issue) => issue.path[0] === 'name'
        );
        expect(nameError).toBeDefined();
        expect(nameError?.message).toBe('Name is required');
      }
    });

    it('should fail when type is missing', () => {
      const result = ConnectionConfigSchema.safeParse({ name: 'DB' });
      expect(result.success).toBe(false);
    });

    it('should fail when type is invalid', () => {
      const result = ConnectionConfigSchema.safeParse({
        name: 'DB',
        type: 'invalid-type',
      });
      expect(result.success).toBe(false);
    });

    it('should allow optional fields to be omitted', () => {
      const result = ConnectionConfigSchema.safeParse({
        name: 'DB',
        type: 'sqlite',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.host).toBeUndefined();
        expect(result.data.port).toBeUndefined();
        expect(result.data.ssl).toBeUndefined();
      }
    });

    it('should reject port as a string', () => {
      const result = ConnectionConfigSchema.safeParse({
        name: 'DB',
        type: 'postgresql',
        port: 'not-a-number',
      });
      expect(result.success).toBe(false);
    });

    it('should reject ssl as a string', () => {
      const result = ConnectionConfigSchema.safeParse({
        name: 'DB',
        type: 'postgresql',
        ssl: 'yes',
      });
      expect(result.success).toBe(false);
    });
  });

});
