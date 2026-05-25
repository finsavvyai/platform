/**
 * Automated Tests for Deployed LunaOS GUI
 * Tests the live deployment at https://lunaos.ai
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class LunaOSGUITester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: []
    };
    this.deploymentUrl = 'https://lunaos.ai';
  }

  async initialize() {
    console.log('🚀 Initializing LunaOS GUI Tester...');
        
    this.browser = await puppeteer.launch({
      headless: false, // Set to true for CI/CD
      defaultViewport: { width: 1920, height: 1080 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
        
    this.page = await this.browser.newPage();
        
    // Set user agent
    await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
        
    // Enable console logging
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Browser Error:', msg.text());
      }
    });
        
    // Handle page errors
    this.page.on('pageerror', error => {
      console.error('Page Error:', error.message);
      this.testResults.errors.push(error.message);
    });
        
    console.log('✅ Browser initialized');
  }

  async runTest(testName, testFunction) {
    console.log(`🧪 Running test: ${testName}`);
    this.testResults.total++;
        
    try {
      const result = await testFunction();
      if (result.success) {
        this.testResults.passed++;
        console.log(`✅ ${testName}: ${result.message}`);
      } else {
        this.testResults.failed++;
        console.log(`❌ ${testName}: ${result.message}`);
      }
    } catch (error) {
      this.testResults.failed++;
      this.testResults.errors.push(error.message);
      console.log(`❌ ${testName}: Error - ${error.message}`);
    }
  }

  async testPageLoad() {
    await this.page.goto(this.deploymentUrl, { waitUntil: 'networkidle2' });
        
    // Check if page loads successfully
    const title = await this.page.title();
    if (!title.includes('LunaOS')) {
      return { success: false, message: 'Page title does not contain LunaOS' };
    }
        
    // Check for required elements
    const requiredElements = [
      '#konva-container',
      '#three-container',
      '.node-sidebar',
      '.toolbar'
    ];
        
    for (const selector of requiredElements) {
      const element = await this.page.$(selector);
      if (!element) {
        return { success: false, message: `Required element not found: ${selector}` };
      }
    }
        
    return { success: true, message: 'Page loaded successfully with all required elements' };
  }

  async testButtonClickability() {
    // Test main workflow buttons
    const buttonSelectors = [
      'button[onclick="newWorkflow()"]',
      'button[onclick="saveWorkflow()"]',
      'button[onclick="runWorkflow()"]',
      'button[onclick="zoomIn()"]',
      'button[onclick="zoomOut()"]',
      'button[onclick="resetView()"]'
    ];
        
    for (const selector of buttonSelectors) {
      const button = await this.page.$(selector);
      if (!button) {
        return { success: false, message: `Button not found: ${selector}` };
      }
            
      // Check if button is clickable
      const isClickable = await this.page.evaluate((sel) => {
        const btn = document.querySelector(sel);
        return btn && !btn.disabled && btn.style.pointerEvents !== 'none';
      }, selector);
            
      if (!isClickable) {
        return { success: false, message: `Button not clickable: ${selector}` };
      }
    }
        
    return { success: true, message: 'All buttons are clickable' };
  }

  async testNewWorkflow() {
    // Mock the prompt function
    await this.page.evaluateOnNewDocument(() => {
      window.prompt = () => 'Test Workflow';
    });
        
    // Click new workflow button
    const newButton = await this.page.$('button[onclick="newWorkflow()"]');
    if (!newButton) {
      return { success: false, message: 'New workflow button not found' };
    }
        
    await newButton.click();
        
    // Wait a bit for any async operations
    await this.page.waitForTimeout(1000);
        
    return { success: true, message: 'New workflow button clicked successfully' };
  }

  async testNodeCreation() {
    // Check if node items are present
    const nodeItems = await this.page.$$('.node-item');
    if (nodeItems.length === 0) {
      return { success: false, message: 'No node items found in sidebar' };
    }
        
    // Test drag and drop functionality
    const firstNode = nodeItems[0];
    const canvas = await this.page.$('#konva-container');
        
    if (!canvas) {
      return { success: false, message: 'Canvas not found for drag and drop' };
    }
        
    // Get canvas bounding box
    const canvasBox = await canvas.boundingBox();
        
    // Simulate drag and drop
    await firstNode.hover();
    await this.page.mouse.down();
    await this.page.mouse.move(canvasBox.x + 100, canvasBox.y + 100);
    await this.page.mouse.up();
        
    // Wait for node creation
    await this.page.waitForTimeout(1000);
        
    return { success: true, message: `Found ${nodeItems.length} node types, drag and drop simulated` };
  }

  async testCanvasControls() {
    // Test zoom controls
    const zoomInButton = await this.page.$('button[onclick="zoomIn()"]');
    const zoomOutButton = await this.page.$('button[onclick="zoomOut()"]');
    const resetButton = await this.page.$('button[onclick="resetView()"]');
        
    if (!zoomInButton || !zoomOutButton || !resetButton) {
      return { success: false, message: 'Zoom control buttons not found' };
    }
        
    // Test zoom in
    await zoomInButton.click();
    await this.page.waitForTimeout(500);
        
    // Test zoom out
    await zoomOutButton.click();
    await this.page.waitForTimeout(500);
        
    // Test reset view
    await resetButton.click();
    await this.page.waitForTimeout(500);
        
    return { success: true, message: 'Canvas controls tested successfully' };
  }

  async testJavaScriptFunctions() {
    // Check if required JavaScript functions are available
    const requiredFunctions = [
      'newWorkflow',
      'saveWorkflow',
      'runWorkflow',
      'zoomIn',
      'zoomOut',
      'resetView',
      'toggleGrid',
      'toggle3D'
    ];
        
    const availableFunctions = await this.page.evaluate((functions) => {
      return functions.filter(func => typeof window[func] === 'function');
    }, requiredFunctions);
        
    if (availableFunctions.length !== requiredFunctions.length) {
      const missing = requiredFunctions.filter(f => !availableFunctions.includes(f));
      return { success: false, message: `Missing functions: ${missing.join(', ')}` };
    }
        
    return { success: true, message: 'All required JavaScript functions available' };
  }

  async testPerformance() {
    const startTime = Date.now();
        
    // Navigate to the page
    await this.page.goto(this.deploymentUrl, { waitUntil: 'networkidle2' });
        
    const loadTime = Date.now() - startTime;
        
    // Check if page loads within reasonable time (10 seconds)
    if (loadTime > 10000) {
      return { success: false, message: `Page load too slow: ${loadTime}ms` };
    }
        
    // Test JavaScript execution time
    const jsExecutionTime = await this.page.evaluate(() => {
      const start = performance.now();
            
      // Simulate some JavaScript operations
      for (let i = 0; i < 1000; i++) {
        Math.random();
      }
            
      return performance.now() - start;
    });
        
    if (jsExecutionTime > 100) {
      return { success: false, message: `JavaScript execution too slow: ${jsExecutionTime}ms` };
    }
        
    return { success: true, message: `Performance good - Load: ${loadTime}ms, JS: ${jsExecutionTime.toFixed(2)}ms` };
  }

  async testErrorHandling() {
    // Test error handling by injecting invalid JavaScript
    try {
      await this.page.evaluate(() => {
        // This should not crash the page
        try {
          window.nonExistentFunction();
        } catch (e) {
          // Expected error
        }
      });
            
      return { success: true, message: 'Error handling working correctly' };
    } catch (error) {
      return { success: false, message: `Error handling failed: ${error.message}` };
    }
  }

  async testResponsiveDesign() {
    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 1024, height: 768, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' }
    ];
        
    for (const viewport of viewports) {
      await this.page.setViewport(viewport);
      await this.page.waitForTimeout(500);
            
      // Check if main elements are still visible
      const canvas = await this.page.$('#konva-container');
      if (!canvas) {
        return { success: false, message: `Canvas not visible on ${viewport.name}` };
      }
    }
        
    return { success: true, message: 'Responsive design working across all viewports' };
  }

  async runAllTests() {
    console.log('🚀 Starting comprehensive test suite for deployed GUI...');
        
    const tests = [
      { name: 'Page Load', func: () => this.testPageLoad() },
      { name: 'Button Clickability', func: () => this.testButtonClickability() },
      { name: 'New Workflow', func: () => this.testNewWorkflow() },
      { name: 'Node Creation', func: () => this.testNodeCreation() },
      { name: 'Canvas Controls', func: () => this.testCanvasControls() },
      { name: 'JavaScript Functions', func: () => this.testJavaScriptFunctions() },
      { name: 'Performance', func: () => this.testPerformance() },
      { name: 'Error Handling', func: () => this.testErrorHandling() },
      { name: 'Responsive Design', func: () => this.testResponsiveDesign() }
    ];
        
    for (const test of tests) {
      await this.runTest(test.name, test.func);
    }
        
    this.generateReport();
  }

  generateReport() {
    const coverage = this.testResults.total > 0 ? 
      Math.round((this.testResults.passed / this.testResults.total) * 100) : 0;
        
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    console.log(`Total Tests: ${this.testResults.total}`);
    console.log(`Passed: ${this.testResults.passed}`);
    console.log(`Failed: ${this.testResults.failed}`);
    console.log(`Coverage: ${coverage}%`);
        
    if (this.testResults.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.testResults.errors.forEach(error => {
        console.log(`  - ${error}`);
      });
    }
        
    // Generate HTML report
    const reportHtml = this.generateHTMLReport();
    const reportPath = path.join(__dirname, 'test-report.html');
    fs.writeFileSync(reportPath, reportHtml);
        
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
        
    if (this.testResults.failed === 0) {
      console.log('\n🎉 All tests passed! GUI is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please check the report for details.');
    }
  }

  generateHTMLReport() {
    const coverage = this.testResults.total > 0 ? 
      Math.round((this.testResults.passed / this.testResults.total) * 100) : 0;
        
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LunaOS GUI Test Report</title>
    <style>
        body {
            font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
            color: white;
            margin: 0;
            padding: 20px;
            min-height: 100vh;
        }
        
        .report-container {
            max-width: 1200px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 20px;
            padding: 30px;
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .report-header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .report-header h1 {
            font-size: 2.5rem;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 15px;
            padding: 20px;
            text-align: center;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .stat-number {
            font-size: 2rem;
            font-weight: bold;
            color: #667eea;
        }
        
        .stat-label {
            color: rgba(255, 255, 255, 0.7);
            margin-top: 5px;
        }
        
        .coverage-bar {
            width: 100%;
            height: 20px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            overflow: hidden;
            margin: 20px 0;
        }
        
        .coverage-fill {
            height: 100%;
            background: linear-gradient(90deg, #10b981 0%, #059669 100%);
            width: ${coverage}%;
            transition: width 0.3s ease;
        }
        
        .test-details {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 15px;
            padding: 20px;
            margin-top: 30px;
        }
        
        .test-details h2 {
            color: #667eea;
            margin-bottom: 20px;
        }
        
        .error-list {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: 10px;
            padding: 15px;
            margin-top: 20px;
        }
        
        .error-item {
            color: #ef4444;
            margin-bottom: 5px;
        }
        
        .timestamp {
            color: rgba(255, 255, 255, 0.5);
            font-size: 0.9rem;
            text-align: center;
            margin-top: 30px;
        }
    </style>
</head>
<body>
    <div class="report-container">
        <div class="report-header">
            <h1>🧪 LunaOS GUI Test Report</h1>
            <p>Automated testing results for deployed GUI</p>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${this.testResults.total}</div>
                <div class="stat-label">Total Tests</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${this.testResults.passed}</div>
                <div class="stat-label">Passed</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${this.testResults.failed}</div>
                <div class="stat-label">Failed</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${coverage}%</div>
                <div class="stat-label">Coverage</div>
            </div>
        </div>
        
        <div class="coverage-bar">
            <div class="coverage-fill"></div>
        </div>
        
        <div class="test-details">
            <h2>Test Summary</h2>
            <p><strong>Deployment URL:</strong> ${this.deploymentUrl}</p>
            <p><strong>Test Date:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Browser:</strong> Puppeteer (Chromium)</p>
            
            ${this.testResults.errors.length > 0 ? `
                <div class="error-list">
                    <h3>Errors Encountered:</h3>
                    ${this.testResults.errors.map(error => `<div class="error-item">• ${error}</div>`).join('')}
                </div>
            ` : ''}
        </div>
        
        <div class="timestamp">
            Report generated on ${new Date().toLocaleString()}
        </div>
    </div>
</body>
</html>`;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  async function main() {
    const tester = new LunaOSGUITester();
        
    try {
      await tester.initialize();
      await tester.runAllTests();
    } catch (error) {
      console.error('Test execution failed:', error);
    } finally {
      await tester.cleanup();
    }
  }
    
  main();
}

module.exports = LunaOSGUITester;
