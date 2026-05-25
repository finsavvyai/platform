/**
 * VibeTestPilot - Main orchestrator for AI-powered test generation
 */

import { db } from '../../lib/db.js';
import { testCases } from '../../schema/index.js';
import { logger } from '../../utils/logger.js';
import { eq } from 'drizzle-orm';
import { pageAnalyzer } from './PageAnalyzer.js';
import { testCodeGenerator } from './TestCodeGenerator.js';
import { aiTestProvider } from './AITestProvider.js';
import { testPersistence } from './TestPersistence.js';
import type { GenerateOptions, GeneratedTest, TestScenario } from './types.js';

export class VibeTestPilot {
  private static instance: VibeTestPilot;

  private constructor() {}

  static getInstance(): VibeTestPilot {
    if (!VibeTestPilot.instance) {
      VibeTestPilot.instance = new VibeTestPilot();
    }
    return VibeTestPilot.instance;
  }

  async generateFromURL(url: string, options: GenerateOptions): Promise<GeneratedTest[]> {
    const startTime = Date.now();

    try {
      logger.info(`Generating tests from URL: ${url}`, { projectId: options.projectId });

      const pageAnalysis = await pageAnalyzer.analyzePage(url);
      const scenarios = await aiTestProvider.generateScenarios(pageAnalysis);

      const scenariosWithAssertions = await Promise.all(
        scenarios.map(async scenario => ({
          ...scenario,
          assertions: await aiTestProvider.suggestAssertions(scenario),
        }))
      );

      const codes = testCodeGenerator.generatePlaywrightCode(scenariosWithAssertions);
      const generatedTests = codes.map((code, idx) =>
        this.createGeneratedTest(scenariosWithAssertions[idx], code, options)
      );

      await testPersistence.saveGeneratedTests(generatedTests, options);

      const duration = Date.now() - startTime;
      logger.info(`Generated ${generatedTests.length} tests from URL`, {
        projectId: options.projectId,
        duration: `${duration}ms`,
      });

      return generatedTests;
    } catch (error) {
      logger.error(`Failed to generate tests from URL: ${url}`, error);
      throw error;
    }
  }

  async generateFromDescription(description: string, options: GenerateOptions): Promise<GeneratedTest[]> {
    const startTime = Date.now();

    try {
      logger.info('Generating tests from description', { projectId: options.projectId });

      const emptyPageAnalysis = {
        url: options.projectId,
        title: 'Generated from Description',
        formCount: 0,
        buttonsCount: 0,
        linksCount: 0,
        modalsCount: 0,
        elements: [],
        flows: [],
        metadata: { isResponsive: false, hasAccessibility: false },
      };

      const scenarios = await aiTestProvider.generateScenarios(emptyPageAnalysis, description);

      const scenariosWithAssertions = await Promise.all(
        scenarios.map(async scenario => ({
          ...scenario,
          assertions: await aiTestProvider.suggestAssertions(scenario),
        }))
      );

      const codes = testCodeGenerator.generatePlaywrightCode(scenariosWithAssertions);
      const generatedTests = codes.map((code, idx) =>
        this.createGeneratedTest(scenariosWithAssertions[idx], code, options)
      );

      await testPersistence.saveGeneratedTests(generatedTests, options);

      const duration = Date.now() - startTime;
      logger.info(`Generated ${generatedTests.length} tests from description`, {
        projectId: options.projectId,
        duration: `${duration}ms`,
      });

      return generatedTests;
    } catch (error) {
      logger.error('Failed to generate tests from description', error);
      throw error;
    }
  }

  async refineTest(testId: string, feedback: string): Promise<GeneratedTest> {
    try {
      logger.info(`Refining test: ${testId}`);

      const existing = await db.select().from(testCases).where(eq(testCases.id, testId)).limit(1);

      if (existing.length === 0) {
        throw new Error(`Test ${testId} not found`);
      }

      const testData = existing[0];
      const testDataObj = typeof testData.testData === 'string'
        ? JSON.parse(testData.testData)
        : testData.testData;

      const emptyPageAnalysis = {
        url: '',
        title: testData.name,
        formCount: 0,
        buttonsCount: 0,
        linksCount: 0,
        modalsCount: 0,
        elements: [],
        flows: [],
        metadata: { isResponsive: false, hasAccessibility: false },
      };

      const refinedScenarios = await aiTestProvider.generateScenarios(emptyPageAnalysis, feedback);

      const codes = testCodeGenerator.generatePlaywrightCode(refinedScenarios);
      const code = codes[0] || '';

      const refinedTest = this.createGeneratedTest(refinedScenarios[0], code, {
        projectId: testData.projectId,
        userId: testData.userId,
        framework: 'playwright',
      });

      logger.info(`Test refined successfully: ${testId}`);
      return refinedTest;
    } catch (error) {
      logger.error(`Failed to refine test: ${testId}`, error);
      throw error;
    }
  }

  private createGeneratedTest(scenario: TestScenario, code: string, options: GenerateOptions): GeneratedTest {
    const validation = testCodeGenerator.validateGeneratedCode(code);

    return {
      id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      name: scenario.name,
      description: scenario.description,
      scenarios: [scenario],
      code,
      language: 'typescript',
      framework: options.framework || 'playwright',
      validation,
      timestamp: new Date(),
    };
  }
}

export const vibeTestPilot = VibeTestPilot.getInstance();
