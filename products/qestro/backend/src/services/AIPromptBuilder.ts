import type {
  TestGenerationRequest,
  BugAnalysisRequest,
  PerformanceAnalysisRequest,
} from "../types/ai.types.js";

export function buildTestGenerationPrompt(
  request: TestGenerationRequest,
): string {
  return `
    Generate a comprehensive ${request.framework || "generic"} test for ${request.platform} platform.

    Requirements:
    - Description: ${request.description}
    - Complexity: ${request.complexity}
    - Platform: ${request.platform}
    - Framework: ${request.framework || "generic"}

    Generate:
    1. Complete test code with proper selectors
    2. Test data setup and teardown
    3. Assertions for expected behavior
    4. Error handling
    5. Comments explaining the test logic

    Make the test robust, maintainable, and following best practices.
    `;
}

export function buildBugAnalysisPrompt(request: BugAnalysisRequest): string {
  return `
    Analyze this bug report and provide detailed analysis:

    Title: ${request.title}
    Description: ${request.description}
    Stack Trace: ${request.stackTrace || "Not provided"}
    Browser Info: ${JSON.stringify(request.browserInfo || {})}
    Reproduction Steps: ${request.reproductionSteps?.join("\n") || "Not provided"}

    Provide:
    1. Bug severity assessment (low/medium/high/critical)
    2. Bug category (UI, functional, performance, security, etc.)
    3. Root cause analysis
    4. Suggested fix with code examples
    5. Prevention strategies
    6. Similar known issues

    Format as JSON with clear structure.
    `;
}

export function buildPerformanceAnalysisPrompt(
  request: PerformanceAnalysisRequest,
): string {
  return `
    Analyze these performance metrics and provide insights:

    Platform: ${request.platform}
    Time Range: ${request.timeRange}
    Metrics: ${JSON.stringify(request.metrics)}
    Baseline: ${JSON.stringify(request.baseline || {})}

    Provide:
    1. Performance bottlenecks identification
    2. Optimization recommendations
    3. Trend analysis
    4. Performance alerts
    5. Resource utilization insights
    6. Comparison with industry benchmarks

    Format as structured JSON response.
    `;
}

export function buildCodeOptimizationPrompt(data: {
  code: string;
  framework?: string;
  issues?: string[];
}): string {
  return `
    Optimize this test code for better performance, reliability, and maintainability:

    ${data.code}

    Framework: ${data.framework}
    Current issues: ${data.issues?.join(", ") || "None specified"}

    Provide:
    1. Optimized code
    2. List of improvements made
    3. Performance impact estimation
    4. Reliability improvements
    `;
}
