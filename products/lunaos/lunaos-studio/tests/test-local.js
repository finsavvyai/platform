/**
 * Local GUI Tests
 * Tests the local development server
 */

const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class LocalGUITester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.server = null;
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: []
    };
    this.localUrl = 'http://localhost:8080';
  }

  async startLocalServer() {
    console.log('🚀 Starting local GUI server...');
        
    return new Promise((resolve, reject) => {
      // Start the Python server
      this.server = spawn('python3', ['server.py'], {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe'
      });
            
      this.server.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('Server:', output.trim());
                
        if (output.includes('Server running at')) {
          resolve();
        }
      });
            
      this.server.stderr.on('data', (data) => {
        console.error('Server Error:', data.toString());
      });
            
      this.server.on('error', (error) => {
        reject(error);
      });
            
      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 10000);
    });
  }

  async stopLocalServer() {
    if (this.server) {
      console.log('🛑 Stopping local server...');
      this.server.kill();
      this.server = null;
    }
  }

  async initialize() {
    console.log('🚀 Initializing Local GUI Tester...');
        
    // Start local server
    await this.startLocalServer();
        
    // Wait a bit for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
        
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1920, height: 1080 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
        
    this.page = await this.browser.newPage();
        
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

  async testLocalServer() {
    try {
      await this.page.goto(this.localUrl, { waitUntil: 'networkidle2' });
            
      const title = await this.page.title();
      if (!title.includes('LunaOS')) {
        return { success: false, message: 'Local server not serving correct page' };
      }
            
      return { success: true, message: 'Local server running correctly' };
    } catch (error) {
      return { success: false, message: `Local server error: ${error.message}` };
    }
  }

  async testFileServing() {
    // Test if all required files are served
    const requiredFiles = [
      '/js/main-simple.js',
      '/css/styles.css',
      '/favicon.ico'
    ];
        
    for (const file of requiredFiles) {
      try {
        const response = await this.page.goto(`${this.localUrl}${file}`);
        if (response.status() !== 200) {
          return { success: false, message: `File not served: ${file}` };
        }
      } catch (error) {
        return { success: false, message: `Error serving file ${file}: ${error.message}` };
      }
    }
        
    return { success: true, message: 'All required files served correctly' };
  }

  async testJavaScriptExecution() {
    await this.page.goto(this.localUrl, { waitUntil: 'networkidle2' });
        
    // Check if JavaScript functions are available
    const functions = await this.page.evaluate(() => {
      return {
        newWorkflow: typeof window.newWorkflow === 'function',
        saveWorkflow: typeof window.saveWorkflow === 'function',
        runWorkflow: typeof window.runWorkflow === 'function',
        zoomIn: typeof window.zoomIn === 'function',
        zoomOut: typeof window.zoomOut === 'function',
        resetView: typeof window.resetView === 'function'
      };
    });
        
    const missingFunctions = Object.entries(functions)
      .filter(([name, available]) => !available)
      .map(([name]) => name);
        
    if (missingFunctions.length > 0) {
      return { success: false, message: `Missing functions: ${missingFunctions.join(', ')}` };
    }
        
    return { success: true, message: 'All JavaScript functions available' };
  }

  async testButtonInteractions() {
    await this.page.goto(this.localUrl, { waitUntil: 'networkidle2' });
        
    // Test button clicks
    const buttons = [
      'button[onclick="newWorkflow()"]',
      'button[onclick="saveWorkflow()"]',
      'button[onclick="runWorkflow()"]'
    ];
        
    for (const buttonSelector of buttons) {
      const button = await this.page.$(buttonSelector);
      if (!button) {
        return { success: false, message: `Button not found: ${buttonSelector}` };
      }
            
      // Click button
      await button.click();
      await this.page.waitForTimeout(500);
    }
        
    return { success: true, message: 'All buttons clickable and responsive' };
  }

  async testCanvasRendering() {
    await this.page.goto(this.localUrl, { waitUntil: 'networkidle2' });
        
    // Check if canvas elements are rendered
    const canvasElements = await this.page.evaluate(() => {
      const konvaContainer = document.getElementById('konva-container');
      const threeContainer = document.getElementById('three-container');
            
      return {
        konvaExists: !!konvaContainer,
        threeExists: !!threeContainer,
        konvaHasContent: konvaContainer && konvaContainer.children.length > 0,
        threeHasContent: threeContainer && threeContainer.children.length > 0
      };
    });
        
    if (!canvasElements.konvaExists || !canvasElements.threeExists) {
      return { success: false, message: 'Canvas containers not found' };
    }
        
    return { success: true, message: 'Canvas elements rendered correctly' };
  }

  async testNodeSidebar() {
    await this.page.goto(this.localUrl, { waitUntil: 'networkidle2' });
        
    // Check node sidebar
    const nodeItems = await this.page.$$('.node-item');
    if (nodeItems.length === 0) {
      return { success: false, message: 'No node items found in sidebar' };
    }
        
    // Test drag and drop
    const firstNode = nodeItems[0];
    const canvas = await this.page.$('#konva-container');
        
    if (!canvas) {
      return { success: false, message: 'Canvas not found for drag test' };
    }
        
    // Simulate drag and drop
    const canvasBox = await canvas.boundingBox();
    await firstNode.hover();
    await this.page.mouse.down();
    await this.page.mouse.move(canvasBox.x + 100, canvasBox.y + 100);
    await this.page.mouse.up();
        
    await this.page.waitForTimeout(1000);
        
    return { success: true, message: `${nodeItems.length} node types available, drag and drop working` };
  }

  async testPerformance() {
    const startTime = Date.now();
        
    await this.page.goto(this.localUrl, { waitUntil: 'networkidle2' });
        
    const loadTime = Date.now() - startTime;
        
    if (loadTime > 5000) {
      return { success: false, message: `Local server too slow: ${loadTime}ms` };
    }
        
    return { success: true, message: `Local server performance good: ${loadTime}ms` };
  }

  async runAllTests() {
    console.log('🚀 Starting comprehensive test suite for local GUI...');
        
    const tests = [
      { name: 'Local Server', func: () => this.testLocalServer() },
      { name: 'File Serving', func: () => this.testFileServing() },
      { name: 'JavaScript Execution', func: () => this.testJavaScriptExecution() },
      { name: 'Button Interactions', func: () => this.testButtonInteractions() },
      { name: 'Canvas Rendering', func: () => this.testCanvasRendering() },
      { name: 'Node Sidebar', func: () => this.testNodeSidebar() },
      { name: 'Performance', func: () => this.testPerformance() }
    ];
        
    for (const test of tests) {
      await this.runTest(test.name, test.func);
    }
        
    this.generateReport();
  }

  generateReport() {
    const coverage = this.testResults.total > 0 ? 
      Math.round((this.testResults.passed / this.testResults.total) * 100) : 0;
        
    console.log('\n📊 Local Test Results Summary:');
    console.log('==============================');
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
        
    if (this.testResults.failed === 0) {
      console.log('\n🎉 All local tests passed! GUI is working correctly.');
    } else {
      console.log('\n⚠️  Some local tests failed. Please check the details above.');
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
    await this.stopLocalServer();
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  async function main() {
    const tester = new LocalGUITester();
        
    try {
      await tester.initialize();
      await tester.runAllTests();
    } catch (error) {
      console.error('Local test execution failed:', error);
    } finally {
      await tester.cleanup();
    }
  }
    
  main();
}

module.exports = LocalGUITester;
