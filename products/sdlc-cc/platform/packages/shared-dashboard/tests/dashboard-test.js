/**
 * Simple Node.js Dashboard Test Script
 * Validates dashboard functionality without Playwright dependencies
 */

// Basic test framework
class SimpleTest {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.tests = [];
  }

  async test(name, fn) {
    try {
      console.log(`🧪 Running: ${name}`);
      await fn();
      console.log(`✅ PASSED: ${name}`);
      this.passed++;
    } catch (error) {
      console.log(`❌ FAILED: ${name}`);
      console.log(`   Error: ${error.message}`);
      this.failed++;
    }
  }

  async assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  async assertContains(actual, expected, message) {
    if (!actual.includes(expected)) {
      throw new Error(message || `Expected "${actual}" to contain "${expected}"`);
    }
  }

  summary() {
    console.log('\n📊 Test Results:');
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`📈 Success Rate: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`);
    return this.failed === 0;
  }
}

// Test helpers
async function fetchPage(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return await response.text();
}

// Main test suite
async function runDashboardTests() {
  const tester = new SimpleTest();

  console.log('🚀 Starting Dashboard Validation Tests...\n');

  // Test 1: Server availability
  await tester.test('Dashboard server is running', async () => {
    const html = await fetchPage('http://localhost:3000');
    await tester.assert(html.length > 0, 'Page should have content');
    await tester.assertContains(html, 'Enterprise Dashboard', 'Page should contain title');
  });

  // Test 2: HTML structure
  await tester.test('Page has proper HTML structure', async () => {
    const html = await fetchPage('http://localhost:3000');
    await tester.assertContains(html, '<!DOCTYPE html>', 'Should have DOCTYPE declaration');
    await tester.assertContains(html, '<html lang="en">', 'Should have HTML lang attribute');
    await tester.assertContains(html, '<title>Enterprise Dashboard Demo</title>', 'Should have proper title');
  });

  // Test 3: CSS and styling
  await tester.test('Page includes CSS styling', async () => {
    const html = await fetchPage('http://localhost:3000');
    await tester.assertContains(html, 'tailwindcss.com', 'Should include Tailwind CSS');
    await tester.assertContains(html, 'animate-pulse', 'Should have animation classes');
    await tester.assertContains(html, 'dark:', 'Should have dark mode support');
  });

  // Test 4: Dashboard sections
  await tester.test('Dashboard contains all main sections', async () => {
    const html = await fetchPage('http://localhost:3000');
    const sections = [
      'System Status',
      'Quick Actions',
      'Key Metrics',
      'Recent Pipelines',
      'Notifications'
    ];

    for (const section of sections) {
      await tester.assertContains(html, section, `Should contain ${section} section`);
    }
  });

  // Test 5: System status indicators
  await tester.test('System status shows all services', async () => {
    const html = await fetchPage('http://localhost:3000');
    const services = [
      'API Gateway',
      'SDLC Pipelines',
      'AI Assistant',
      'Billing System'
    ];

    for (const service of services) {
      await tester.assertContains(html, service, `Should show ${service} status`);
    }
  });

  // Test 6: Quick action buttons
  await tester.test('Quick actions are present', async () => {
    const html = await fetchPage('http://localhost:3000');
    const actions = [
      'New Pipeline',
      'AI Assistant',
      'Quick Deploy',
      'API Keys'
    ];

    for (const action of actions) {
      await tester.assertContains(html, action, `Should have ${action} button`);
    }
  });

  // Test 7: Metrics display
  await tester.test('Key metrics are displayed', async () => {
    const html = await fetchPage('http://localhost:3000');
    const metrics = [
      'API Calls',
      'Success Rate',
      'Active Users',
      'Response Time'
    ];

    for (const metric of metrics) {
      await tester.assertContains(html, metric, `Should display ${metric} metric`);
    }
  });

  // Test 8: Pipeline information
  await tester.test('Pipeline information is shown', async () => {
    const html = await fetchPage('http://localhost:3000');
    const pipelineData = [
      'Production Deploy',
      'API Gateway Test',
      'Security Scan',
      'Production',
      'Staging',
      'Development'
    ];

    for (const data of pipelineData) {
      await tester.assertContains(html, data, `Should show pipeline data: ${data}`);
    }
  });

  // Test 9: Notifications
  await tester.test('Notifications are displayed', async () => {
    const html = await fetchPage('http://localhost:3000');
    const notifications = [
      'Pipeline Completed',
      'High API Usage',
      'New Feature',
      'AI-powered code analysis'
    ];

    for (const notification of notifications) {
      await tester.assertContains(html, notification, `Should show notification: ${notification}`);
    }
  });

  // Test 10: JavaScript functionality
  await tester.test('JavaScript functionality is included', async () => {
    const html = await fetchPage('http://localhost:3000');
    await tester.assertContains(html, '<script>', 'Should have script tags');
    await tester.assertContains(html, 'toggleTheme()', 'Should have theme toggle function');
    await tester.assertContains(html, 'updateMetrics()', 'Should have metrics update function');
  });

  // Test 11: Theme switching support
  await tester.test('Theme switching is supported', async () => {
    const html = await fetchPage('http://localhost:3000');
    await tester.assertContains(html, 'toggleTheme()', 'Should have theme toggle function');
    await tester.assertContains(html, '🌙', 'Should have moon icon for theme');
    await tester.assertContains(html, '☀️', 'Should have sun icon for theme');
  });

  // Test 12: Real-time updates
  await tester.test('Real-time update functionality is present', async () => {
    const html = await fetchPage('http://localhost:3000');
    await tester.assertContains(html, 'setInterval', 'Should have interval for real-time updates');
    await tester.assertContains(html, 'updateRunningPipeline', 'Should have pipeline update function');
  });

  // Test 13: Responsive design
  await tester.test('Responsive design is implemented', async () => {
    const html = await fetchPage('http://localhost:3000');
    await tester.assertContains(html, 'grid-cols-1', 'Should have responsive grid classes');
    await tester.assertContains(html, 'lg:grid-cols-12', 'Should have large screen grid');
  });

  // Test 14: Accessibility features
  await tester.test('Basic accessibility features exist', async () => {
    const html = await fetchPage('http://localhost:3000');
    await tester.assertContains(html, 'viewport', 'Should have viewport meta tag');
    await tester.assertContains(html, 'button', 'Should have button elements');
  });

  console.log('\n🎯 All tests completed!\n');
  const success = tester.summary();

  if (success) {
    console.log('🎉 All dashboard tests passed! The dashboard is working correctly.');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please check the dashboard implementation.');
    process.exit(1);
  }
}

// Run tests
runDashboardTests().catch(error => {
  console.error('❌ Test suite failed:', error.message);
  process.exit(1);
});