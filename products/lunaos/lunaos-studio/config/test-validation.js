/**
 * Configuration Validation Test
 * Simple test to verify configuration validation works correctly
 * Requirements: 6.5 - Configuration validation testing
 */

import { validateConfigSchema } from './schema.js';
import { validateStartupConfig, ConfigValidationError } from './validator.js';

/**
 * Test configuration validation
 */
function testConfigValidation() {
  console.log('🧪 Testing Configuration Validation...\n');
  
  // Test 1: Valid configuration
  console.log('Test 1: Valid Configuration');
  const validConfig = {
    environment: 'development',
    apiUrl: 'http://localhost:3000',
    logLevel: 'debug',
    enableAnalytics: false,
    security: {
      enforceHTTPS: false,
      contentSecurityPolicy: {
        enabled: true,
        reportOnly: false
      },
      inputSanitization: {
        enabled: true,
        allowedTags: ['b', 'i', 'em', 'strong'],
        allowedAttributes: ['class', 'id']
      }
    },
    performance: {
      enableServiceWorker: true,
      enableCodeSplitting: true,
      enableCompression: true,
      maxBundleSize: 500,
      targetFPS: 60
    },
    featureFlags: {
      aiAssistant: true,
      collaboration: false,
      gamification: false,
      advancedNodes: true,
      themeCustomization: true,
      exportFormats: true
    }
  };
  
  const result1 = validateConfigSchema(validConfig);
  console.log('✅ Valid config result:', result1.valid ? 'PASS' : 'FAIL');
  if (!result1.valid) {
    console.log('Errors:', result1.errors);
  }
  console.log('');
  
  // Test 2: Invalid configuration (missing required fields)
  console.log('Test 2: Invalid Configuration (Missing Required Fields)');
  const invalidConfig = {
    environment: 'production',
    // Missing apiUrl, logLevel, etc.
    enableAnalytics: true
  };
  
  const result2 = validateConfigSchema(invalidConfig);
  console.log('❌ Invalid config result:', !result2.valid ? 'PASS' : 'FAIL');
  console.log('Expected errors found:', result2.errors.length > 0 ? 'YES' : 'NO');
  console.log('');
  
  // Test 3: Production validation (should require HTTPS)
  console.log('Test 3: Production Configuration Validation');
  const prodConfig = {
    ...validConfig,
    environment: 'production',
    apiUrl: 'http://api.example.com', // Should fail - not HTTPS
    security: {
      ...validConfig.security,
      enforceHTTPS: false // Should fail in production
    }
  };
  
  const result3 = validateConfigSchema(prodConfig);
  console.log('🔒 Production validation result:', !result3.valid ? 'PASS' : 'FAIL');
  console.log('HTTPS errors found:', result3.errors.some(e => e.includes('HTTPS')) ? 'YES' : 'NO');
  console.log('');
  
  // Test 4: Startup validation with error handling
  console.log('Test 4: Startup Validation Error Handling');
  try {
    validateStartupConfig(invalidConfig, { throwOnError: true });
    console.log('❌ Should have thrown error: FAIL');
  } catch (error) {
    console.log('✅ Correctly threw error:', error instanceof ConfigValidationError ? 'PASS' : 'FAIL');
    console.log('Error message includes details:', error.message.includes('validation failed') ? 'YES' : 'NO');
  }
  console.log('');
  
  // Test 5: Warning handling
  console.log('Test 5: Warning Handling');
  const configWithWarnings = {
    ...validConfig,
    environment: 'production',
    apiUrl: 'https://api.example.com',
    security: {
      ...validConfig.security,
      enforceHTTPS: true
    }
    // Missing sentryDSN - should generate warning
  };
  
  const result5 = validateConfigSchema(configWithWarnings);
  console.log('⚠️  Warnings generated:', result5.warnings.length > 0 ? 'PASS' : 'FAIL');
  console.log('Config still valid:', result5.valid ? 'YES' : 'NO');
  console.log('');
  
  console.log('🎉 Configuration validation tests completed!');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testConfigValidation();
}

export { testConfigValidation };