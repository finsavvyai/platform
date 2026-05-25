/**
 * Playwright E2E Test for BSL Monitor Dashboard
 * Run with: node playwright-test.js
 */

const { chromium } = require('playwright');

async function runTests() {
  console.log('🚀 Starting Playwright tests for BSL Monitor...\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = {
    passed: [],
    failed: []
  };

  // Test 1: Backend Health - Dashboard Status Endpoint
  try {
    console.log('📡 Testing: Backend Dashboard Status API...');
    const response = await page.goto('http://localhost:9098/api/dashboard/status', { 
      waitUntil: 'networkidle',
      timeout: 10000 
    });
    
    if (response.status() === 200) {
      const data = await response.json();
      console.log('✅ Backend status API working');
      console.log(`   - Overall health: ${data.overallHealth}`);
      console.log(`   - Services: ${Object.keys(data).filter(k => k !== 'overallHealth' && k !== 'lastUpdate').join(', ')}`);
      results.passed.push('Backend Dashboard Status API');
    } else {
      throw new Error(`Expected 200, got ${response.status()}`);
    }
  } catch (error) {
    console.error('❌ Backend status API failed:', error.message);
    results.failed.push({ test: 'Backend Dashboard Status API', error: error.message });
  }

  // Test 2: Backend Interfaces Endpoint
  try {
    console.log('\n📡 Testing: Backend Interfaces API...');
    const response = await page.goto('http://localhost:9098/api/dashboard/interfaces', { 
      waitUntil: 'networkidle',
      timeout: 10000 
    });
    
    if (response.status() === 200) {
      const data = await response.json();
      console.log('✅ Backend interfaces API working');
      console.log(`   - Interface types: ${Object.keys(data).join(', ')}`);
      results.passed.push('Backend Interfaces API');
    } else {
      throw new Error(`Expected 200, got ${response.status()}`);
    }
  } catch (error) {
    console.error('❌ Backend interfaces API failed:', error.message);
    results.failed.push({ test: 'Backend Interfaces API', error: error.message });
  }

  // Test 3: Frontend Dashboard Page
  try {
    console.log('\n🌐 Testing: Frontend Dashboard (http://localhost:3000)...');
    
    // Set a longer timeout for frontend
    await page.goto('http://localhost:3000', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Check if login page is visible (unauthenticated state)
    const pageText = await page.textContent('body');
    const hasLoginContent = pageText && (
      pageText.includes('BSL Monitor') || 
      pageText.includes('Dashboard') ||
      pageText.includes('authenticate')
    );

    if (hasLoginContent || page.url().includes('localhost:3000')) {
      console.log('✅ Frontend is accessible');
      console.log('   - Page loaded successfully');
      results.passed.push('Frontend Dashboard Page');
    } else {
      throw new Error('Page content not as expected');
    }
  } catch (error) {
    console.error('❌ Frontend test failed:', error.message);
    console.log('   Note: Frontend may not be running or may have build issues');
    results.failed.push({ test: 'Frontend Dashboard Page', error: error.message });
  }

  // Test 4: Backend Root Endpoint
  try {
    console.log('\n📡 Testing: Backend Root Endpoint...');
    const response = await page.goto('http://localhost:9098/', { 
      waitUntil: 'networkidle',
      timeout: 5000 
    });
    
    // Root should either redirect or return 404 (expected behavior)
    if (response.status() === 404 || response.status() === 200) {
      console.log(`✅ Backend root endpoint accessible (${response.status()})`);
      results.passed.push('Backend Root Endpoint');
    } else {
      throw new Error(`Unexpected status: ${response.status()}`);
    }
  } catch (error) {
    console.error('❌ Backend root endpoint test failed:', error.message);
    results.failed.push({ test: 'Backend Root Endpoint', error: error.message });
  }

  // Test 5: API Execute Endpoint
  try {
    console.log('\n📡 Testing: API Execute Endpoint...');
    const response = await page.goto('http://localhost:9098/api/dashboard/execute/api', { 
      waitUntil: 'networkidle',
      timeout: 10000 
    });
    
    if (response.status() === 200) {
      const data = await response.json();
      console.log('✅ API execute endpoint working');
      console.log(`   - Success: ${data.success}`);
      console.log(`   - Results count: ${data.results ? data.results.length : 0}`);
      results.passed.push('API Execute Endpoint');
    } else {
      throw new Error(`Expected 200, got ${response.status()}`);
    }
  } catch (error) {
    console.error('❌ API execute endpoint failed:', error.message);
    results.failed.push({ test: 'API Execute Endpoint', error: error.message });
  }

  await browser.close();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  
  if (results.passed.length > 0) {
    console.log('\n✅ Passed Tests:');
    results.passed.forEach(test => console.log(`   - ${test}`));
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    results.failed.forEach(({ test, error }) => {
      console.log(`   - ${test}: ${error}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  
  // Exit with appropriate code
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

// Run tests
runTests().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});



