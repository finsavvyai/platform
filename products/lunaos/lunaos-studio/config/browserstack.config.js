/**
 * BrowserStack Configuration
 * Cross-browser testing configuration for LunaOS Studio
 * Requirements: 7.5 - Cross-browser testing setup
 */

/**
 * Target browsers for testing
 * Based on requirement 7.1 - Support latest two versions of major browsers
 */
export const targetBrowsers = [
  // Chrome - Latest 2 versions
  {
    browserName: 'Chrome',
    browserVersion: 'latest',
    os: 'Windows',
    osVersion: '11',
    name: 'Chrome Latest - Windows 11'
  },
  {
    browserName: 'Chrome',
    browserVersion: 'latest-1',
    os: 'macOS',
    osVersion: 'Monterey',
    name: 'Chrome Latest-1 - macOS Monterey'
  },
  
  // Firefox - Latest 2 versions
  {
    browserName: 'Firefox',
    browserVersion: 'latest',
    os: 'Windows',
    osVersion: '11',
    name: 'Firefox Latest - Windows 11'
  },
  {
    browserName: 'Firefox',
    browserVersion: 'latest-1',
    os: 'macOS',
    osVersion: 'Monterey',
    name: 'Firefox Latest-1 - macOS Monterey'
  },
  
  // Safari - Latest 2 versions (macOS only)
  {
    browserName: 'Safari',
    browserVersion: 'latest',
    os: 'macOS',
    osVersion: 'Monterey',
    name: 'Safari Latest - macOS Monterey'
  },
  {
    browserName: 'Safari',
    browserVersion: 'latest-1',
    os: 'macOS',
    osVersion: 'Big Sur',
    name: 'Safari Latest-1 - macOS Big Sur'
  },
  
  // Edge - Latest 2 versions
  {
    browserName: 'Edge',
    browserVersion: 'latest',
    os: 'Windows',
    osVersion: '11',
    name: 'Edge Latest - Windows 11'
  },
  {
    browserName: 'Edge',
    browserVersion: 'latest-1',
    os: 'Windows',
    osVersion: '10',
    name: 'Edge Latest-1 - Windows 10'
  },
  
  // Mobile browsers
  {
    browserName: 'Safari',
    deviceName: 'iPhone 13',
    osVersion: '15',
    realMobile: true,
    name: 'Safari - iPhone 13'
  },
  {
    browserName: 'Chrome',
    deviceName: 'Samsung Galaxy S21',
    osVersion: '11.0',
    realMobile: true,
    name: 'Chrome - Samsung Galaxy S21'
  }
];

/**
 * BrowserStack configuration
 */
export const browserstackConfig = {
  // BrowserStack credentials (set via environment variables)
  user: process.env.BROWSERSTACK_USERNAME,
  key: process.env.BROWSERSTACK_ACCESS_KEY,
  
  // Project settings
  project: 'LunaOS Studio',
  build: `Build ${new Date().toISOString().split('T')[0]}`,
  
  // Test settings
  timeout: 300, // 5 minutes
  idleTimeout: 90, // 1.5 minutes
  
  // Debugging
  debug: true,
  networkLogs: true,
  consoleLogs: 'verbose',
  
  // Local testing (for development)
  local: false,
  localIdentifier: null,
  
  // Selenium settings
  seleniumVersion: '4.0.0',
  
  // Common capabilities
  commonCapabilities: {
    'browserstack.debug': true,
    'browserstack.console': 'verbose',
    'browserstack.networkLogs': true,
    'browserstack.selenium_version': '4.0.0'
  }
};

/**
 * Playwright configuration for BrowserStack
 */
export const playwrightBrowserStackConfig = {
  // Test directory
  testDir: './tests/cross-browser',
  
  // Global test timeout
  timeout: 60000,
  
  // Expect timeout
  expect: {
    timeout: 10000
  },
  
  // Retry failed tests
  retries: 2,
  
  // Parallel workers
  workers: 4,
  
  // Reporter
  reporter: [
    ['html', { outputFolder: 'test-results/cross-browser' }],
    ['json', { outputFile: 'test-results/cross-browser/results.json' }],
    ['junit', { outputFile: 'test-results/cross-browser/junit.xml' }]
  ],
  
  // Global setup
  globalSetup: './tests/cross-browser/global-setup.js',
  
  // Use projects for different browsers
  projects: targetBrowsers.map(browser => ({
    name: browser.name,
    use: {
      ...browser,
      // BrowserStack specific settings
      connectOptions: {
        wsEndpoint: `wss://cdp.browserstack.com/playwright?caps=${encodeURIComponent(JSON.stringify({
          ...browser,
          ...browserstackConfig.commonCapabilities,
          'browserstack.user': browserstackConfig.user,
          'browserstack.key': browserstackConfig.key,
          'browserstack.project': browserstackConfig.project,
          'browserstack.build': browserstackConfig.build
        }))}`
      }
    }
  }))
};

