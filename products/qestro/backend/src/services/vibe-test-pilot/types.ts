/**
 * Type definitions for the Vibe Test Pilot engine
 */

export interface GenerateOptions {
  projectId: string;
  userId: string;
  framework?: 'playwright' | 'cypress' | 'maestro' | 'api';
  includeAssertions?: boolean;
  includeScreenshots?: boolean;
  targetBrowsers?: ('chromium' | 'firefox' | 'webkit')[];
  headless?: boolean;
}

export interface PageElement {
  selector: string;
  type: 'button' | 'input' | 'link' | 'form' | 'modal' | 'navbar' | 'other';
  text?: string;
  ariaLabel?: string;
  placeholder?: string;
  index?: number;
}

export interface UserFlow {
  name: string;
  steps: string[];
  elements: PageElement[];
  expectedOutcome?: string;
}

export interface PageAnalysis {
  url: string;
  title: string;
  formCount: number;
  buttonsCount: number;
  linksCount: number;
  modalsCount: number;
  elements: PageElement[];
  flows: UserFlow[];
  metadata: {
    loadTime?: number;
    isResponsive: boolean;
    hasAccessibility: boolean;
  };
}

export interface TestStep {
  action: 'goto' | 'click' | 'fill' | 'select' | 'wait' | 'screenshot' | 'hover' | 'press';
  target?: string; // selector or URL
  value?: string;
  timeout?: number;
  description?: string;
}

export interface Assertion {
  type: 'text' | 'visible' | 'hidden' | 'enabled' | 'disabled' | 'url' | 'title' | 'attribute' | 'count';
  target: string;
  expected?: string | number | boolean;
  description?: string;
}

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  steps: TestStep[];
  assertions: Assertion[];
  expectedResults: string[];
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  syntax?: {
    hasParseErrors: boolean;
    parseErrors: string[];
  };
}

export interface GeneratedTest {
  id: string;
  name: string;
  description: string;
  scenarios: TestScenario[];
  code: string; // Playwright or API test code
  language: 'typescript' | 'javascript' | 'yaml';
  framework: string;
  validation: ValidationResult;
  timestamp: Date;
}

export interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  baseUrl: string;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  auth?: {
    type: 'bearer' | 'basic' | 'oauth';
    token?: string;
    username?: string;
    password?: string;
  };
}

export interface TestFailure {
  testId: string;
  error: string;
  stackTrace?: string;
  screenshot?: Buffer;
  timestamp: Date;
  stepIndex?: number;
  failedStep?: TestStep;
}

export interface HealingSuggestion {
  type: 'selector' | 'timing' | 'assertion' | 'logic' | 'api' | 'unknown';
  description: string;
  suggestedFix: string;
  confidence: number;
  code?: string;
}

export interface AIProvider {
  generateScenarios(
    context: PageAnalysis,
    requirements?: string
  ): Promise<TestScenario[]>;

  suggestAssertions(scenario: TestScenario): Promise<Assertion[]>;

  analyzeFailure(error: TestFailure): Promise<HealingSuggestion>;

  generateAPITests(endpoints: APIEndpoint[]): Promise<string[]>;
}

export interface TestGenerationContext {
  projectId: string;
  userId: string;
  url?: string;
  description?: string;
  pageAnalysis?: PageAnalysis;
  options: GenerateOptions;
}
