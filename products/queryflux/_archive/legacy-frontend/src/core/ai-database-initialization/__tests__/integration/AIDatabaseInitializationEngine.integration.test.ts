/**
 * AI Database Initialization Engine Integration Tests
 *
 * End-to-end integration tests for the complete AI Database Initialization workflow.
 */

import { AIDatabaseInitializationEngine } from '../../AIDatabaseInitializationEngine';
import { mockConfig, mockInputs, createMockFile, testUtils } from '../setup';
import { expectedResults } from '../setup';

describe('AIDatabaseInitializationEngine Integration Tests', () => {
  let engine: AIDatabaseInitializationEngine;

  beforeEach(() => {
    engine = new AIDatabaseInitializationEngine(mockConfig);
  });

  describe('Complete Workflow Integration', () => {
    test('should complete end-to-end workflow for simple input', async () => {
      const result = await engine.initializeDatabase(mockInputs.simple);

      expect(result).toEqual(
        expect.objectContaining({
          analysis: expectedResults.basicAnalysis,
          recommendations: expect.any(Array),
          creationPlan: expectedResults.creationPlan
        })
      );

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.analysis.confidence).toBeGreaterThan(0.5);
      expect(result.creationPlan.steps.length).toBeGreaterThan(0);
    }, 30000); // 30 second timeout for AI processing

    test('should complete end-to-end workflow for complex input', async () => {
      const result = await engine.initializeDatabase(mockInputs.complex);

      expect(result.analysis.extractedRequirements.length).toBeGreaterThan(3);
      expect(result.recommendations[0].confidence).toBeGreaterThan(0.8);
      expect(result.creationPlan.estimatedDuration).toBeGreaterThan(30);
    }, 30000);

    test('should handle IoT-specific requirements correctly', async () => {
      const result = await engine.initializeDatabase(mockInputs.iot);

      const recommendations = result.recommendations;
      const timeSeriesDB = recommendations.find(r =>
        r.databaseType.includes('influx') ||
        r.databaseType.includes('timescale') ||
        r.databaseType.includes('quest')
      );

      expect(timeSeriesDB).toBeDefined();
      expect(timeSeriesDB?.confidence).toBeGreaterThan(0.7);
    }, 30000);

    test('should process enterprise requirements correctly', async () => {
      const result = await engine.initializeDatabase(mockInputs.enterprise);

      expect(result.analysis.extractedRequirements.some(req =>
        req.type === 'compliance'
      )).toBe(true);

      expect(result.recommendations.some(rec =>
        rec.estimatedCost.monthly > 5000
      )).toBe(true);
    }, 30000);
  });

  describe('File Input Integration', () => {
    test('should process SQL dump file completely', async () => {
      const sqlContent = `
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE posts (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          title VARCHAR(255) NOT NULL,
          content TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX idx_posts_user_id ON posts(user_id);
        CREATE INDEX idx_posts_created_at ON posts(created_at);

        INSERT INTO users (name, email) VALUES
          ('John Doe', 'john@example.com'),
          ('Jane Smith', 'jane@example.com');
      `;

      const file = createMockFile(sqlContent, 'blog_dump.sql', 'application/sql');
      const result = await engine.initializeDatabase(file, {
        inputType: 'dump_file'
      });

      expect(result.analysis.inputType).toBe('dump_file');
      expect(result.analysis.extractedRequirements.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    }, 30000);

    test('should process JSON schema file', async () => {
      const jsonSchema = {
        tables: [
          {
            name: "users",
            fields: [
              { name: "id", type: "string", required: true },
              { name: "name", type: "string", required: true },
              { name: "profile", type: "object", fields: [
                { name: "age", type: "number" },
                { name: "preferences", type: "object" }
              ]}
            ]
          }
        ]
      };

      const file = createMockFile(JSON.stringify(jsonSchema), 'schema.json', 'application/json');
      const result = await engine.initializeDatabase(file, {
        inputType: 'dump_file'
      });

      expect(result.analysis.inputType).toBe('dump_file');
      expect(result.recommendations.some(r => r.databaseType === 'mongodb')).toBe(true);
    }, 30000);

    test('should process CSV data file', async () => {
      const csvContent = `id,name,email,role,created_at
1,John Doe,john@example.com,admin,2023-01-01T10:00:00Z
2,Jane Smith,jane@example.com,user,2023-01-02T11:00:00Z
3,Bob Johnson,bob@example.com,user,2023-01-03T12:00:00Z`;

      const file = createMockFile(csvContent, 'users.csv', 'text/csv');
      const result = await engine.initializeDatabase(file, {
        inputType: 'dump_file'
      });

      expect(result.analysis.inputType).toBe('dump_file');
      expect(result.recommendations.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Preferences Integration', () => {
    test('should apply budget preferences correctly', async () => {
      const result = await engine.initializeDatabase(mockInputs.complex, {
        preferences: {
          budgetRange: { min: 0, max: 300, currency: 'USD' },
          technicalLevel: 'beginner'
        }
      });

      // Should filter recommendations based on budget
      const affordableRecommendations = result.recommendations.filter(r =>
        r.estimatedCost.monthly <= 300
      );
      expect(affordableRecommendations.length).toBeGreaterThan(0);

      // Should prioritize beginner-friendly databases
      expect(result.recommendations[0].databaseType).toMatch(/^(postgresql|mysql|sqlite)$/);
    }, 30000);

    test('should apply technical level preferences', async () => {
      const result = await engine.initializeDatabase(mockInputs.complex, {
        preferences: {
          technicalLevel: 'expert'
        }
      });

      // Should include more advanced database options for expert users
      const hasAdvancedOptions = result.recommendations.some(r =>
        ['cockroachdb', 'cassandra', 'neo4j'].includes(r.databaseType)
      );
      expect(hasAdvancedOptions).toBe(true);
    }, 30000);

    test('should apply compliance requirements', async () => {
      const result = await engine.initializeDatabase(mockInputs.complex, {
        preferences: {
          complianceRequirements: ['gdpr', 'hipaa'],
          technicalLevel: 'intermediate'
        }
      });

      // Should prioritize databases with strong compliance features
      expect(result.recommendations[0].configuration.security.encryptionAtRest).toBe(true);
      expect(result.recommendations[0].configuration.security.auditLogging).toBe(true);
    }, 30000);
  });

  describe('Creation Plan Execution Integration', () => {
    test('should generate valid creation plan', async () => {
      const result = await engine.initializeDatabase(mockInputs.simple);
      const plan = result.creationPlan;

      expect(testUtils.validateCreationPlan(plan)).toBe(true);
      expect(plan.steps.length).toBeGreaterThan(5);
      expect(plan.prerequisites.length).toBeGreaterThan(0);
      expect(plan.rollbackPlan.length).toBeGreaterThan(0);
    }, 30000);

    test('should generate detailed creation steps', async () => {
      const result = await engine.initializeDatabase(mockInputs.complex);
      const plan = result.creationPlan;

      const hasInfrastructure = plan.steps.some(s => s.type === 'infrastructure');
      const hasConfiguration = plan.steps.some(s => s.type === 'configuration');
      const hasValidation = plan.steps.some(s => s.type === 'validation');

      expect(hasInfrastructure).toBe(true);
      expect(hasConfiguration).toBe(true);
      expect(hasValidation).toBe(true);
    }, 30000);

    test('should generate appropriate prerequisites', async () => {
      const result = await engine.initializeDatabase(mockInputs.complex);
      const plan = result.creationPlan;

      const hasSoftwarePrereqs = plan.prerequisites.some(p => p.type === 'software');
      const hasHardwarePrereqs = plan.prerequisites.some(p => p.type === 'hardware');
      const hasNetworkPrereqs = plan.prerequisites.some(p => p.type === 'network');

      expect(hasSoftwarePrereqs).toBe(true);
      expect(hasHardwarePrereqs).toBe(true);
      expect(hasNetworkPrereqs).toBe(true);
    }, 30000);
  });

  describe('Configuration Validation Integration', () => {
    test('should generate valid database configurations', async () => {
      const result = await engine.initializeDatabase(mockInputs.simple);
      const recommendation = result.recommendations[0];

      expect(testUtils.validateConfig(recommendation.configuration)).toBe(true);
      expect(recommendation.configuration.type).toBeDefined();
      expect(recommendation.configuration.connectionPool).toBeDefined();
      expect(recommendation.configuration.security).toBeDefined();
    }, 30000);

    test('should generate environment-specific configurations', async () => {
      const result = await engine.initializeDatabase(mockInputs.simple);
      const recommendation = result.recommendations[0];

      const config = recommendation.configuration;
      expect(config.connectionPool.minConnections).toBeGreaterThan(0);
      expect(config.connectionPool.maxConnections).toBeGreaterThan(
        config.connectionPool.minConnections
      );
      expect(config.backupStrategy.frequency).toBeDefined();
      expect(config.monitoring.enabled).toBe(true);
    }, 30000);
  });

  describe('Error Handling Integration', () => {
    test('should handle empty input gracefully', async () => {
      await expect(engine.initializeDatabase('')).rejects.toThrow();
    });

    test('should handle invalid file input', async () => {
      const invalidFile = createMockFile('', 'empty.txt');

      // Should still process but with low confidence
      const result = await engine.initializeDatabase(invalidFile, {
        inputType: 'dump_file'
      });

      expect(result.analysis.confidence).toBeLessThan(0.5);
    }, 30000);

    test('should handle extremely long input', async () => {
      const longInput = 'I need a database for my application. '.repeat(1000);

      const result = await engine.initializeDatabase(longInput);
      expect(result).toBeDefined();
      expect(result.analysis.input).toBe(longInput);
    }, 30000);
  });

  describe('Performance Integration', () => {
    test('should complete simple analysis within reasonable time', async () => {
      const startTime = Date.now();
      const result = await engine.initializeDatabase(mockInputs.simple);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    }, 15000);

    test('should handle concurrent requests', async () => {
      const promises = [
        engine.initializeDatabase(mockInputs.simple),
        engine.initializeDatabase(mockInputs.iot),
        engine.initializeDatabase('Need a MySQL database for WordPress')
      ];

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.recommendations.length).toBeGreaterThan(0);
      });
    }, 45000);
  });

  describe('Real-world Scenarios Integration', () => {
    test('should handle startup scenario', async () => {
      const startupInput = "I'm a startup building a social media app. We need a database that can handle user profiles, posts, comments, and likes. We expect 1000 users in the first month, growing to 50,000 in 6 months. Budget is tight, around $200/month. We have 2 developers with intermediate database experience.";

      const result = await engine.initializeDatabase(startupInput, {
        preferences: {
          budgetRange: { min: 0, max: 200, currency: 'USD' },
          technicalLevel: 'intermediate'
        }
      });

      expect(result.analysis.context.scale).toBe('startup');
      expect(result.analysis.context.domain).toBe('social');
      expect(result.recommendations[0].estimatedCost.monthly).toBeLessThanOrEqual(200);
    }, 30000);

    test('should handle healthcare scenario', async () => {
      const healthcareInput = "Healthcare application for patient management. Must be HIPAA compliant, support 500 doctors and 50,000 patients. Need high availability (99.99%) and audit logging. Budget is $5000/month. Team includes experienced DBAs.";

      const result = await engine.initializeDatabase(healthcareInput, {
        preferences: {
          budgetRange: { min: 1000, max: 10000, currency: 'USD' },
          technicalLevel: 'expert',
          complianceRequirements: ['hipaa']
        }
      });

      expect(result.analysis.context.domain).toBe('healthcare');
      expect(result.analysis.extractedRequirements.some(req =>
        req.type === 'compliance'
      )).toBe(true);
      expect(result.recommendations[0].configuration.security.auditLogging).toBe(true);
    }, 30000);

    test('should handle IoT analytics scenario', async () => {
      const iotInput = "IoT platform for smart home devices. Collecting sensor data from 100,000 devices, 10 readings per device per hour. Need real-time analytics and 30-day data retention. Looking for cost-effective solution under $1000/month.";

      const result = await engine.initializeDatabase(iotInput, {
        preferences: {
          budgetRange: { min: 0, max: 1000, currency: 'USD' }
        }
      });

      expect(result.analysis.context.domain).toBe('iot');
      expect(result.recommendations.some(r =>
        ['influxdb', 'timescaledb'].includes(r.databaseType)
      )).toBe(true);
    }, 30000);
  });

  describe('Migration Scenarios Integration', () => {
    test('should provide migration recommendations for existing schemas', async () => {
      const migrationSQL = `
        CREATE TABLE old_users (
          user_id INT PRIMARY KEY,
          user_name VARCHAR(100),
          email_address VARCHAR(200),
          created_date DATETIME
        );

        CREATE TABLE old_orders (
          order_id INT PRIMARY KEY,
          user_id INT,
          order_total DECIMAL(10,2),
          order_date DATETIME,
          FOREIGN KEY (user_id) REFERENCES old_users(user_id)
        );
      `;

      const file = createMockFile(migrationSQL, 'legacy_schema.sql', 'application/sql');
      const result = await engine.initializeDatabase(file, {
        inputType: 'dump_file'
      });

      expect(result.analysis.inputType).toBe('dump_file');
      expect(result.recommendations[0].migrationComplexity).toMatch(/^(low|medium|high)$/);
      expect(result.creationPlan.steps.some(s =>
        s.type === 'migration'
      )).toBe(true);
    }, 30000);
  });
});
