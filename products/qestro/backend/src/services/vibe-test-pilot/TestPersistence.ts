/**
 * TestPersistence - Database operations for generated tests
 */

import { db } from '../../lib/db.js';
import { testCases } from '../../schema/index.js';
import { logger } from '../../utils/logger.js';
import type { GeneratedTest, GenerateOptions } from './types.js';

export class TestPersistence {
  async saveGeneratedTests(tests: GeneratedTest[], options: GenerateOptions): Promise<void> {
    try {
      for (const test of tests) {
        const testData = {
          projectId: options.projectId,
          userId: options.userId,
          name: test.name,
          description: test.description,
          type: options.framework === 'maestro' ? 'mobile' : 'web',
          platform: options.framework || 'playwright',
          testData: JSON.stringify({
            code: test.code,
            scenarios: test.scenarios,
            generatedAt: test.timestamp.toISOString(),
          }),
          expectedResults: test.scenarios.flatMap(s => s.expectedResults),
          tags: ['ai-generated', 'vibe-test-pilot', ...(test.scenarios[0]?.tags || [])],
          isActive: true,
        };

        await db.insert(testCases).values(testData as any);
      }

      logger.info(`Saved ${tests.length} generated tests to database`);
    } catch (error) {
      logger.error('Failed to save generated tests', error);
    }
  }
}

export const testPersistence = new TestPersistence();
