#!/usr/bin/env node

/**
 * AI Test Generation Service CLI
 *
 * Command-line interface for AI-powered test generation, optimization,
 * and analysis capabilities.
 */

import { createAITestGenerationService } from '../services/ai-test-generation';

// Mock D1 database for CLI usage
const mockD1Database = {
  prepare: (query: string) => ({
    bind: (...params: any[]) => ({
      run: () => Promise.resolve({ success: true }),
      first: () => Promise.resolve({
        id: 'cli-project-001',
        name: 'CLI Test Project',
        description: 'Project for CLI testing'
      }),
      all: () => Promise.resolve({ results: [] })
    })
  })
};

const aiService = createAITestGenerationService(mockD1Database as any, {
  defaultProvider: 'openai',
  maxTokensPerRequest: 3000,
  costLimit: 50.0,
  enableCaching: true
});

// CLI argument parsing
const args = process.argv.slice(2);
const command = args[0];
const options = parseOptions(args.slice(1));

function parseOptions(argsArray: string[]): Record<string, any> {
  const options: Record<string, any> = {};

  for (let i = 0; i < argsArray.length; i++) {
    const arg = argsArray[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = argsArray[i + 1];

      if (nextArg && !nextArg.startsWith('--')) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = true;
      }
    }
  }

  return options;
}

