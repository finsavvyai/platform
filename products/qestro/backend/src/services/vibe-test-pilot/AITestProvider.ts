/**
 * AITestProvider - OpenAI integration for test generation
 * Uses structured JSON output to generate test scenarios and assertions
 */

import { logger } from '../../utils/logger.js';
import { AIPromptBuilder } from './AIPromptBuilder.js';
import { AIResponseParser } from './AIResponseParser.js';
import type {
  PageAnalysis,
  TestScenario,
  Assertion,
  TestFailure,
  HealingSuggestion,
  APIEndpoint,
  AIProvider,
} from './types.js';

export class AITestProvider implements AIProvider {
  private readonly apiKey: string;
  private readonly model: string = 'gpt-4-turbo-preview';
  private readonly maxRetries: number = 3;
  private readonly retryDelay: number = 1000;
  private promptBuilder: AIPromptBuilder;
  private responseParser: AIResponseParser;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.promptBuilder = new AIPromptBuilder();
    this.responseParser = new AIResponseParser();
    if (!this.apiKey) {
      logger.warn('OpenAI API key not configured for AITestProvider');
    }
  }

  async generateScenarios(context: PageAnalysis, requirements?: string): Promise<TestScenario[]> {
    const prompt = this.promptBuilder.buildScenariosPrompt(context, requirements);

    try {
      const response = await this.callOpenAI(prompt);
      const scenarios = this.responseParser.parseScenarios(response);
      logger.info(`Generated ${scenarios.length} test scenarios`);
      return scenarios;
    } catch (error) {
      logger.error('Failed to generate scenarios', error);
      throw error;
    }
  }

  async suggestAssertions(scenario: TestScenario): Promise<Assertion[]> {
    const prompt = this.promptBuilder.buildAssertionsPrompt(scenario);

    try {
      const response = await this.callOpenAI(prompt);
      const assertions = this.responseParser.parseAssertions(response);
      logger.info(`Generated ${assertions.length} assertions for: ${scenario.name}`);
      return assertions;
    } catch (error) {
      logger.error('Failed to suggest assertions', error);
      return [];
    }
  }

  async analyzeFailure(error: TestFailure): Promise<HealingSuggestion> {
    const prompt = this.promptBuilder.buildFailureAnalysisPrompt(error);

    try {
      const response = await this.callOpenAI(prompt);
      const suggestion = this.responseParser.parseHealingSuggestion(response);
      logger.info(`Generated healing suggestion for: ${error.testId}`);
      return suggestion;
    } catch (error) {
      logger.error('Failed to analyze test failure', error);
      return {
        type: 'unknown',
        description: 'Unable to analyze failure',
        suggestedFix: 'Please review manually',
        confidence: 0,
      };
    }
  }

  async generateAPITests(endpoints: APIEndpoint[]): Promise<string[]> {
    const prompt = this.promptBuilder.buildAPITestsPrompt(endpoints);

    try {
      const response = await this.callOpenAI(prompt);
      const tests = this.responseParser.parseAPITests(response);
      logger.info(`Generated API tests for ${tests.length} endpoints`);
      return tests;
    } catch (error) {
      logger.error('Failed to generate API tests', error);
      return [];
    }
  }

  private async callOpenAI(prompt: string, retries: number = 0): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert test automation engineer. Generate high-quality, maintainable test code.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 2000,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const error = await response.json() as { error?: { message?: string } };
        throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown'}`);
      }

      const data = await response.json() as { choices: Array<{ message?: { content?: string } }> };
      return data.choices[0]?.message?.content || '';
    } catch (error) {
      if (retries < this.maxRetries) {
        logger.warn(`Retry ${retries + 1}/${this.maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (retries + 1)));
        return this.callOpenAI(prompt, retries + 1);
      }
      throw error;
    }
  }
}

export const aiTestProvider = new AITestProvider();
