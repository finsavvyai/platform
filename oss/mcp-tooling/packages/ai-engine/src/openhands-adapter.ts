/**
 * OpenHands Adapter for MCPoverflow
 * Integrates OpenHands AI capabilities with MCP connector generation
 */

import type {
  OpenAPISpec,
  GraphQLSchema,
  PostmanCollection,
  APISpec,
  MCPConnector,
  TestSuite,
  Documentation,
} from '../types';

interface OpenHandsConfig {
  apiUrl?: string;
  apiKey?: string;
  llm?: 'claude-3.5-sonnet' | 'gpt-4' | 'gpt-4-turbo';
  runtime?: 'docker' | 'cloudflare-workers' | 'local';
  timeout?: number;
}

interface TaskContext {
  [key: string]: any;
}

interface TaskResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    duration: number;
    tokensUsed?: number;
    cost?: number;
  };
}

export class OpenHandsAdapter {
  private config: OpenHandsConfig;
  private baseUrl: string;

  constructor(config?: OpenHandsConfig) {
    // Cloudflare Workers compatible - no process.env
    this.config = {
      apiUrl: config?.apiUrl || 'http://localhost:8000',
      apiKey: config?.apiKey,
      llm: config?.llm || 'gpt-4',
      runtime: config?.runtime || 'docker',
      timeout: config?.timeout || 120000, // 2 minutes default
    };

    this.baseUrl = this.config.apiUrl!;
  }

  /**
   * Execute a task using OpenHands agent
   */
  private async executeTask(
    taskType: string,
    context: TaskContext,
    prompt: string,
    actions?: string[]
  ): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/api/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify({
          taskType,
          context,
          prompt,
          actions,
          config: {
            llm: this.config.llm,
            runtime: this.config.runtime,
            timeout: this.config.timeout,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenHands API error: ${response.statusText}`);
      }

      const result = await response.json();
      const duration = Date.now() - startTime;

      // Debug logging
      console.log('[OpenHandsAdapter] Raw API response:', JSON.stringify(result, null, 2));

      return {
        success: true,
        data: result.data,
        metadata: {
          duration,
          tokensUsed: result.tokensUsed,
          cost: result.cost,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { duration },
      };
    }
  }

  /**
   * Analyze API specification and provide insights
   */
  async analyzeAPI(spec: APISpec): Promise<{
    purpose: string;
    domain: string;
    authMethods: string[];
    rateLimits?: string;
    endpoints: {
      path: string;
      method: string;
      description: string;
      category: string;
    }[];
    dataModels: string[];
    recommendedTools: string[];
    errorHandling: string;
    pagination?: string;
    webhooks?: boolean;
    bestPractices: string[];
  }> {
    // Prefer native /api/analyze when available (used by local OpenHands bridge).
    // Fall back to executeTask for older backends.
    try {
      const response = await fetch(`${this.baseUrl}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify({
          specType: (spec as any).type || 'openapi',
          spec: (spec as any).content || spec,
        }),
      });

      if (response.ok) {
        const direct = await response.json();
        if (direct?.analysis) {
          return direct.analysis;
        }
      }
    } catch {
      // Intentionally ignore and use fallback path below.
    }

    const result = await this.executeTask(
      'analyze_api',
      { spec },
      `Analyze this API specification and return JSON analysis only:\n\n${JSON.stringify(spec, null, 2)}`,
      ['parse_spec', 'extract_metadata', 'analyze_patterns']
    );

    if (!result.success) {
      throw new Error(`Failed to analyze API: ${result.error}`);
    }

    if (result.data?.analysis) {
      return result.data.analysis;
    }