/**
 * Test scenarios for cross-browser testing
 */
export const testScenarios = [
  {
    name: 'Basic Application Load',
    description: 'Test that the application loads and displays correctly',
    tests: [
      'Application loads without errors',
      'Main interface elements are visible',
      'Canvas is rendered properly',
      'Toolbar buttons are functional'
    ]
  },
  {
    name: 'Workflow Creation',
    description: 'Test workflow creation functionality',
    tests: [
      'Can create new workflow',
      'Can add nodes to canvas',
      'Can connect nodes',
      'Can save workflow'
    ]
  },
  {
    name: 'Feature Detection',
    description: 'Test feature detection and compatibility warnings',
    tests: [
      'Feature detection runs correctly',
      'Compatibility warnings display when needed',
      'Graceful degradation for unsupported features'
    ]
  },
  {
    name: 'Performance',
    description: 'Test performance across browsers',
    tests: [
      'Page load time under 3 seconds',
      'Canvas interactions are smooth',
      'Memory usage stays reasonable',
      'No JavaScript errors in console'
    ]
  },
  {
    name: 'Responsive Design',
    description: 'Test responsive design on different screen sizes',
    tests: [
      'Layout adapts to different screen sizes',
      'Touch interactions work on mobile',
      'Text remains readable at all sizes',
      'Navigation is accessible on mobile'
    ]
  }
];

/**
 * Browser-specific test configurations
 */
export const browserSpecificTests = {
  Safari: {
    // Safari-specific tests
    additionalTests: [
      'WebKit-specific CSS properties work correctly',
      'Safari privacy features don\'t break functionality',
      'Touch events work properly on macOS'
    ],
    knownIssues: [
      'Some CSS Grid features may behave differently',
      'Service Worker support may be limited'
    ]
  },
  
  Firefox: {
    // Firefox-specific tests
    additionalTests: [
      'Gecko-specific rendering is correct',
      'Firefox developer tools integration works',
      'Privacy settings don\'t interfere'
    ],
    knownIssues: [
      'Some WebGL features may have different performance',
      'Font rendering may differ slightly'
    ]
  },
  
  Chrome: {
    // Chrome-specific tests
    additionalTests: [
      'Blink rendering engine works correctly',
      'Chrome DevTools integration functions',
      'V8 JavaScript engine performs well'
    ],
    knownIssues: []
  },
  
  Edge: {
    // Edge-specific tests
    additionalTests: [
      'Chromium-based Edge compatibility',
      'Windows integration features work',
      'Edge-specific security features don\'t interfere'
    ],
    knownIssues: [
      'Some legacy Edge behaviors may persist'
    ]
  }
};

/**
 * Generate BrowserStack capabilities
 * @param {object} browser - Browser configuration
 * @returns {object} BrowserStack capabilities
 */
export function generateCapabilities(browser) {
  return {
    ...browser,
    ...browserstackConfig.commonCapabilities,
    'browserstack.user': browserstackConfig.user,
    'browserstack.key': browserstackConfig.key,
    'browserstack.project': browserstackConfig.project,
    'browserstack.build': browserstackConfig.build,
    name: browser.name || `${browser.browserName} ${browser.browserVersion}`
  };
}

/**
 * Validate BrowserStack configuration
 * @returns {object} Validation result
 */
export function validateConfig() {
  const errors = [];
  const warnings = [];
  
  if (!browserstackConfig.user) {
    errors.push('BROWSERSTACK_USERNAME environment variable is required');
  }
  
  if (!browserstackConfig.key) {
    errors.push('BROWSERSTACK_ACCESS_KEY environment variable is required');
  }
  
  if (targetBrowsers.length === 0) {
    errors.push('No target browsers configured');
  }
  
  // Check for minimum browser coverage
  const browserNames = [...new Set(targetBrowsers.map(b => b.browserName))];
  const requiredBrowsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];
  const missingBrowsers = requiredBrowsers.filter(b => !browserNames.includes(b));
  
  if (missingBrowsers.length > 0) {
    warnings.push(`Missing browser coverage: ${missingBrowsers.join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export default {
  targetBrowsers,
  browserstackConfig,
  playwrightBrowserStackConfig,
  testScenarios,
  browserSpecificTests,
  generateCapabilities,
  validateConfig
};