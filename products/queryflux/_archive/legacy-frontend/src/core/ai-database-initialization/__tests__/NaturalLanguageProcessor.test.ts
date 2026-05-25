/**
 * Natural Language Processor Tests
 *
 * Comprehensive test suite for the Natural Language Processor component.
 */

import { NaturalLanguageProcessor } from '../processors/NaturalLanguageProcessor';
import { mockConfig, mockInputs, mockNLAnalysis } from './setup';
import { mockNLAnalysis as expectedMockNLAnalysis } from './mocks/AIMockResponses';

describe('NaturalLanguageProcessor', () => {
  let processor: NaturalLanguageProcessor;

  beforeEach(() => {
    processor = new NaturalLanguageProcessor(mockConfig);
  });

  describe('Basic Analysis', () => {
    test('should process simple database request', async () => {
      const result = await processor.analyze(mockInputs.simple);

      expect(result).toEqual(
        expect.objectContaining({
          input: mockInputs.simple,
          intent: expect.any(String),
          entities: expect.any(Array),
          constraints: expect.any(Array),
          requirements: expect.any(Array),
          context: expect.any(Object),
          confidence: expect.any(Number)
        })
      );

      expect(result.intent).toBe('create_database');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('should identify database type correctly', async () => {
      const result = await processor.analyze('I need a MongoDB database for my app');

      const databaseEntity = result.entities.find(e => e.type === 'database_type');
      expect(databaseEntity).toBeDefined();
      expect(databaseEntity?.value).toBe('mongodb');
      expect(databaseEntity?.confidence).toBeGreaterThan(0.8);
    });

    test('should extract performance requirements', async () => {
      const result = await processor.analyze('Database must handle 5000 queries per second with low latency');

      const performanceEntity = result.entities.find(e => e.type === 'performance');
      expect(performanceEntity).toBeDefined();
      expect(performanceEntity?.value).toContain('5000');
      expect(performanceEntity?.confidence).toBeGreaterThan(0.7);
    });

    test('should extract budget constraints', async () => {
      const result = await processor.analyze('Budget is $200 per month for the database');

      const budgetEntity = result.entities.find(e => e.type === 'budget');
      expect(budgetEntity).toBeDefined();
      expect(budgetEntity?.value).toContain('200');
      expect(budgetEntity?.confidence).toBeGreaterThan(0.8);
    });

    test('should detect compliance requirements', async () => {
      const result = await processor.analyze('Need HIPAA and GDPR compliance for healthcare data');

      const complianceEntities = result.entities.filter(e => e.type === 'compliance');
      expect(complianceEntities.length).toBeGreaterThan(0);

      const hipaaEntity = complianceEntities.find(e => e.value.toLowerCase().includes('hipaa'));
      const gdprEntity = complianceEntities.find(e => e.value.toLowerCase().includes('gdpr'));

      expect(hipaaEntity).toBeDefined();
      expect(gdprEntity).toBeDefined();
    });
  });

  describe('Context Analysis', () => {
    test('should detect ecommerce domain correctly', async () => {
      const result = await processor.analyze('E-commerce platform with products and orders');

      expect(result.context.domain).toBe('ecommerce');
    });

    test('should detect healthcare domain correctly', async () => {
      const result = await processor.analyze('Medical records and patient data system');

      expect(result.context.domain).toBe('healthcare');
    });

    test('should detect IoT domain correctly', async () => {
      const result = await processor.analyze('IoT sensor data from smart devices');

      expect(result.context.domain).toBe('iot');
    });

    test('should estimate scale correctly', async () => {
      const smallScale = await processor.analyze('Personal blog with few users');
      expect(smallScale.context.scale).toBe('personal');

      const largeScale = await processor.analyze('Enterprise system for large corporation');
      expect(largeScale.context.scale).toBe('enterprise');
    });

    test('should estimate team size correctly', async () => {
      const soloDev = await processor.analyze('Just me working on this project');
      expect(soloDev.context.teamSize).toBe('solo');

      const teamDev = await processor.analyze('Team of 15 developers working on this');
      expect(teamDev.context.teamSize).toBe('medium');
    });

    test('should estimate budget level correctly', async () => {
      const bootstrapBudget = await processor.analyze('Budget is $50 per month');
      expect(bootstrapBudget.context.budgetLevel).toBe('bootstrap');

      const enterpriseBudget = await processor.analyze('Budget is $50,000 per month');
      expect(enterpriseBudget.context.budgetLevel).toBe('enterprise');
    });
  });

  describe('Intent Detection', () => {
    test('should detect creation intent', async () => {
      const result = await processor.analyze('I want to create a new database');
      expect(result.intent).toBe('create_database');
    });

    test('should detect migration intent', async () => {
      const result = await processor.analyze('I need to migrate my existing database');
      expect(result.intent).toBe('migrate_database');
    });

    test('should detect optimization intent', async () => {
      const result = await processor.analyze('How can I optimize my database performance');
      expect(result.intent).toBe('optimize_database');
    });

    test('should detect analysis intent', async () => {
      const result = await processor.analyze('Can you analyze my database schema');
      expect(result.intent).toBe('analyze_schema');
    });
  });

  describe('Requirement Extraction', () => {
    test('should extract performance requirements', async () => {
      const result = await processor.analyze('Need 99.9% uptime and response time under 100ms');

      const performanceReqs = result.requirements.filter(r => r.category === 'performance');
      expect(performanceReqs.length).toBeGreaterThan(0);

      const uptimeReq = performanceReqs.find(r => r.metric === 'availability');
      expect(uptimeReq).toBeDefined();
      expect(uptimeReq?.target).toBe(99.9);
    });

    test('should extract scalability requirements', async () => {
      const result = await processor.analyze('Must scale to support 1 million users');

      const scaleReqs = result.requirements.filter(r => r.category === 'scalability');
      expect(scaleReqs.length).toBeGreaterThan(0);

      const usersReq = scaleReqs.find(r => r.metric === 'max_capacity');
      expect(usersReq).toBeDefined();
      expect(usersReq?.target).toBe(1000000);
    });

    test('should extract cost requirements', async () => {
      const result = await processor.analyze('Monthly budget should not exceed $1000');

      const costReqs = result.requirements.filter(r => r.category === 'cost');
      expect(costReqs.length).toBeGreaterThan(0);

      const budgetReq = costReqs.find(r => r.metric === 'monthly_cost');
      expect(budgetReq).toBeDefined();
      expect(budgetReq?.target).toBe(1000);
    });

    test('should assign correct priorities', async () => {
      const critical = await processor.analyze('Must have 99.99% uptime - this is critical');
      const criticalReqs = critical.requirements.filter(r => r.priority === 'critical');
      expect(criticalReqs.length).toBeGreaterThan(0);

      const lowPriority = await processor.analyze('Would be nice to have caching');
      const lowReqs = lowPriority.requirements.filter(r => r.priority === 'low');
      expect(lowReqs.length).toBeGreaterThan(0);
    });
  });

  describe('Constraint Extraction', () => {
    test('should extract performance constraints', async () => {
      const result = await processor.analyze('Response time must be under 50ms');

      const performanceConstraints = result.constraints.filter(c => c.type === 'performance');
      expect(performanceConstraints.length).toBeGreaterThan(0);

      const latencyConstraint = performanceConstraints.find(c =>
        c.description.toLowerCase().includes('response time')
      );
      expect(latencyConstraint).toBeDefined();
      expect(latencyConstraint?.priority).toBe('high');
      expect(latencyConstraint?.measurable).toBe(true);
    });

    test('should extract security constraints', async () => {
      const result = await processor.analyze('Data must be encrypted and secure');

      const securityConstraints = result.constraints.filter(c => c.type === 'compliance');
      expect(securityConstraints.length).toBeGreaterThan(0);

      const encryptionConstraint = securityConstraints.find(c =>
        c.description.toLowerCase().includes('encrypted')
      );
      expect(encryptionConstraint).toBeDefined();
      expect(encryptionConstraint?.priority).toBe('critical');
    });

    test('should extract business constraints', async () => {
      const result = await processor.analyze('Budget limit is $500 per month');

      const businessConstraints = result.constraints.filter(c => c.type === 'business');
      expect(businessConstraints.length).toBeGreaterThan(0);

      const budgetConstraint = businessConstraints.find(c =>
        c.description.toLowerCase().includes('budget')
      );
      expect(budgetConstraint).toBeDefined();
      expect(budgetConstraint?.measurable).toBe(true);
    });
  });

  describe('Confidence Scoring', () => {
    test('should have high confidence for clear requirements', async () => {
      const result = await processor.analyze('I need a PostgreSQL database with 1000 concurrent users, 99.9% uptime, budget $500/month');

      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('should have lower confidence for vague requirements', async () => {
      const result = await processor.analyze('I need a database');

      expect(result.confidence).toBeLessThan(0.7);
    });

    test('should increase confidence with more entities extracted', async () => {
      const vague = await processor.analyze('database');
      const detailed = await processor.analyze('PostgreSQL database with 10000 users, 99.9% uptime, $500/month budget, GDPR compliance');

      expect(detailed.confidence).toBeGreaterThan(vague.confidence);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty input gracefully', async () => {
      const result = await processor.analyze('');

      expect(result.input).toBe('');
      expect(result.confidence).toBeLessThan(0.5);
    });

    test('should handle very long input', async () => {
      const longInput = 'I need a database '.repeat(1000);
      const result = await processor.analyze(longInput);

      expect(result).toBeDefined();
      expect(result.input).toBe(longInput);
    });

    test('should handle special characters', async () => {
      const result = await processor.analyze('I need a PostgreSQL database with UTF-8 support for émojis 🚀 and special chars ñiño');

      expect(result).toBeDefined();
      expect(result.entities.length).toBeGreaterThan(0);
    });

    test('should handle mixed case input', async () => {
      const result = await processor.analyze('I NEED A MONGODB DATABASE WITH HIGH PERFORMANCE');

      const databaseEntity = result.entities.find(e => e.type === 'database_type');
      expect(databaseEntity?.value.toLowerCase()).toBe('mongodb');
    });
  });

  describe('Entity Extraction Accuracy', () => {
    test('should extract multiple database types', async () => {
      const result = await processor.analyze('Choosing between PostgreSQL and MongoDB for my application');

      const databaseEntities = result.entities.filter(e => e.type === 'database_type');
      expect(databaseEntities.length).toBe(2);

      const types = databaseEntities.map(e => e.value.toLowerCase());
      expect(types).toContain('postgresql');
      expect(types).toContain('mongodb');
    });

    test('should extract numeric values correctly', async () => {
      const result = await processor.analyze('Support 1,234,567 users with 99.95% uptime under $1,234.56 budget');

      expect(result.entities.length).toBeGreaterThan(2);

      // Check that large numbers are handled correctly
      const entities = result.entities.map(e => e.value);
      const hasLargeNumber = entities.some(e => e.includes('1234567'));
      expect(hasLargeNumber).toBe(true);
    });

    test('should handle units and multipliers correctly', async () => {
      const result = await processor.analyze('1M requests per second, 10GB storage, 512MB RAM');

      expect(result.entities.length).toBeGreaterThan(0);

      // Should identify the scale indicators
      const entities = result.entities.map(e => e.value.toLowerCase());
      expect(entities.some(e => e.includes('1m') || e.includes('1 million'))).toBe(true);
    });
  });

  describe('Synonyms and Variations', () => {
    test('should recognize database synonyms', async () => {
      const postgres1 = await processor.analyze('I need Postgres');
      const postgres2 = await processor.analyze('I need PostgreSQL');

      const entity1 = postgres1.entities.find(e => e.type === 'database_type');
      const entity2 = postgres2.entities.find(e => e.type === 'database_type');

      expect(entity1?.value.toLowerCase()).toBe(entity2?.value.toLowerCase());
    });

    test('should recognize performance variations', async () => {
      const fast = await processor.analyze('Need fast database');
      const performant = await processor.analyze('Need performant database');
      const highPerf = await processor.analyze('Need high performance database');

      const perf1 = fast.entities.find(e => e.type === 'performance');
      const perf2 = performant.entities.find(e => e.type === 'performance');
      const perf3 = highPerf.entities.find(e => e.type === 'performance');

      expect(perf1).toBeDefined();
      expect(perf2).toBeDefined();
      expect(perf3).toBeDefined();
    });
  });
});
