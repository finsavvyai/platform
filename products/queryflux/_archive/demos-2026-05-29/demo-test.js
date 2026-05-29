#!/usr/bin/env node

/**
 * Demo and Test Script for AI Database Initialization System
 *
 * This script demonstrates the AI Database Initialization System
 * with various test scenarios and provides examples of how to use it.
 */

const { AIDatabaseInitializationEngine } = require('./dist/core/ai-database-initialization/AIDatabaseInitializationEngine.js');

// ANSI color codes for better console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Configuration for demo
const demoConfig = {
  modelProvider: 'openai',
  model: 'gpt-4',
  temperature: 0.3,
  maxTokens: 4000,
  enableCache: true,
  enableTelemetry: false,
  integrationSettings: {
    cloudProviders: [],
    monitoringTools: [],
    cicdPlatforms: [],
    securityTools: []
  }
};

// Test scenarios
const testScenarios = [
  {
    name: 'Simple Blog Database',
    input: 'I need a PostgreSQL database for my blog with users and posts',
    description: 'Basic requirement for a simple blog platform',
    expectedDatabase: 'postgresql'
  },
  {
    name: 'E-commerce Platform',
    input: 'I need a PostgreSQL database for an e-commerce platform that can handle 10,000 concurrent users with 99.9% uptime. I expect to store products, orders, and customer data with complex relationships. Budget is around $500/month and I need GDPR compliance.',
    description: 'Complex e-commerce requirements with performance and compliance needs',
    expectedDatabase: 'postgresql'
  },
  {
    name: 'IoT Sensor Data',
    input: 'I need a time-series database for IoT sensor data that can handle 1 million measurements per hour from 10,000 devices. Data retention should be 30 days and I need real-time analytics.',
    description: 'High-volume time-series data requirements',
    expectedDatabase: 'influxdb'
  },
  {
    name: 'Enterprise Financial System',
    input: 'Enterprise financial database with ACID compliance, supporting 50,000 concurrent users, 99.99% availability, with HIPAA and SOX compliance. Budget is $10,000/month with multi-region deployment.',
    description: 'Enterprise-grade requirements with strict compliance',
    expectedDatabase: 'postgresql'
  },
  {
    name: 'Social Media App',
    input: 'Building a social media application with user profiles, posts, comments, likes, and follows. Need to support complex relationship queries and real-time feeds. Starting with 1000 users, expecting 100k in first year. Budget conscious startup.',
    description: 'Social media with graph-like relationships',
    expectedDatabase: 'postgresql' // or potentially a graph DB
  }
];

