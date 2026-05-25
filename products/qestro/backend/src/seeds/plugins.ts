import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { plugins } from '../schema/index.js';

export async function seedPlugins(db: PostgresJsDatabase<any>, users: any[]) {
  const developerUser = users.find(u => u.email === 'developer@qestro.app');
  
  if (!developerUser) {
    throw new Error('Developer user not found for plugin seeding');
  }

  const samplePlugins = [
    {
      name: 'Playwright Test Generator',
      slug: 'playwright-test-generator',
      version: '1.0.0',
      authorId: developerUser.id,
      type: 'test-generator',
      category: 'Test Generators',
      description: 'Generate Playwright test scripts from recorded actions',
      longDescription: 'This plugin converts recorded user interactions into comprehensive Playwright test scripts with intelligent assertions and best practices.',
      code: `
export default class PlaywrightGenerator {
  generate(recording) {
    const actions = recording.actions;
    let testCode = 'import { test, expect } from "@playwright/test";\\n\\n';
    testCode += 'test("' + recording.name + '", async ({ page }) => {\\n';
    
    actions.forEach(action => {
      switch(action.type) {
        case 'navigate':
          testCode += '  await page.goto("' + action.url + '");\\n';
          break;
        case 'click':
          testCode += '  await page.click("' + action.selector + '");\\n';
          break;
        case 'type':
          testCode += '  await page.fill("' + action.selector + '", "' + action.text + '");\\n';
          break;
        case 'assert':
          testCode += '  await expect(page.locator("' + action.selector + '")).toHaveText("' + action.expectedText + '");\\n';
          break;
      }
    });
    
    testCode += '});';
    return testCode;
  }
}`,
      entryPoint: 'PlaywrightGenerator',
      configuration: {
        supportedBrowsers: ['chromium', 'firefox', 'webkit'],
        outputFormat: 'typescript',
        includeAssertions: true
      },
      permissions: ['read:recordings', 'write:tests'],
      isPublic: true,
      isApproved: true,
      status: 'published',
      publishedAt: new Date(),
    },
    {
      name: 'Cypress Test Generator',
      slug: 'cypress-test-generator',
      version: '1.2.0',
      authorId: developerUser.id,
      type: 'test-generator',
      category: 'Test Generators',
      description: 'Convert recordings to Cypress test scripts',
      longDescription: 'Generate robust Cypress test scripts with custom commands and best practices from your recorded user interactions.',
      code: `
export default class CypressGenerator {
  generate(recording) {
    const actions = recording.actions;
    let testCode = 'describe("' + recording.name + '", () => {\\n';
    testCode += '  it("should complete user flow", () => {\\n';
    
    actions.forEach(action => {
      switch(action.type) {
        case 'navigate':
          testCode += '    cy.visit("' + action.url + '");\\n';
          break;
        case 'click':
          testCode += '    cy.get("' + action.selector + '").click();\\n';
          break;
        case 'type':
          testCode += '    cy.get("' + action.selector + '").type("' + action.text + '");\\n';
          break;
        case 'assert':
          testCode += '    cy.get("' + action.selector + '").should("contain.text", "' + action.expectedText + '");\\n';
          break;
      }
    });
    
    testCode += '  });\\n});';
    return testCode;
  }
}`,
      entryPoint: 'CypressGenerator',
      configuration: {
        outputFormat: 'javascript',
        includeCustomCommands: true,
        viewport: { width: 1280, height: 720 }
      },
      permissions: ['read:recordings', 'write:tests'],
      isPublic: true,
      isApproved: true,
      status: 'published',
      publishedAt: new Date(),
    },
    {
      name: 'API Response Validator',
      slug: 'api-response-validator',
      version: '2.1.0',
      authorId: developerUser.id,
      type: 'validator',
      category: 'Validators',
      description: 'Validate API responses against schemas and business rules',
      longDescription: 'Comprehensive API response validation with JSON Schema support, custom business rules, and detailed error reporting.',
      code: `
export default class APIResponseValidator {
  validate(response, schema, rules = []) {
    const results = {
      valid: true,
      errors: [],
      warnings: []
    };
    
    // Schema validation
    if (schema) {
      const schemaErrors = this.validateSchema(response.data, schema);
      results.errors.push(...schemaErrors);
    }
    
    // Business rules validation
    rules.forEach(rule => {
      const ruleResult = this.validateRule(response, rule);
      if (!ruleResult.valid) {
        results.errors.push(ruleResult.error);
      }
    });
    
    results.valid = results.errors.length === 0;
    return results;
  }
  
  validateSchema(data, schema) {
    // JSON Schema validation logic
    return [];
  }
  
  validateRule(response, rule) {
    // Custom business rule validation
    return { valid: true };
  }
}`,
      entryPoint: 'APIResponseValidator',
      configuration: {
        supportedSchemas: ['json-schema', 'openapi'],
        customRules: true,
        reportFormat: 'detailed'
      },
      permissions: ['read:api-responses', 'write:validation-results'],
      isPublic: true,
      isApproved: true,
      status: 'published',
      publishedAt: new Date(),
    },
    {
      name: 'Slack Integration',
      slug: 'slack-integration',
      version: '1.5.0',
      authorId: developerUser.id,
      type: 'integration',
      category: 'Integrations',
      description: 'Send test results and notifications to Slack channels',
      longDescription: 'Seamlessly integrate with Slack to receive real-time test notifications, results, and alerts directly in your team channels.',
      code: `
export default class SlackIntegration {
  constructor(config) {
    this.webhookUrl = config.webhookUrl;
    this.channel = config.channel;
    this.username = config.username || 'Qestro Bot';
  }
  
  async sendTestResult(testResult) {
    const message = this.formatTestResult(testResult);
    return await this.sendMessage(message);
  }
  
  formatTestResult(result) {
    const status = result.success ? '✅ PASSED' : '❌ FAILED';
    const color = result.success ? 'good' : 'danger';
    
    return {
      channel: this.channel,
      username: this.username,
      attachments: [{
        color: color,
        title: \`Test: \${result.testName}\`,
        text: \`Status: \${status}\\nDuration: \${result.duration}ms\`,
        fields: [
          { title: 'Environment', value: result.environment, short: true },
          { title: 'Browser', value: result.browser, short: true }
        ]
      }]
    };
  }
  
  async sendMessage(message) {
    // Slack API call implementation
    return fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
  }
}`,
      entryPoint: 'SlackIntegration',
      configuration: {
        webhookUrl: '',
        channel: '#testing',
        notifications: ['test-complete', 'test-failed', 'suite-complete']
      },
      permissions: ['read:test-results', 'external:slack'],
      isPublic: true,
      isApproved: true,
      status: 'published',
      publishedAt: new Date(),
    },
    {
      name: 'HTML Test Reporter',
      slug: 'html-test-reporter',
      version: '1.0.3',
      authorId: developerUser.id,
      type: 'reporter',
      category: 'Reporters',
      description: 'Generate beautiful HTML test reports with charts and analytics',
      longDescription: 'Create comprehensive HTML reports with interactive charts, test analytics, and detailed failure information for better test visibility.',
      code: `
export default class HTMLTestReporter {
  generate(testResults, options = {}) {
    const template = this.getTemplate();
    const data = this.processResults(testResults);
    
    return template
      .replace('{{TITLE}}', options.title || 'Test Report')
      .replace('{{SUMMARY}}', this.generateSummary(data))
      .replace('{{CHARTS}}', this.generateCharts(data))
      .replace('{{DETAILS}}', this.generateDetails(data));
  }
  
  processResults(results) {
    return {
      total: results.length,
      passed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      duration: results.reduce((sum, r) => sum + r.duration, 0),
      results: results
    };
  }
  
  generateSummary(data) {
    const passRate = ((data.passed / data.total) * 100).toFixed(1);
    return \`
      <div class="summary">
        <h2>Test Summary</h2>
        <div class="metrics">
          <div class="metric">
            <span class="value">\${data.total}</span>
            <span class="label">Total Tests</span>
          </div>
          <div class="metric success">
            <span class="value">\${data.passed}</span>
            <span class="label">Passed</span>
          </div>
          <div class="metric failure">
            <span class="value">\${data.failed}</span>
            <span class="label">Failed</span>
          </div>
          <div class="metric">
            <span class="value">\${passRate}%</span>
            <span class="label">Pass Rate</span>
          </div>
        </div>
      </div>
    \`;
  }
  
  getTemplate() {
    return \`<!DOCTYPE html>
    <html>
    <head>
      <title>{{TITLE}}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; }
        .metrics { display: flex; gap: 20px; }
        .metric { text-align: center; }
        .success { color: #10b981; }
        .failure { color: #ef4444; }
      </style>
    </head>
    <body>
      {{SUMMARY}}
      {{CHARTS}}
      {{DETAILS}}
    </body>
    </html>\`;
  }
}`,
      entryPoint: 'HTMLTestReporter',
      configuration: {
        includeCharts: true,
        includeScreenshots: true,
        theme: 'default'
      },
      permissions: ['read:test-results', 'write:reports'],
      isPublic: true,
      isApproved: true,
      status: 'published',
      publishedAt: new Date(),
    },
  ];

  const insertedPlugins = await db.insert(plugins).values(samplePlugins).returning();
  console.log(`✅ Inserted ${insertedPlugins.length} sample plugins`);
  
  return insertedPlugins;
}