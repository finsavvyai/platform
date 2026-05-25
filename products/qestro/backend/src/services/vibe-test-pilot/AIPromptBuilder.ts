/**
 * AIPromptBuilder - Constructs prompts for OpenAI test generation
 */

import type { PageAnalysis, TestScenario, TestFailure, APIEndpoint } from './types.js';

export class AIPromptBuilder {
  buildScenariosPrompt(context: PageAnalysis, requirements?: string): string {
    return `
Analyze the following page and generate comprehensive test scenarios.

Page Information:
- URL: ${context.url}
- Title: ${context.title}
- Forms: ${context.formCount}
- Buttons: ${context.buttonsCount}
- Links: ${context.linksCount}
- User Flows: ${context.flows.map(f => f.name).join(', ')}

Elements Found:
${context.elements.map(e => `- ${e.type}: ${e.text || e.placeholder || e.ariaLabel || e.selector}`).join('\n')}

${requirements ? `Additional Requirements: ${requirements}` : ''}

Generate 3-5 comprehensive test scenarios in JSON format. For each scenario include:
- name: Descriptive test name
- description: What the test validates
- steps: Array of test steps (action, target, value)
- assertions: Array of assertions to verify
- tags: Relevant tags
- difficulty: easy/medium/hard

Return as JSON object with "scenarios" array.
`;
  }

  buildAssertionsPrompt(scenario: TestScenario): string {
    return `
For the following test scenario, suggest relevant assertions to validate the expected behavior.

Scenario: ${scenario.name}
Description: ${scenario.description}
Expected Results: ${scenario.expectedResults.join(', ')}

Generate 3-5 assertions in JSON format. For each assertion include:
- type: text, visible, hidden, enabled, disabled, url, title, attribute, count
- target: The element selector or page element to assert
- expected: The expected value
- description: What this assertion validates

Return as JSON object with "assertions" array.
`;
  }

  buildFailureAnalysisPrompt(error: TestFailure): string {
    return `
Analyze the following test failure and suggest a fix.

Test ID: ${error.testId}
Error: ${error.error}
Stack Trace: ${error.stackTrace || 'N/A'}
Failed Step: ${error.failedStep ? `${error.failedStep.action} on ${error.failedStep.target}` : 'Unknown'}

Generate a healing suggestion in JSON format with:
- type: selector, timing, assertion, logic, api, or unknown
- description: What caused the failure
- suggestedFix: How to fix it
- confidence: 0-1 confidence score
- code: Optional code fix

Return as JSON object.
`;
  }

  buildAPITestsPrompt(endpoints: APIEndpoint[]): string {
    return `
Generate test code for the following API endpoints.

Endpoints:
${endpoints
  .map(
    e => `
- ${e.method} ${e.path}
  Base URL: ${e.baseUrl}
  ${e.params ? `Params: ${JSON.stringify(e.params)}` : ''}
  ${e.body ? `Body: ${JSON.stringify(e.body)}` : ''}
  ${e.auth ? `Auth: ${e.auth.type}` : ''}
`
  )
  .join('\n')}

Generate Playwright test code for each endpoint. Include:
- Proper setup and teardown
- Request assertions (status code, content-type)
- Response validation
- Error handling

Return as JSON object with "tests" array of code strings.
`;
  }
}