// Main CLI handler
async function main() {
  console.log('🤖 Questro AI Test Generation CLI');
  console.log('=====================================');

  try {
    switch (command) {
      case 'generate':
        await handleGenerate();
        break;

      case 'optimize':
        await handleOptimize();
        break;

      case 'analyze':
        await handleAnalyze();
        break;

      case 'recommend':
        await handleRecommend();
        break;

      case 'metrics':
        await handleMetrics();
        break;

      case 'test':
        await handleTest();
        break;

      case 'demo':
        await handleDemo();
        break;

      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ CLI Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Generate test cases command
async function handleGenerate() {
  const description = options.description || options.desc || options.d;
  const maxCases = parseInt(options['max-cases'] || options.max || '10');
  const priority = options.priority || options.p || 'medium';
  const provider = options.provider || 'openai';

  if (!description) {
    console.error('❌ Description is required. Use --description "your description"');
    process.exit(1);
  }

  console.log(`🧪 Generating test cases...`);
  console.log(`📝 Description: ${description}`);
  console.log(`🔢 Max cases: ${maxCases}`);
  console.log(`🎯 Priority: ${priority}`);
  console.log(`🤖 Provider: ${provider}`);
  console.log('');

  const context = {
    projectInfo: {
      name: options['project-name'] || 'CLI Generated Project',
      description: options['project-desc'] || 'Project generated via CLI',
      platform: (options.platform || 'web') as 'web' | 'mobile' | 'api',
      technology: (options.tech || options.technology || 'JavaScript').split(',').map((t: string) => t.trim()),
      framework: (options.framework || 'Playwright').split(',').map((f: string) => f.trim())
    },
    requirements: {
      functional: (options.functional || 'User authentication').split(',').map((f: string) => f.trim()),
      nonFunctional: (options['non-functional'] || 'Performance,Security').split(',').map((n: string) => n.trim()),
      businessRules: (options['business-rules'] || 'Data validation').split(',').map((b: string) => b.trim())
    },
    constraints: {
      maxTestCases: maxCases,
      priority: priority as 'low' | 'medium' | 'high' | 'critical',
      testTypes: (options['test-types'] || 'functional').split(',').map((t: string) => t.trim())
    }
  };

  try {
    const startTime = Date.now();
    const testCases = await aiService.generateTestCases(description, context, {
      provider,
      maxTestCases: maxCases,
      prioritize: true
    });

    const duration = Date.now() - startTime;

    console.log(`✅ Generated ${testCases.length} test cases in ${duration}ms\n`);

    testCases.forEach((testCase, index) => {
      console.log(`📋 Test Case ${index + 1}: ${testCase.name}`);
      console.log(`   📄 Description: ${testCase.description}`);
      console.log(`   🎯 Priority: ${testCase.priority}`);
      console.log(`   🏷️  Category: ${testCase.category}`);
      console.log(`   🏷️  Tags: ${testCase.tags.join(', ')}`);
      console.log(`   ⚡ Complexity: ${testCase.complexity}`);
      console.log(`   ⚠️  Risk Level: ${testCase.riskLevel}`);
      console.log(`   ⏱️  Duration: ${testCase.estimatedDuration}s`);

      if (testCase.preconditions.length > 0) {
        console.log(`   ✓ Preconditions:`);
        testCase.preconditions.forEach(precondition => {
          console.log(`      - ${precondition}`);
        });
      }

      console.log(`   📝 Test Steps:`);
      testCase.testSteps.forEach(step => {
        console.log(`      ${step.order}. ${step.action}`);
        console.log(`         Expected: ${step.expected}`);
      });

      console.log(`   ✅ Expected Results:`);
      testCase.expectedResults.forEach(result => {
        console.log(`      - ${result}`);
      });

      console.log('');
    });

    // Export to file if requested
    if (options.output || options.o) {
      const fs = require('fs');
      const outputData = {
        generatedAt: new Date().toISOString(),
        description,
        context,
        testCases,
        metadata: {
          totalGenerated: testCases.length,
          generationTime: duration,
          provider
        }
      };

      fs.writeFileSync(options.output, JSON.stringify(outputData, null, 2));
      console.log(`💾 Test cases exported to: ${options.output}`);
    }

  } catch (error) {
    console.error('❌ Test generation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Optimize test cases command
async function handleOptimize() {
  const inputFile = options.input || options.i;
  const outputFile = options.output || options.o;

  if (!inputFile) {
    console.error('❌ Input file is required. Use --input testcases.json');
    process.exit(1);
  }

  console.log(`⚡ Optimizing test cases...`);
  console.log(`📁 Input file: ${inputFile}`);

  try {
    const fs = require('fs');
    const testData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    const testCases = testData.testCases || testData;

    console.log(`📊 Processing ${testCases.length} test cases...`);

    const feedback = {
      issues: (options.issues || 'Test steps can be simplified').split(',').map((i: string) => i.trim()),
      suggestions: (options.suggestions || 'Add more assertions').split(',').map((s: string) => s.trim()),
      priorities: (options.priorities || 'Focus on critical paths').split(',').map((p: string) => p.trim()),
      constraints: (options.constraints || 'Reduce execution time').split(',').map((c: string) => c.trim())
    };

    const startTime = Date.now();
    const optimizedTests = await aiService.optimizeTestCases(testCases, feedback);
    const duration = Date.now() - startTime;

    console.log(`✅ Optimized ${optimizedTests.length} test cases in ${duration}ms\n`);

    optimizedTests.forEach((test, index) => {
      console.log(`📋 Optimized Test ${index + 1}: ${test.name}`);
      console.log(`   🎯 Priority: ${test.priority}`);
      console.log(`   ⚡ Improvement Score: ${test.improvementScore}%`);
      console.log(`   💰 Estimated ROI: ${test.estimatedROI}`);
      console.log(`   🔧 Optimizations: ${test.optimizations.join(', ')}`);
      console.log('');
    });

    if (outputFile) {
      const outputData = {
        optimizedAt: new Date().toISOString(),
        originalTests: testCases,
        optimizedTests,
        feedback,
        metadata: {
          originalCount: testCases.length,
          optimizedCount: optimizedTests.length,
          optimizationTime: duration,
          averageImprovement: optimizedTests.reduce((sum, test) => sum + (test.improvementScore || 0), 0) / optimizedTests.length
        }
      };

      fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
      console.log(`💾 Optimized tests exported to: ${outputFile}`);
    }

  } catch (error) {
    console.error('❌ Test optimization failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Analyze coverage command
async function handleAnalyze() {
  const projectId = options['project-id'] || options.pid || 'cli-project-001';
  const provider = options.provider || 'openai';

  console.log(`📊 Analyzing test coverage...`);
  console.log(`🆔 Project ID: ${projectId}`);
  console.log(`🤖 Provider: ${provider}`);
  console.log('');

  try {
    const startTime = Date.now();
    const coverageAnalysis = await aiService.analyzeTestCoverage(projectId, { provider });
    const duration = Date.now() - startTime;

    console.log(`✅ Coverage analysis completed in ${duration}ms\n`);
    console.log(`📈 Overall Coverage: ${coverageAnalysis.overallCoverage}%`);
    console.log(`🎯 Functional Coverage: ${coverageAnalysis.functionalCoverage}%`);
    console.log(`⚠️  Risk Coverage: ${coverageAnalysis.riskCoverage}%`);

    if (coverageAnalysis.gaps.length > 0) {
      console.log(`\n🕳️  Coverage Gaps:`);
      coverageAnalysis.gaps.forEach((gap, index) => {
        console.log(`   ${index + 1}. ${gap}`);
      });
    }

    if (coverageAnalysis.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      coverageAnalysis.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }

    if (coverageAnalysis.priorityTests.length > 0) {
      console.log(`\n🎯 Priority Tests to Create:`);
      coverageAnalysis.priorityTests.forEach((test, index) => {
        console.log(`   ${index + 1}. ${test}`);
      });
    }

    if (options.output || options.o) {
      const fs = require('fs');
      const outputData = {
        analyzedAt: new Date().toISOString(),
        projectId,
        coverageAnalysis,
        metadata: {
          analysisTime: duration,
          provider
        }
      };

      fs.writeFileSync(options.output, JSON.stringify(outputData, null, 2));
      console.log(`\n💾 Coverage analysis exported to: ${options.output}`);
    }

  } catch (error) {
    console.error('❌ Coverage analysis failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Generate recommendations command
async function handleRecommend() {
  const projectId = options['project-id'] || options.pid || 'cli-project-001';
  const goals = (options.goals || options.g || 'improve coverage').split(',').map((g: string) => g.trim());
  const provider = options.provider || 'openai';

  console.log(`💡 Generating test recommendations...`);
  console.log(`🆔 Project ID: ${projectId}`);
  console.log(`🎯 Goals: ${goals.join(', ')}`);
  console.log(`🤖 Provider: ${provider}`);
  console.log('');

  try {
    const startTime = Date.now();
    const recommendations = await aiService.generateTestRecommendations(projectId, goals, { provider });
    const duration = Date.now() - startTime;

    console.log(`✅ Recommendations generated in ${duration}ms\n`);

    console.log(`📋 Recommendations (${recommendations.recommendations.length}):`);
    recommendations.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });

    console.log(`\n🎯 Priority Test Cases (${recommendations.priorityTests.length}):`);
    recommendations.priorityTests.forEach((test, index) => {
      console.log(`   ${index + 1}. ${test.name}`);
      console.log(`      ${test.description}`);
      console.log(`      Priority: ${test.priority}, Complexity: ${test.complexity}`);
    });

    console.log(`\n📊 Metrics:`);
    console.log(`   ⏱️  Estimated Effort: ${recommendations.estimatedEffort} hours`);
    console.log(`   💰 Expected ROI: ${recommendations.expectedROI}`);

    if (options.output || options.o) {
      const fs = require('fs');
      const outputData = {
        generatedAt: new Date().toISOString(),
        projectId,
        goals,
        recommendations,
        metadata: {
          recommendationTime: duration,
          provider
        }
      };

      fs.writeFileSync(options.output, JSON.stringify(outputData, null, 2));
      console.log(`\n💾 Recommendations exported to: ${options.output}`);
    }

  } catch (error) {
    console.error('❌ Recommendation generation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// View metrics command
async function handleMetrics() {
  const timeframe = options.timeframe || options.t || '30'; // days

  console.log(`📊 AI Test Generation Metrics`);
  console.log(`==============================`);
  console.log(`⏰ Timeframe: Last ${timeframe} days`);
  console.log('');

  try {
    const days = parseInt(timeframe);
    const timeFilter = days > 0 ? {
      from: new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString(),
      to: new Date().toISOString()
    } : undefined;

    const metrics = aiService.getUsageMetrics(timeFilter);

    console.log(`💰 Financial Metrics:`);
    console.log(`   Total Cost: $${metrics.totalCost.toFixed(4)}`);
    console.log(`   Total Tokens: ${metrics.totalTokens.toLocaleString()}`);

    console.log(`\n📈 Operation Metrics:`);
    console.log(`   Total Operations: ${metrics.operationsCount}`);
    console.log(`   Success Rate: ${metrics.successRate.toFixed(1)}%`);

    console.log(`\n🤖 Provider Breakdown:`);
    Object.entries(metrics.providerBreakdown).forEach(([provider, data]: [string, any]) => {
      console.log(`   ${provider}:`);
      console.log(`     Operations: ${data.operations}`);
      console.log(`     Cost: $${data.cost.toFixed(4)}`);
      console.log(`     Tokens: ${data.tokens.toLocaleString()}`);
      console.log(`     Success Rate: ${data.successRate.toFixed(1)}%`);
    });

  } catch (error) {
    console.error('❌ Metrics retrieval failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run comprehensive test command
async function handleTest() {
  console.log(`🧪 Running comprehensive AI test generation test...`);
  console.log('');

  try {
    const testResults = {
      testGeneration: { status: 'Running', success: false },
      testOptimization: { status: 'Running', success: false },
      coverageAnalysis: { status: 'Running', success: false },
      recommendations: { status: 'Running', success: false }
    };

    // Test 1: Test Generation
    try {
      console.log(`📝 Testing test generation...`);
      const testCases = await aiService.generateTestCases(
        'User login and authentication system',
        {
          projectInfo: {
            name: 'Test Project',
            description: 'CLI Test Project',
            platform: 'web' as const,
            technology: ['React', 'TypeScript'],
            framework: ['Playwright']
          },
          constraints: {
            maxTestCases: 3,
            priority: 'high' as const,
            testTypes: ['functional']
          }
        }
      );

      testResults.testGeneration = {
        status: 'Completed',
        success: testCases.length > 0,
        testCasesGenerated: testCases.length
      };
      console.log(`   ✅ Generated ${testCases.length} test cases`);
    } catch (error) {
      testResults.testGeneration = { status: 'Failed', success: false, error: error instanceof Error ? error.message : 'Unknown' };
      console.log(`   ❌ Test generation failed: ${error instanceof Error ? error.message : error}`);
    }

    // Test 2: Test Optimization
    try {
      console.log(`⚡ Testing test optimization...`);
      const mockTests = [{ id: 'test-001', name: 'Sample Test', steps: ['Step 1', 'Step 2'] }];
      const optimizedTests = await aiService.optimizeTestCases(mockTests);

      testResults.testOptimization = {
        status: 'Completed',
        success: optimizedTests.length > 0,
        testsOptimized: optimizedTests.length
      };
      console.log(`   ✅ Optimized ${optimizedTests.length} tests`);
    } catch (error) {
      testResults.testOptimization = { status: 'Failed', success: false, error: error instanceof Error ? error.message : 'Unknown' };
      console.log(`   ❌ Test optimization failed: ${error instanceof Error ? error.message : error}`);
    }

    // Test 3: Coverage Analysis
    try {
      console.log(`📊 Testing coverage analysis...`);
      const coverage = await aiService.analyzeTestCoverage('test-project-001');

      testResults.coverageAnalysis = {
        status: 'Completed',
        success: coverage.overallCoverage >= 0,
        overallCoverage: coverage.overallCoverage
      };
      console.log(`   ✅ Coverage analysis completed: ${coverage.overallCoverage}% coverage`);
    } catch (error) {
      testResults.coverageAnalysis = { status: 'Failed', success: false, error: error instanceof Error ? error.message : 'Unknown' };
      console.log(`   ❌ Coverage analysis failed: ${error instanceof Error ? error.message : error}`);
    }

    // Test 4: Recommendations
    try {
      console.log(`💡 Testing recommendation generation...`);
      const recommendations = await aiService.generateTestRecommendations('test-project-001', ['improve coverage']);

      testResults.recommendations = {
        status: 'Completed',
        success: recommendations.recommendations.length > 0,
        recommendationsGenerated: recommendations.recommendations.length
      };
      console.log(`   ✅ Generated ${recommendations.recommendations.length} recommendations`);
    } catch (error) {
      testResults.recommendations = { status: 'Failed', success: false, error: error instanceof Error ? error.message : 'Unknown' };
      console.log(`   ❌ Recommendation generation failed: ${error instanceof Error ? error.message : error}`);
    }

    // Summary
    const successCount = Object.values(testResults).filter(r => r.success).length;
    const totalTests = Object.keys(testResults).length;
    const successRate = (successCount / totalTests) * 100;

    console.log(`\n📊 Test Results Summary:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   Success Rate: ${successRate.toFixed(1)}%`);

    console.log(`\n📋 Detailed Results:`);
    Object.entries(testResults).forEach(([test, result]: [string, any]) => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${test}: ${result.status}`);
      if (result.error) {
        console.log(`      Error: ${result.error}`);
      }
    });

    if (successRate >= 75) {
      console.log(`\n🎉 Comprehensive test PASSED (${successRate.toFixed(1)}% success rate)`);
    } else {
      console.log(`\n⚠️  Comprehensive test FAILED (${successRate.toFixed(1)}% success rate)`);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Comprehensive test failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Demo command
async function handleDemo() {
  console.log(`🎭 AI Test Generation Demo`);
  console.log(`========================`);
  console.log('');

  try {
    // Demo: Generate test cases for e-commerce checkout
    console.log(`📦 Demo: Generating test cases for e-commerce checkout process...`);

    const testCases = await aiService.generateTestCases(
      'Complete e-commerce checkout flow with user authentication, shopping cart management, payment processing, and order confirmation',
      {
        projectInfo: {
          name: 'Questro E-commerce Platform',
          description: 'Modern e-commerce platform with AI-powered testing automation',
          platform: 'web' as const,
          technology: ['React', 'Node.js', 'PostgreSQL', 'Stripe'],
          framework: ['Playwright', 'Cypress']
        },
        requirements: {
          functional: [
            'User registration and login',
            'Product browsing and search',
            'Shopping cart management',
            'Payment processing with Stripe',
            'Order confirmation and tracking'
          ],
          nonFunctional: [
            'Page load time < 3 seconds',
            'Mobile responsive design',
            'WCAG 2.1 accessibility compliance',
            'PCI DSS security compliance'
          ],
          businessRules: [
            'Users must be authenticated to checkout',
            'Payment validation required before order confirmation',
            'Inventory checked before adding to cart',
            'Tax calculation based on user location'
          ]
        },
        constraints: {
          maxTestCases: 8,
          priority: 'high' as const,
          testTypes: ['functional', 'security', 'performance']
        }
      },
      { maxTestCases: 8, prioritize: true }
    );

    console.log(`✅ Generated ${testCases.length} comprehensive test cases:\n`);

    testCases.slice(0, 3).forEach((testCase, index) => {
      console.log(`📋 Test Case ${index + 1}: ${testCase.name}`);
      console.log(`   📄 ${testCase.description}`);
      console.log(`   🎯 Priority: ${testCase.priority} | ⚡ Complexity: ${testCase.complexity} | ⚠️  Risk: ${testCase.riskLevel}`);
      console.log(`   📝 ${testCase.testSteps.length} steps | ⏱️  ${testCase.estimatedDuration}s estimated`);
      console.log(`   🏷️  ${testCase.tags.join(', ')}`);
      console.log('');
    });

    if (testCases.length > 3) {
      console.log(`... and ${testCases.length - 3} more test cases`);
    }

    // Demo: Generate recommendations
    console.log(`\n💡 Demo: Generating improvement recommendations...`);

    const recommendations = await aiService.generateTestRecommendations(
      'demo-ecommerce-project',
      ['improve security coverage', 'increase mobile testing', 'add performance tests']
    );

    console.log(`✅ Generated ${recommendations.recommendations.length} recommendations:`);
    recommendations.recommendations.slice(0, 3).forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });

    console.log(`\n📊 Demo Summary:`);
    console.log(`   📝 Test Cases Generated: ${testCases.length}`);
    console.log(`   💡 Recommendations: ${recommendations.recommendations.length}`);
    console.log(`   ⏱️  Estimated Effort: ${recommendations.estimatedEffort} hours`);
    console.log(`   💰 Expected ROI: ${recommendations.expectedROI}`);

    console.log(`\n🎉 Demo completed successfully!`);
    console.log(`\n💡 Try these commands next:`);
    console.log(`   npm run ai-test generate --description "your test scenario"`);
    console.log(`   npm run ai-test analyze --project-id your-project`);
    console.log(`   npm run ai-test recommend --project-id your-project --goals "security,performance"`);
    console.log(`   npm run ai-test test --run-comprehensive`);

  } catch (error) {
    console.error('❌ Demo failed:', error instanceof Error ? error.message : error);
    console.log('\n💡 This might be due to missing API keys or configuration.');
    console.log('Please ensure OPENAI_API_KEY is set in your environment.');
    process.exit(1);
  }
}

// Help command
function showHelp() {
  console.log(`
🤖 Questro AI Test Generation CLI

USAGE:
  npm run ai-test <command> [options]

COMMANDS:
  generate       Generate AI-powered test cases
  optimize       Optimize existing test cases
  analyze        Analyze test coverage
  recommend      Generate test recommendations
  metrics        View usage metrics and costs
  test           Run comprehensive functionality test
  demo           Run interactive demo
  help           Show this help message

GENERATE OPTIONS:
  --description, -d      Test scenario description (required)
  --max-cases, --max     Maximum number of test cases to generate (default: 10)
  --priority, -p         Priority level: low|medium|high|critical (default: medium)
  --provider             AI provider to use (default: openai)
  --project-name         Project name for context
  --platform             Platform: web|mobile|api (default: web)
  --tech, --technology   Technologies used (comma-separated)
  --framework            Test frameworks (comma-separated)
  --functional           Functional requirements (comma-separated)
  --non-functional       Non-functional requirements (comma-separated)
  --business-rules       Business rules (comma-separated)
  --test-types           Types of tests to generate (comma-separated)
  --output, -o           Output file for generated test cases

OPTIMIZE OPTIONS:
  --input, -i            Input file with existing test cases (JSON)
  --output, -o           Output file for optimized test cases
  --issues               Known issues to address (comma-separated)
  --suggestions          Improvement suggestions (comma-separated)
  --priorities           Priority areas (comma-separated)
  --constraints          Optimization constraints (comma-separated)

ANALYZE OPTIONS:
  --project-id, --pid    Project ID to analyze (default: cli-project-001)
  --provider             AI provider to use (default: openai)
  --output, -o           Output file for analysis results

RECOMMEND OPTIONS:
  --project-id, --pid    Project ID for recommendations (default: cli-project-001)
  --goals, -g            Goals to achieve (comma-separated)
  --provider             AI provider to use (default: openai)
  --output, -o           Output file for recommendations

METRICS OPTIONS:
  --timeframe, -t        Timeframe in days (default: 30)

TEST OPTIONS:
  --run-comprehensive    Run full comprehensive test suite

DEMO OPTIONS:
  No additional options required

EXAMPLES:
  # Generate test cases for user authentication
  npm run ai-test generate --description "User login and registration system" --priority high --max-cases 5

  # Generate test cases with full context
  npm run ai-test generate --description "E-commerce checkout" --platform web --tech "React,Node.js" --framework "Playwright" --functional "Authentication,Payment,Inventory" --priority critical --output checkout-tests.json

  # Optimize existing test cases
  npm run ai-test optimize --input existing-tests.json --output optimized-tests.json --issues "Steps too verbose" --suggestions "Add more assertions"

  # Analyze test coverage
  npm run ai-test analyze --project-id my-project --output coverage-report.json

  # Generate recommendations
  npm run ai-test recommend --project-id my-project --goals "security,performance,accessibility" --output recommendations.json

  # View usage metrics
  npm run ai-test metrics --timeframe 30

  # Run comprehensive test
  npm run ai-test test

  # Run interactive demo
  npm run ai-test demo

ENVIRONMENT VARIABLES:
  OPENAI_API_KEY         OpenAI API key (required for OpenAI provider)
  HUGGINGFACE_API_KEY    Hugging Face API key (optional)

For more information, visit: https://docs.questro.io/ai-test-generation
`);
}

// Run main function
main().catch(console.error);
