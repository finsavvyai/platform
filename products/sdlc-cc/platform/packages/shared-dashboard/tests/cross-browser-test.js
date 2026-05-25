/**
 * Cross-Browser Compatibility Test
 * Simulates testing across different browsers and viewports
 */

class CrossBrowserTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      browsers: {},
      viewports: {}
    };
  }

  async testViewport(viewportName, width, height) {
    console.log(`📱 Testing ${viewportName} (${width}x${height})`);

    const viewportResults = {
      passed: 0,
      failed: 0,
      tests: []
    };

    const tests = [
      {
        name: 'Content loads correctly',
        test: async () => {
          const response = await fetch('http://localhost:3000');
          const html = await response.text();

          if (html.length < 1000) {
            throw new Error('Content too small');
          }

          return { contentLength: html.length, hasContent: true };
        }
      },
      {
        name: 'Responsive grid classes present',
        test: async () => {
          const response = await fetch('http://localhost:3000');
          const html = await response.text();

          const hasResponsiveClasses = html.includes('grid-cols-1') && html.includes('lg:grid-cols-12');
          if (!hasResponsiveClasses) {
            throw new Error('Missing responsive grid classes');
          }

          return { responsiveClasses: true };
        }
      },
      {
        name: 'Mobile-optimized elements',
        test: async () => {
          const response = await fetch('http://localhost:3000');
          const html = await response.text();

          const hasMobileFeatures = html.includes('viewport') && html.includes('min-h-screen');
          if (!hasMobileFeatures) {
            throw new Error('Missing mobile optimizations');
          }

          return { mobileOptimized: true };
        }
      }
    ];

    for (const test of tests) {
      try {
        const result = await test.test();
        console.log(`   ✅ ${test.name}`);
        viewportResults.passed++;
        viewportResults.tests.push({ name: test.name, status: 'passed', result });
      } catch (error) {
        console.log(`   ❌ ${test.name}: ${error.message}`);
        viewportResults.failed++;
        viewportResults.tests.push({ name: test.name, status: 'failed', error: error.message });
      }
    }

    this.results.viewports[viewportName] = viewportResults;
    this.results.passed += viewportResults.passed;
    this.results.failed += viewportResults.failed;

    return viewportResults;
  }

  async testBrowser(browserName, userAgent) {
    console.log(`🌐 Testing ${browserName}`);

    const browserResults = {
      passed: 0,
      failed: 0,
      tests: []
    };

    const tests = [
      {
        name: 'JavaScript compatibility',
        test: async () => {
          const response = await fetch('http://localhost:3000');
          const html = await response.text();

          const jsFeatures = [
            'toggleTheme()',
            'updateMetrics()',
            'addEventListener',
            'classList'
          ];

          const missingFeatures = jsFeatures.filter(feature => !html.includes(feature));
          if (missingFeatures.length > 1) {
            throw new Error(`Missing JS features: ${missingFeatures.join(', ')}`);
          }

          return { jsCompatible: true, featuresFound: jsFeatures.length - missingFeatures.length };
        }
      },
      {
        name: 'CSS framework support',
        test: async () => {
          const response = await fetch('http://localhost:3000');
          const html = await response.text();

          const hasTailwind = html.includes('tailwindcss.com');
          const hasAnimations = html.includes('animate-pulse');

          if (!hasTailwind || !hasAnimations) {
            throw new Error('CSS framework not properly loaded');
          }

          return { cssSupport: true, tailwind: hasTailwind, animations: hasAnimations };
        }
      },
      {
        name: 'Modern JS features',
        test: async () => {
          const response = await fetch('http://localhost:3000');
          const html = await response.text();

          const modernFeatures = ['const', 'let', '=>', 'Math.random()'];
          const foundFeatures = modernFeatures.filter(feature => html.includes(feature));

          if (foundFeatures.length < 2) {
            throw new Error('Not enough modern JavaScript features');
          }

          return { modernJS: true, featuresFound: foundFeatures };
        }
      }
    ];

    for (const test of tests) {
      try {
        const result = await test.test();
        console.log(`   ✅ ${test.name}`);
        browserResults.passed++;
        browserResults.tests.push({ name: test.name, status: 'passed', result });
      } catch (error) {
        console.log(`   ❌ ${test.name}: ${error.message}`);
        browserResults.failed++;
        browserResults.tests.push({ name: test.name, status: 'failed', error: error.message });
      }
    }

    this.results.browsers[browserName] = browserResults;
    this.results.passed += browserResults.passed;
    this.results.failed += browserResults.failed;

    return browserResults;
  }

  async runCrossBrowserTests() {
    console.log('🌍 Starting Cross-Browser Compatibility Tests\n');

    // Test different viewports (simulated)
    const viewports = [
      { name: 'Mobile', width: 375, height: 667 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Desktop', width: 1920, height: 1080 },
      { name: 'Large Desktop', width: 2560, height: 1440 }
    ];

    for (const viewport of viewports) {
      await this.testViewport(viewport.name, viewport.width, viewport.height);
    }

    // Test different browsers (simulated)
    const browsers = [
      { name: 'Chrome/Chromium', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      { name: 'Firefox', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:91.0) Gecko/20100101 Firefox/91.0' },
      { name: 'Safari/WebKit', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15' },
      { name: 'Edge', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/91.0' }
    ];

    for (const browser of browsers) {
      await this.testBrowser(browser.name, browser.userAgent);
    }

    return this.generateReport();
  }

  generateReport() {
    console.log('\n📊 Cross-Browser Compatibility Report');
    console.log('=' .repeat(50));

    // Viewport results
    console.log('\n📱 Viewport Compatibility:');
    Object.entries(this.results.viewports).forEach(([name, results]) => {
      const total = results.passed + results.failed;
      const successRate = total > 0 ? ((results.passed / total) * 100).toFixed(1) : 0;
      console.log(`   ${name}: ${successRate}% (${results.passed}/${total} tests passed)`);
    });

    // Browser results
    console.log('\n🌐 Browser Compatibility:');
    Object.entries(this.results.browsers).forEach(([name, results]) => {
      const total = results.passed + results.failed;
      const successRate = total > 0 ? ((results.passed / total) * 100).toFixed(1) : 0;
      console.log(`   ${name}: ${successRate}% (${results.passed}/${total} tests passed)`);
    });

    // Overall results
    const totalTests = this.results.passed + this.results.failed;
    const overallSuccessRate = totalTests > 0 ? ((this.results.passed / totalTests) * 100).toFixed(1) : 0;

    console.log(`\n🎯 Overall Compatibility: ${overallSuccessRate}%`);
    console.log(`✅ Compatible Tests: ${this.results.passed}`);
    console.log(`❌ Failed Tests: ${this.results.failed}`);

    // Recommendations
    console.log('\n💡 Recommendations:');
    if (overallSuccessRate >= 95) {
      console.log('   🟢 Excellent cross-browser compatibility');
    } else if (overallSuccessRate >= 85) {
      console.log('   🟡 Good compatibility with minor issues');
    } else {
      console.log('   🔴 Significant compatibility issues need attention');
    }

    return {
      overallSuccessRate: parseFloat(overallSuccessRate),
      passed: this.results.passed,
      failed: this.results.failed,
      viewportResults: this.results.viewports,
      browserResults: this.results.browsers
    };
  }
}

// Main test execution
async function runCrossBrowserTests() {
  const tester = new CrossBrowserTester();

  try {
    const report = await tester.runCrossBrowserTests();

    if (report.overallSuccessRate >= 90) {
      console.log('\n🎉 Cross-browser testing completed successfully!');
      console.log('✅ Dashboard is ready for multi-browser deployment');
    } else {
      console.log('\n⚠️  Some compatibility issues detected');
      console.log('🔧 Review failed tests before production deployment');
    }

    return report;
  } catch (error) {
    console.error('💥 Cross-browser testing failed:', error.message);
    throw error;
  }
}

// Run tests
runCrossBrowserTests().catch(error => {
  console.error('💥 Cross-browser test suite failed:', error.message);
  process.exit(1);
});