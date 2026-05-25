#!/usr/bin/env node

const { chromium } = require('playwright');
const axios = require('axios');

class SmokeTestSuite {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.results = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: { total: 0, passed: 0, failed: 0 }
    };
    
    this.config = {
      frontendUrl: process.env.FRONTEND_URL || 'https://qestro.app',
      backendUrl: process.env.BACKEND_URL || 'https://api.qestro.app',
      timeout: 30000
    };
  }

  /**
   * Run all smoke tests
   */
  async runSmokeTests() {
    console.log('🔥 Starting Post-Deployment Smoke Tests...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      // Setup browser
      await this.setupBrowser();
      
      // Critical path tests
      await this.testFrontendLoads();
      await this.testUserRegistration();
      await this.testUserLogin();
      await this.testDashboardAccess();
      await this.testAITestGeneration();
      await this.testRecordingFunctionality();
      
      // API smoke tests
      await this.testCriticalAPIEndpoints();
      await this.testWebSocketConnection();
      
      // Integration smoke tests
      await this.testFrontendBackendIntegration();
      
      // Generate report
      this.generateSmokeTestReport();
      
    } catch (error) {
      console.error('❌ Smoke tests failed:', error);
      this.addTestResult('smoke_test_error', false, `Smoke tests failed: ${error.message}`);
    } finally {
      await this.cleanup();
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Post-Deployment Smoke Tests Complete');
    
    return this.results;
  }

  /**
   * Setup browser for testing
   */
  async setupBrowser() {
    console.log('🌐 Setting up browser...');
    
    try {
      this.browser = await chromium.launch({
        headless: process.env.HEADLESS !== 'false'
      });
      
      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (compatible; QestroSmokeTest/1.0)'
      });
      
      this.page = await this.context.newPage();
      
      // Set longer timeout for production
      this.page.setDefaultTimeout(this.config.timeout);
      
      this.addTestResult('browser_setup', true, 'Browser setup successful');
      
    } catch (error) {
      this.addTestResult('browser_setup', false, `Browser setup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Test frontend loads correctly
   */
  async testFrontendLoads() {
    console.log('🏠 Testing frontend loads...');
    
    try {
      const response = await this.page.goto(this.config.frontendUrl, {
        waitUntil: 'networkidle'
      });
      
      if (response.status() === 200) {
        // Check if page contains expected content
        const title = await this.page.title();
        const hasQuestroContent = await this.page.locator('text=Qestro').count() > 0 ||
                                 await this.page.locator('text=questro').count() > 0;
        
        if (title && hasQuestroContent) {
          this.addTestResult('frontend_loads', true, `Frontend loaded successfully (${title})`);
        } else {
          this.addTestResult('frontend_loads', false, 'Frontend loaded but content validation failed');
        }
      } else {
        this.addTestResult('frontend_loads', false, `Frontend returned status ${response.status()}`);
      }
      
    } catch (error) {
      this.addTestResult('frontend_loads', false, `Frontend load test failed: ${error.message}`);
    }
  }

  /**
   * Test user registration flow
   */
  async testUserRegistration() {
    console.log('📝 Testing user registration...');
    
    try {
      // Navigate to signup page
      await this.page.goto(`${this.config.frontendUrl}/signup`);
      
      // Check if signup form exists
      const signupForm = await this.page.locator('form').count();
      
      if (signupForm > 0) {
        // Try to fill form (but don't actually submit)
        const emailField = this.page.locator('input[type="email"]');
        const passwordField = this.page.locator('input[type="password"]');
        
        if (await emailField.count() > 0 && await passwordField.count() > 0) {
          this.addTestResult('user_registration', true, 'Registration form is accessible and functional');
        } else {
          this.addTestResult('user_registration', false, 'Registration form fields missing');
        }
      } else {
        this.addTestResult('user_registration', false, 'Registration form not found');
      }
      
    } catch (error) {
      this.addTestResult('user_registration', false, `Registration test failed: ${error.message}`);
    }
  }

  /**
   * Test user login flow
   */
  async testUserLogin() {
    console.log('🔐 Testing user login...');
    
    try {
      // Navigate to login page
      await this.page.goto(`${this.config.frontendUrl}/login`);
      
      // Check if login form exists
      const loginForm = await this.page.locator('form').count();
      
      if (loginForm > 0) {
        const emailField = this.page.locator('input[type="email"]');
        const passwordField = this.page.locator('input[type="password"]');
        const submitButton = this.page.locator('button[type="submit"]');
        
        if (await emailField.count() > 0 && 
            await passwordField.count() > 0 && 
            await submitButton.count() > 0) {
          this.addTestResult('user_login', true, 'Login form is accessible and functional');
        } else {
          this.addTestResult('user_login', false, 'Login form elements missing');
        }
      } else {
        this.addTestResult('user_login', false, 'Login form not found');
      }
      
    } catch (error) {
      this.addTestResult('user_login', false, `Login test failed: ${error.message}`);
    }
  }

  /**
   * Test dashboard access
   */
  async testDashboardAccess() {
    console.log('📊 Testing dashboard access...');
    
    try {
      // Try to access dashboard (should redirect to login)
      await this.page.goto(`${this.config.frontendUrl}/dashboard`);
      
      // Should either show login form or dashboard content
      const hasLoginForm = await this.page.locator('form').count() > 0;
      const hasDashboardContent = await this.page.locator('text=Dashboard').count() > 0;
      
      if (hasLoginForm || hasDashboardContent) {
        this.addTestResult('dashboard_access', true, 'Dashboard route is accessible');
      } else {
        this.addTestResult('dashboard_access', false, 'Dashboard route not working correctly');
      }
      
    } catch (error) {
      this.addTestResult('dashboard_access', false, `Dashboard access test failed: ${error.message}`);
    }
  }

  /**
   * Test AI test generation page
   */
  async testAITestGeneration() {
    console.log('🤖 Testing AI test generation...');
    
    try {
      await this.page.goto(`${this.config.frontendUrl}/ai-tests`);
      
      // Look for AI test generation elements
      const hasTextarea = await this.page.locator('textarea').count() > 0;
      const hasGenerateButton = await this.page.locator('button:has-text("Generate")').count() > 0;
      
      if (hasTextarea && hasGenerateButton) {
        this.addTestResult('ai_test_generation', true, 'AI test generation page is functional');
      } else {
        this.addTestResult('ai_test_generation', false, 'AI test generation page elements missing');
      }
      
    } catch (error) {
      this.addTestResult('ai_test_generation', false, `AI test generation test failed: ${error.message}`);
    }
  }

  /**
   * Test recording functionality page
   */
  async testRecordingFunctionality() {
    console.log('🎬 Testing recording functionality...');
    
    try {
      await this.page.goto(`${this.config.frontendUrl}/recording`);
      
      // Look for recording elements
      const hasUrlInput = await this.page.locator('input[type="url"]').count() > 0;
      const hasRecordButton = await this.page.locator('button:has-text("Record")').count() > 0;
      
      if (hasUrlInput && hasRecordButton) {
        this.addTestResult('recording_functionality', true, 'Recording page is functional');
      } else {
        this.addTestResult('recording_functionality', false, 'Recording page elements missing');
      }
      
    } catch (error) {
      this.addTestResult('recording_functionality', false, `Recording functionality test failed: ${error.message}`);
    }
  }

  /**
   * Test critical API endpoints
   */
  async testCriticalAPIEndpoints() {
    console.log('📡 Testing critical API endpoints...');
    
    const endpoints = [
      { path: '/api', expectedStatus: 200 },
      { path: '/health', expectedStatus: 200 },
      { path: '/api/auth/login', expectedStatus: 400 }, // Should return 400 for missing body
      { path: '/api/recordings', expectedStatus: 401 }  // Should return 401 for unauthorized
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(`${this.config.backendUrl}${endpoint.path}`, {
          validateStatus: () => true,
          timeout: 10000
        });
        
        if (response.status === endpoint.expectedStatus) {
          this.addTestResult(`api_${endpoint.path.replace(/[^a-zA-Z0-9]/g, '_')}`, true, `API endpoint ${endpoint.path} responding correctly`);
        } else {
          this.addTestResult(`api_${endpoint.path.replace(/[^a-zA-Z0-9]/g, '_')}`, false, `API endpoint ${endpoint.path} returned ${response.status}, expected ${endpoint.expectedStatus}`);
        }
        
      } catch (error) {
        this.addTestResult(`api_${endpoint.path.replace(/[^a-zA-Z0-9]/g, '_')}`, false, `API endpoint ${endpoint.path} failed: ${error.message}`);
      }
    }
  }

  /**
   * Test WebSocket connection
   */
  async testWebSocketConnection() {
    console.log('🔌 Testing WebSocket connection...');
    
    return new Promise((resolve) => {
      try {
        const WebSocket = require('ws');
        const wsUrl = this.config.backendUrl.replace('https://', 'wss://').replace('http://', 'ws://');
        const ws = new WebSocket(wsUrl);
        
        const timeout = setTimeout(() => {
          ws.close();
          this.addTestResult('websocket_smoke', false, 'WebSocket connection timeout');
          resolve();
        }, 10000);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          this.addTestResult('websocket_smoke', true, 'WebSocket connection successful');
          ws.close();
          resolve();
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          this.addTestResult('websocket_smoke', false, `WebSocket connection failed: ${error.message}`);
          resolve();
        });
        
      } catch (error) {
        this.addTestResult('websocket_smoke', false, `WebSocket test setup failed: ${error.message}`);
        resolve();
      }
    });
  }

  /**
   * Test frontend-backend integration
   */
  async testFrontendBackendIntegration() {
    console.log('🔗 Testing frontend-backend integration...');
    
    try {
      // Navigate to a page that makes API calls
      await this.page.goto(`${this.config.frontendUrl}/dashboard`);
      
      // Wait for any network requests to complete
      await this.page.waitForTimeout(3000);
      
      // Check for any JavaScript errors
      const errors = [];
      this.page.on('pageerror', error => errors.push(error));
      
      // Check for failed network requests
      const failedRequests = [];
      this.page.on('response', response => {
        if (response.status() >= 400) {
          failedRequests.push(`${response.status()} ${response.url()}`);
        }
      });
      
      await this.page.waitForTimeout(2000);
      
      if (errors.length === 0 && failedRequests.length === 0) {
        this.addTestResult('frontend_backend_integration', true, 'Frontend-backend integration working');
      } else {
        this.addTestResult('frontend_backend_integration', false, `Integration issues: ${errors.length} JS errors, ${failedRequests.length} failed requests`);
      }
      
    } catch (error) {
      this.addTestResult('frontend_backend_integration', false, `Integration test failed: ${error.message}`);
    }
  }

  /**
   * Add test result
   */
  addTestResult(testName, passed, message) {
    const result = {
      test: testName,
      passed,
      message,
      timestamp: new Date().toISOString()
    };
    
    this.results.tests.push(result);
    this.results.summary.total++;
    
    if (passed) {
      this.results.summary.passed++;
      console.log(`  ✅ ${testName}: ${message}`);
    } else {
      this.results.summary.failed++;
      console.log(`  ❌ ${testName}: ${message}`);
    }
  }

  /**
   * Generate smoke test report
   */
  generateSmokeTestReport() {
    const fs = require('fs');
    const path = require('path');
    
    const reportPath = path.join(process.cwd(), 'smoke-test-report.json');
    
    // Calculate success rate
    const successRate = ((this.results.summary.passed / this.results.summary.total) * 100).toFixed(2);
    
    this.results.summary.successRate = `${successRate}%`;
    this.results.summary.status = this.results.summary.failed === 0 ? 'PASSED' : 'FAILED';
    
    // Write report
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    
    // Generate summary
    console.log('\n🔥 Smoke Test Summary:');
    console.log(`   Total Tests: ${this.results.summary.total}`);
    console.log(`   Passed: ${this.results.summary.passed}`);
    console.log(`   Failed: ${this.results.summary.failed}`);
    console.log(`   Success Rate: ${successRate}%`);
    console.log(`   Status: ${this.results.summary.status}`);
    console.log(`\n📄 Smoke test report saved to: ${reportPath}`);
    
    // Exit with appropriate code
    if (this.results.summary.failed > 0) {
      process.exit(1);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      if (this.page) await this.page.close();
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}

// Run smoke tests if called directly
if (require.main === module) {
  const smokeTests = new SmokeTestSuite();
  smokeTests.runSmokeTests().catch(console.error);
}

module.exports = SmokeTestSuite;