    // Last-resort compatibility: try parsing model text response.
    try {
      const raw = result.data?.result || result.data?.raw || '';
      return JSON.parse(raw);
    } catch {
      return {
        purpose: 'unknown',
        domain: 'unknown',
        authMethods: [],
        endpoints: [],
        dataModels: [],
        recommendedTools: [],
        errorHandling: 'unavailable',
        bestPractices: [],
      };
    }
  }

  /**
   * Generate MCP connector code from API spec
   */
  async generateConnector(
    spec: APISpec,
    options: {
      name: string;
      language: 'typescript' | 'go' | 'python';
      runtime: 'cloudflare-workers' | 'vercel' | 'lambda' | 'docker';
      authConfig?: {
        type: 'apikey' | 'oauth' | 'jwt';
        config: Record<string, any>;
      };
      selectedEndpoints?: string[]; // Endpoint paths to include
      customizations?: Record<string, any>;
    }
  ): Promise<MCPConnector> {
    const result = await this.executeTask(
      'generate_mcp_connector',
      {
        spec,
        options,
      },
      `
        Generate a production-ready MCP (Model Context Protocol) connector for this API.

        API Specification:
        ${JSON.stringify(spec, null, 2)}

        Requirements:
        - Language: ${options.language}
        - Target Runtime: ${options.runtime}
        - Authentication: ${options.authConfig?.type || 'none'}
        ${options.selectedEndpoints ? `- Include only these endpoints: ${options.selectedEndpoints.join(', ')}` : ''}

        Generate a complete connector with:

        1. **Main Connector File**:
           - Implement MCP protocol
           - Define all tools based on API endpoints
           - Handle authentication properly
           - Implement error handling
           - Add rate limiting support
           - Include caching where appropriate

        2. **Type Definitions** (for TypeScript):
           - Request/response types for all endpoints
           - Tool input/output schemas
           - Error types

        3. **Configuration**:
           - Environment variables
           - Default values
           - Runtime-specific config

        4. **Error Handling**:
           - Proper error types
           - Retry logic for transient errors
           - User-friendly error messages

        5. **Documentation**:
           - JSDoc/GoDoc comments
           - Usage examples for each tool
           - Configuration instructions

        Code Quality Requirements:
        - Follow ${options.language} best practices
        - Full type safety
        - Proper error handling
        - Clean, readable code
        - Production-ready (not a prototype)

        Return structured response with:
        - mainFile: Complete connector code
        - types: Type definition files
        - config: Configuration files
        - metadata: Connector information
      `,
      ['analyze_spec', 'design_tools', 'generate_code', 'validate_code']
    );

    if (!result.success) {
      throw new Error(`Failed to generate connector: ${result.error}`);
    }

    // Handle OpenHands response format - defensive null checks
    if (!result.data) {
      throw new Error('No data returned from OpenHands API');
    }

    const generatedCode = result.data.result || result.data.mainFile || result.data;

    return {
      id: crypto.randomUUID(),
      name: options.name,
      language: options.language,
      runtime: options.runtime,
      code: generatedCode,
      types: result.data.types || '',
      config: result.data.config || '',
      tools: result.data.tools || [],
      metadata: {
        generatedAt: new Date().toISOString(),
        generatedBy: 'openhands-ai',
        version: '1.0.0',
        aiModel: this.config.llm,
        duration: result.metadata?.duration,
        ...(result.data.metadata || {}),
      },
    };
  }

  /**
   * Generate comprehensive test suite for connector
   */
  async generateTests(
    connector: MCPConnector,
    spec: APISpec
  ): Promise<TestSuite> {
    const result = await this.executeTask(
      'generate_tests',
      {
        connectorCode: connector.code,
        apiSpec: spec,
        language: connector.language,
      },
      `
        Generate a comprehensive test suite for this MCP connector.

        Connector Code:
        ${connector.code}

        Generate tests for:

        1. **Unit Tests**:
           - Test each MCP tool independently
           - Mock API responses
           - Test input validation
           - Test error handling
           - Test edge cases

        2. **Integration Tests**:
           - Test with actual API (if sandbox available)
           - Test authentication flow
           - Test rate limiting behavior
           - Test caching

        3. **End-to-End Tests**:
           - Test complete workflows
           - Test error recovery
           - Test concurrent requests

        4. **Performance Tests**:
           - Measure response times
           - Test under load
           - Memory usage

        For each tool in the connector:
        - Test successful requests with valid inputs
        - Test error responses (4xx, 5xx)
        - Test parameter validation
        - Test boundary values
        - Test null/undefined handling

        Generate executable test code using:
        - Jest/Vitest for TypeScript
        - testing package for Go
        - pytest for Python

        Include:
        - Test setup/teardown
        - Mock server setup
        - Test data fixtures
        - Coverage configuration
      `,
      ['analyze_connector', 'identify_test_cases', 'generate_test_code']
    );

    if (!result.success) {
      throw new Error(`Failed to generate tests: ${result.error}`);
    }

    return {
      unitTests: result.data.unitTests,
      integrationTests: result.data.integrationTests,
      e2eTests: result.data.e2eTests,
      fixtures: result.data.fixtures,
      config: result.data.testConfig,
      coverage: {
        target: 80,
        current: 0, // Will be calculated after running tests
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        testFramework: result.data.framework,
      },
    };
  }

  /**
   * Validate connector by actually testing it
   */
  async validateConnector(
    connector: MCPConnector,
    tests: TestSuite
  ): Promise<{
    valid: boolean;
    issues: Array<{
      severity: 'error' | 'warning' | 'info';
      message: string;
      location?: string;
      suggestion?: string;
    }>;
    testResults: {
      passed: number;
      failed: number;
      skipped: number;
      duration: number;
    };
    performance: {
      avgResponseTime: number;
      p95ResponseTime: number;
      p99ResponseTime: number;
    };
  }> {
    const result = await this.executeTask(
      'validate_connector',
      {
        connector,
        tests,
      },
      `
        Validate this MCP connector by running all tests and checks.

        Steps:
        1. Deploy connector to test environment
        2. Run all unit tests
        3. Run integration tests
        4. Measure performance
        5. Check for common issues:
           - Type errors
           - Missing error handling
           - Security vulnerabilities
           - Performance bottlenecks
           - Memory leaks

        Return detailed validation report.
      `,
      ['deploy_test', 'run_tests', 'analyze_results', 'check_issues']
    );

    if (!result.success) {
      throw new Error(`Failed to validate connector: ${result.error}`);
    }

    return result.data.validation;
  }

  /**
   * Fix broken connector automatically
   */
  async fixConnector(
    connector: MCPConnector,
    error: {
      message: string;
      stack?: string;
      apiResponse?: any;
    }
  ): Promise<{
    fixed: boolean;
    fixedCode?: string;
    explanation: string;
    confidence: number;
    changes: string[];
  }> {
    const result = await this.executeTask(
      'fix_connector',
      {
        connectorCode: connector.code,
        error,
      },
      `
        This MCP connector is failing with an error. Analyze and fix it.

        Connector Code:
        ${connector.code.substring(0, 5000)}... // Truncated for prompt

        Error:
        ${error.message}
        ${error.stack || ''}
        ${error.apiResponse ? `API Response: ${JSON.stringify(error.apiResponse)}` : ''}

        Analyze:
        1. What is the root cause of this error?
        2. Has the API changed? (check against spec if available)
        3. Is this a code bug or configuration issue?
        4. What needs to be updated?

        Fix:
        1. Update the connector code to fix the issue
        2. Ensure backward compatibility if possible
        3. Add error handling to prevent similar issues
        4. Add logging for debugging

        Return:
        - Fixed code (complete file)
        - Explanation of changes
        - Confidence level (0-1)
        - List of specific changes made
      `,
      ['analyze_error', 'identify_root_cause', 'generate_fix', 'validate_fix']
    );

    if (!result.success) {
      throw new Error(`Failed to fix connector: ${result.error}`);
    }

    return result.data.fix;
  }

  /**
   * Generate documentation for connector
   */
  async generateDocumentation(
    connector: MCPConnector,
    spec: APISpec
  ): Promise<Documentation> {
    const result = await this.executeTask(
      'generate_documentation',
      {
        connector,
        spec,
      },
      `
        Generate comprehensive documentation for this MCP connector.

        Include:

        1. **README.md**:
           - Overview of what the connector does
           - Installation instructions
           - Configuration guide
           - Quick start examples
           - Troubleshooting section

        2. **API Reference**:
           - List all available MCP tools
           - For each tool:
             * Description
             * Input parameters (with types)
             * Return value (with type)
             * Example usage
             * Possible errors

        3. **Authentication Guide**:
           - How to obtain credentials
           - How to configure authentication
           - Example configurations

        4. **Usage Examples**:
           - Common use cases with code examples
           - Advanced usage patterns
           - Integration with popular AI frameworks

        5. **Changelog**:
           - Version history
           - Breaking changes
           - New features

        Format all documentation in Markdown.
        Make it beginner-friendly with plenty of examples.
      `,
      ['analyze_connector', 'extract_tools', 'generate_docs', 'format_markdown']
    );

    if (!result.success) {
      throw new Error(`Failed to generate documentation: ${result.error}`);
    }

    return {
      readme: result.data.readme,
      apiReference: result.data.apiReference,
      authGuide: result.data.authGuide,
      examples: result.data.examples,
      changelog: result.data.changelog,
      metadata: {
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Generate connector from natural language description
   */
  async generateFromDescription(description: string): Promise<{
    connector: MCPConnector;
    tests: TestSuite;
    documentation: Documentation;
  }> {
    const result = await this.executeTask(
      'generate_from_nl',
      { description },
      `
        A user wants to create an MCP connector and described it like this:

        "${description}"

        Your task:
        1. **Identify the API**: Figure out which API they're referring to
        2. **Fetch API Spec**: Try to find the OpenAPI/GraphQL spec for that API
        3. **Extract Requirements**: What features do they need?
        4. **Design Connector**: Design the MCP tools structure
        5. **Generate Code**: Create the complete connector
        6. **Generate Tests**: Create test suite
        7. **Generate Docs**: Create documentation

        If you can't find the API spec automatically, return what you can determine
        and ask for the spec URL.

        Return complete connector + tests + docs if possible.
      `,
      [
        'identify_api',
        'fetch_spec',
        'extract_requirements',
        'generate_connector',
        'generate_tests',
        'generate_docs',
      ]
    );

    if (!result.success) {
      throw new Error(`Failed to generate from description: ${result.error}`);
    }

    const payload = result.data || {};
    if (payload.connector && payload.tests && payload.documentation) {
      return {
        connector: payload.connector,
        tests: payload.tests,
        documentation: payload.documentation,
      };
    }

    // Compatibility fallback for backends that return plain text in data.result/raw.
    const raw = payload.result || payload.raw || '';
    return {
      connector: {
        name: 'generated-from-description',
        language: 'typescript',
        runtime: 'cloudflare-workers',
        mainFile: String(raw),
      } as unknown as MCPConnector,
      tests: {
        framework: 'unknown',
        testFiles: [],
      } as unknown as TestSuite,
      documentation: {
        readme: String(raw),
      } as unknown as Documentation,
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    version?: string;
    latency?: number;
  }> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const latency = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        return {
          healthy: true,
          version: data.version,
          latency,
        };
      }

      return { healthy: false, latency };
    } catch (error) {
      return { healthy: false };
    }
  }
}

// Export singleton instance
export const openhandsAdapter = new OpenHandsAdapter();

// Export types
export type {
  OpenHandsConfig,
  TaskContext,
  TaskResult,
};