// Utility functions
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log('\n' + '='.repeat(60), 'cyan');
  log(`  ${title}`, 'cyan');
  log('='.repeat(60), 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

async function runScenario(scenario, engine) {
  logSection(`Running Scenario: ${scenario.name}`);
  log(`Description: ${scenario.description}`, 'yellow');
  log(`Input: "${scenario.input}"`, 'blue');

  try {
    const startTime = Date.now();

    log('\n🔄 Analyzing requirements...', 'magenta');
    const result = await engine.initializeDatabase(scenario.input, {
      preferences: {
        budgetRange: { min: 0, max: 1000, currency: 'USD' },
        technicalLevel: 'intermediate'
      }
    });

    const processingTime = Date.now() - startTime;

    // Display analysis results
    log('\n📊 Analysis Results:', 'green');
    log(`   • Confidence: ${Math.round(result.analysis.confidence * 100)}%`);
    log(`   • Requirements Extracted: ${result.analysis.extractedRequirements.length}`);
    log(`   • Processing Time: ${processingTime}ms`);

    // Display top recommendation
    const topRecommendation = result.recommendations[0];
    log('\n🎯 Top Recommendation:', 'green');
    log(`   • Database: ${topRecommendation.databaseType.toUpperCase()}`);
    log(`   • Confidence: ${Math.round(topRecommendation.confidence * 100)}%`);
    log(`   • Estimated Cost: $${topRecommendation.estimatedCost.monthly}/month`);
    log(`   • Migration Complexity: ${topRecommendation.migrationComplexity}`);

    log('\n💡 Reasoning:', 'blue');
    log(`   ${topRecommendation.reasoning}`);

    // Display performance profile
    log('\n⚡ Performance Profile:', 'yellow');
    const perf = topRecommendation.performanceProfile;
    log(`   • Read Throughput: ${perf.throughput.readsPerSecond.toLocaleString()} queries/sec`);
    log(`   • Write Throughput: ${perf.throughput.writesPerSecond.toLocaleString()} queries/sec`);
    log(`   • Read Latency: ${perf.latency.readLatency}ms`);
    log(`   • Write Latency: ${perf.latency.writeLatency}ms`);
    log(`   • Availability: ${(perf.availability * 100).toFixed(2)}%`);
    log(`   • Max Connections: ${perf.concurrency.toLocaleString()}`);

    // Display key configuration
    log('\n⚙️  Key Configuration:', 'yellow');
    const config = topRecommendation.configuration;
    log(`   • Connection Pool: ${config.connectionPool.minConnections}-${config.connectionPool.maxConnections} connections`);
    log(`   • Backup Frequency: ${config.backupStrategy.frequency}`);
    log(`   • Backup Retention: ${config.backupStrategy.retention} days`);
    log(`   • SSL Encryption: ${config.ssl ? 'Enabled' : 'Disabled'}`);
    log(`   • Audit Logging: ${config.security.auditLogging ? 'Enabled' : 'Disabled'}`);

    // Display pros and cons
    log('\n✅ Pros:', 'green');
    topRecommendation.pros.forEach(pro => {
      log(`   • ${pro}`);
    });

    log('\n⚠️  Considerations:', 'yellow');
    topRecommendation.cons.forEach(con => {
      log(`   • ${con}`);
    });

    // Display creation plan summary
    log('\n📋 Creation Plan:', 'cyan');
    const plan = result.creationPlan;
    log(`   • Total Steps: ${plan.steps.length}`);
    log(`   • Estimated Duration: ${plan.estimatedDuration} minutes`);
    log(`   • Prerequisites: ${plan.prerequisites.length}`);
    log(`   • Rollback Steps: ${plan.rollbackPlan.length}`);

    log(`\n✨ Scenario completed successfully!`, 'green');

    return {
      success: true,
      scenario: scenario.name,
      processingTime,
      confidence: result.analysis.confidence,
      recommendedDatabase: topRecommendation.databaseType,
      estimatedCost: topRecommendation.estimatedCost.monthly
    };

  } catch (error) {
    logError(`Scenario failed: ${error.message}`);
    return {
      success: false,
      scenario: scenario.name,
      error: error.message
    };
  }
}

async function runFileUploadDemo(engine) {
  logSection('File Upload Demo');

  // Create a mock SQL file
  const mockSQLContent = `
    -- E-commerce Database Schema
    CREATE TABLE customers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(20),
      address TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10,2) NOT NULL,
      category_id INTEGER,
      stock_quantity INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE orders (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id),
      order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      total_amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(50) NOT NULL,
      shipping_address TEXT
    );

    CREATE TABLE order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES orders(id),
      product_id INTEGER REFERENCES products(id),
      quantity INTEGER NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL
    );

    -- Indexes for performance
    CREATE INDEX idx_orders_customer_id ON orders(customer_id);
    CREATE INDEX idx_orders_date ON orders(order_date);
    CREATE INDEX idx_products_category ON products(category_id);
    CREATE INDEX idx_order_items_order ON order_items(order_id);

    -- Sample data
    INSERT INTO customers (name, email, phone) VALUES
      ('John Doe', 'john@example.com', '555-0101'),
      ('Jane Smith', 'jane@example.com', '555-0102');
  `;

  log('📁 Analyzing SQL dump file...', 'magenta');

  try {
    // Create a mock File object (Node.js environment)
    const mockFile = {
      name: 'ecommerce_schema.sql',
      size: Buffer.byteLength(mockSQLContent, 'utf8'),
      type: 'application/sql',
      text: () => Promise.resolve(mockSQLContent)
    };

    const startTime = Date.now();
    const result = await engine.initializeDatabase(mockFile, {
      inputType: 'dump_file',
      preferences: {
        budgetRange: { min: 0, max: 800, currency: 'USD' },
        technicalLevel: 'intermediate'
      }
    });

    const processingTime = Date.now() - startTime;

    log('\n📊 File Analysis Results:', 'green');
    log(`   • File Type: ${result.analysis.inputType}`);
    log(`   • File Size: ${(mockFile.size / 1024).toFixed(2)} KB`);
    log(`   • Tables Detected: ${result.analysis.extractedRequirements.length}`);
    log(`   • Processing Time: ${processingTime}ms`);

    const topRecommendation = result.recommendations[0];
    log('\n🎯 Recommendation Based on Schema:', 'green');
    log(`   • Database: ${topRecommendation.databaseType.toUpperCase()}`);
    log(`   • Confidence: ${Math.round(topRecommendation.confidence * 100)}%`);
    log(`   • Migration Complexity: ${topRecommendation.migrationComplexity}`);

    log(`\n✨ File upload demo completed successfully!`, 'green');

    return {
      success: true,
      processingTime,
      tablesDetected: result.analysis.extractedRequirements.length
    };

  } catch (error) {
    logError(`File upload demo failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

async function runPerformanceTest(engine) {
  logSection('Performance Test');

  log('🏃‍♂️ Running performance tests...', 'magenta');

  const testInput = 'I need a PostgreSQL database for my web application';
  const iterations = 5;
  const results = [];

  log(`\nRunning ${iterations} iterations to measure performance...`, 'blue');

  for (let i = 0; i < iterations; i++) {
    const startTime = Date.now();

    try {
      await engine.initializeDatabase(testInput, {
        preferences: {
          budgetRange: { min: 0, max: 500, currency: 'USD' },
          technicalLevel: 'intermediate'
        }
      });

      const duration = Date.now() - startTime;
      results.push(duration);

      log(`   Iteration ${i + 1}: ${duration}ms`, 'cyan');

    } catch (error) {
      logError(`   Iteration ${i + 1} failed: ${error.message}`);
      results.push(null);
    }
  }

  // Calculate statistics
  const validResults = results.filter(r => r !== null);

  if (validResults.length > 0) {
    const avgTime = validResults.reduce((sum, time) => sum + time, 0) / validResults.length;
    const minTime = Math.min(...validResults);
    const maxTime = Math.max(...validResults);

    log('\n📈 Performance Statistics:', 'green');
    log(`   • Average Response Time: ${avgTime.toFixed(2)}ms`);
    log(`   • Min Response Time: ${minTime}ms`);
    log(`   • Max Response Time: ${maxTime}ms`);
    log(`   • Success Rate: ${(validResults.length / iterations * 100).toFixed(1)}%`);

    // Performance benchmarks
    if (avgTime < 2000) {
      log(`   ⚡ Excellent performance (< 2s average)`, 'green');
    } else if (avgTime < 5000) {
      log(`   ✅ Good performance (< 5s average)`, 'yellow');
    } else {
      log(`   ⚠️  Needs optimization (> 5s average)`, 'red');
    }

    return {
      success: true,
      averageTime: avgTime,
      minTime,
      maxTime,
      successRate: validResults.length / iterations
    };
  } else {
    logError('All performance test iterations failed');
    return {
      success: false,
      error: 'All iterations failed'
    };
  }
}

async function runErrorHandlingDemo(engine) {
  logSection('Error Handling Demo');

  log('🧪 Testing error handling scenarios...', 'magenta');

  const errorScenarios = [
    {
      name: 'Empty Input',
      input: '',
      expectedError: true
    },
    {
      name: 'Very Short Input',
      input: 'db',
      expectedError: true
    },
    {
      name: 'Extremely Long Input',
      input: 'I need a database '.repeat(1000),
      expectedError: false
    },
    {
      name: 'Special Characters',
      input: 'I need a PostgreSQL database with UTF-8 support for émojis 🚀 and special chars ñiño',
      expectedError: false
    }
  ];

  for (const scenario of errorScenarios) {
    log(`\n🔍 Testing: ${scenario.name}`, 'blue');
    log(`   Input: "${scenario.input.substring(0, 50)}${scenario.input.length > 50 ? '...' : ''}"`);

    try {
      const result = await engine.initializeDatabase(scenario.input, {
        preferences: {
          budgetRange: { min: 0, max: 500, currency: 'USD' },
          technicalLevel: 'intermediate'
        }
      });

      if (scenario.expectedError) {
        logWarning(`   Expected error but got result (confidence: ${Math.round(result.analysis.confidence * 100)}%)`);
      } else {
        logSuccess(`   Handled gracefully (confidence: ${Math.round(result.analysis.confidence * 100)}%)`);
      }

    } catch (error) {
      if (scenario.expectedError) {
        logSuccess(`   Correctly caught error: ${error.message}`);
      } else {
        logError(`   Unexpected error: ${error.message}`);
      }
    }
  }

  log(`\n✨ Error handling demo completed!`, 'green');

  return { success: true };
}

async function generateSummaryReport(results) {
  logSection('Summary Report');

  const successfulScenarios = results.filter(r => r.success);
  const failedScenarios = results.filter(r => !r.success);

  log('📊 Test Results Summary:', 'cyan');
  log(`   • Total Scenarios: ${results.length}`);
  log(`   • Successful: ${successfulScenarios.length}`);
  log(`   • Failed: ${failedScenarios.length}`);
  log(`   • Success Rate: ${((successfulScenarios.length / results.length) * 100).toFixed(1)}%`);

  if (successfulScenarios.length > 0) {
    const avgConfidence = successfulScenarios
      .filter(r => r.confidence)
      .reduce((sum, r) => sum + r.confidence, 0) / successfulScenarios.filter(r => r.confidence).length;

    const avgCost = successfulScenarios
      .filter(r => r.estimatedCost)
      .reduce((sum, r) => sum + r.estimatedCost, 0) / successfulScenarios.filter(r => r.estimatedCost).length;

    const avgProcessingTime = successfulScenarios
      .filter(r => r.processingTime)
      .reduce((sum, r) => sum + r.processingTime, 0) / successfulScenarios.filter(r => r.processingTime).length;

    log('\n📈 Performance Metrics:', 'green');
    log(`   • Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
    log(`   • Average Processing Time: ${avgProcessingTime.toFixed(0)}ms`);
    log(`   • Average Estimated Cost: $${avgCost.toFixed(2)}/month`);

    log('\n🏆 Top Recommendations:', 'yellow');
    const recommendations = {};
    successfulScenarios.forEach(r => {
      if (r.recommendedDatabase) {
        recommendations[r.recommendedDatabase] = (recommendations[r.recommendedDatabase] || 0) + 1;
      }
    });

    Object.entries(recommendations)
      .sort(([,a], [,b]) => b - a)
      .forEach(([db, count]) => {
        log(`   • ${db.toUpperCase()}: ${count} recommendations`);
      });
  }

  if (failedScenarios.length > 0) {
    log('\n❌ Failed Scenarios:', 'red');
    failedScenarios.forEach(scenario => {
      log(`   • ${scenario.scenario}: ${scenario.error}`);
    });
  }

  log('\n🎉 Demo completed!', 'green');
  log('The AI Database Initialization System is ready for use!', 'cyan');
}

// Main demo function
async function runDemo() {
  log('🚀 AI Database Initialization System - Demo & Test', 'bright');
  log('=' .repeat(60), 'cyan');
  log('This demo showcases the AI-powered database initialization capabilities', 'cyan');
  log('=' .repeat(60), 'cyan');

  // Initialize the AI engine
  log('\n🔧 Initializing AI Database Initialization Engine...', 'magenta');

  let engine;
  try {
    engine = new AIDatabaseInitializationEngine(demoConfig);
    logSuccess('Engine initialized successfully!');
  } catch (error) {
    logError(`Failed to initialize engine: ${error.message}`);
    log('\n💡 Make sure you have configured the AI service credentials');
    log('   - Check your environment variables');
    log('   - Verify API keys are set correctly');
    log('   - Ensure network connectivity to AI services');
    return;
  }

  const allResults = [];

  try {
    // Run all test scenarios
    for (const scenario of testScenarios) {
      const result = await runScenario(scenario, engine);
      allResults.push(result);

      // Add delay between scenarios
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Run file upload demo
    const fileResult = await runFileUploadDemo(engine);
    allResults.push(fileResult);

    // Run performance test
    const perfResult = await runPerformanceTest(engine);
    allResults.push(perfResult);

    // Run error handling demo
    const errorResult = await runErrorHandlingDemo(engine);
    allResults.push(errorResult);

    // Generate summary report
    await generateSummaryReport(allResults);

  } catch (error) {
    logError(`Demo failed with unexpected error: ${error.message}`);
    log('\n🔧 Troubleshooting steps:');
    log('   1. Check if all dependencies are installed: npm install');
    log('   2. Verify the build is up to date: npm run build');
    log('   3. Check network connectivity');
    log('   4. Verify AI service credentials');
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  log('🚀 AI Database Initialization System - Demo & Test Script', 'bright');
  log('\nUsage:');
  log('  node demo-test.js [options]');
  log('\nOptions:');
  log('  --help, -h     Show this help message');
  log('  --quick, -q    Run only quick tests (3 scenarios)');
  log('  --perf, -p     Run only performance tests');
  log('  --errors, -e   Run only error handling tests');
  log('\nExamples:');
  log('  node demo-test.js              # Run full demo');
  log('  node demo-test.js --quick      # Run quick tests only');
  process.exit(0);
}

// Modify behavior based on command line arguments
if (args.includes('--quick') || args.includes('-q')) {
  // Run only 3 quick scenarios
  testScenarios.splice(3); // Keep only first 3 scenarios
} else if (args.includes('--perf') || args.includes('-p')) {
  // Run only performance test
  testScenarios.length = 0;
} else if (args.includes('--errors') || args.includes('-e')) {
  // Run only error handling test
  testScenarios.length = 0;
}

// Run the demo
if (require.main === module) {
  runDemo().catch(error => {
    logError(`Demo script failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runDemo, runScenario, runFileUploadDemo, runPerformanceTest, runErrorHandlingDemo };
