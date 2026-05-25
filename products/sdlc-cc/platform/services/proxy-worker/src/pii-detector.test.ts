/**
 * PII Detector Tests
 *
 * Comprehensive test suite for PII detection patterns
 * Week 2 Day 1
 */

import { detectPII, redactPII, PIIType } from './pii-detector';

interface TestCase {
  name: string;
  input: string;
  expectedType: PIIType;
  expectedCount: number;
  shouldDetect: boolean;
}

const testCases: TestCase[] = [
  // SSN Tests
  {
    name: 'SSN with dashes',
    input: 'My SSN is 123-45-6789',
    expectedType: PIIType.SSN,
    expectedCount: 1,
    shouldDetect: true,
  },
  {
    name: 'SSN without dashes',
    input: 'SSN: 123456789',
    expectedType: PIIType.SSN,
    expectedCount: 0,
    shouldDetect: false, // Changed to require dashes for better accuracy
  },
  {
    name: 'Invalid SSN (starts with 000)',
    input: 'SSN: 000-12-3456',
    expectedType: PIIType.SSN,
    expectedCount: 0,
    shouldDetect: false,
  },

  // Credit Card Tests
  {
    name: 'Visa card (16 digits)',
    input: 'Card: 4532-1234-5678-9006',
    expectedType: PIIType.CREDIT_CARD,
    expectedCount: 1,
    shouldDetect: true,
  },
  {
    name: 'MasterCard',
    input: 'Payment: 5425233430109903',
    expectedType: PIIType.CREDIT_CARD,
    expectedCount: 1,
    shouldDetect: true,
  },
  {
    name: 'Invalid Luhn checksum',
    input: 'Card: 4532-1234-5678-9011',
    expectedType: PIIType.CREDIT_CARD,
    expectedCount: 0,
    shouldDetect: false,
  },

  // Email Tests
  {
    name: 'Standard email',
    input: 'Contact: john.doe@example.com',
    expectedType: PIIType.EMAIL,
    expectedCount: 1,
    shouldDetect: true,
  },
  {
    name: 'Email with subdomain',
    input: 'Email: support@mail.company.com',
    expectedType: PIIType.EMAIL,
    expectedCount: 1,
    shouldDetect: true,
  },
  {
    name: 'Multiple emails',
    input: 'From: alice@test.com, To: bob@example.org',
    expectedType: PIIType.EMAIL,
    expectedCount: 2,
    shouldDetect: true,
  },

  // Phone Tests
  {
    name: 'Phone with dashes',
    input: 'Call me at 555-123-4567',
    expectedType: PIIType.PHONE,
    expectedCount: 1,
    shouldDetect: true,
  },
  {
    name: 'Phone with parentheses',
    input: 'Phone: (555) 123-4567',
    expectedType: PIIType.PHONE,
    expectedCount: 1,
    shouldDetect: true,
  },
  {
    name: 'Phone with +1',
    input: 'Mobile: +1-555-123-4567',
    expectedType: PIIType.PHONE,
    expectedCount: 1,
    shouldDetect: true,
  },

  // IP Address Tests
  {
    name: 'Public IP address',
    input: 'Server IP: 203.0.113.42',
    expectedType: PIIType.IP_ADDRESS,
    expectedCount: 1,
    shouldDetect: true,
  },
  {
    name: 'Localhost (should not detect)',
    input: 'Connect to 127.0.0.1',
    expectedType: PIIType.IP_ADDRESS,
    expectedCount: 0,
    shouldDetect: false,
  },
  {
    name: 'Private IP (should not detect)',
    input: 'LAN IP: 192.168.1.1',
    expectedType: PIIType.IP_ADDRESS,
    expectedCount: 0,
    shouldDetect: false,
  },

  // API Key Tests
  {
    name: 'API key pattern',
    input: 'api_key: sk_live_1234567890abcdefghij',
    expectedType: PIIType.API_KEY,
    expectedCount: 1,
    shouldDetect: true,
  },
  {
    name: 'API secret',
    input: 'api-secret=my_secret_key_12345678901234567890',
    expectedType: PIIType.API_KEY,
    expectedCount: 1,
    shouldDetect: true,
  },

  // AWS Key Tests
  {
    name: 'AWS access key',
    input: 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE',
    expectedType: PIIType.AWS_KEY,
    expectedCount: 1,
    shouldDetect: true,
  },

  // Postal Code Tests
  {
    name: 'ZIP code',
    input: 'Address: 94102',
    expectedType: PIIType.POSTAL_CODE,
    expectedCount: 1,
    shouldDetect: true,
  },
  {
    name: 'ZIP+4 code',
    input: 'Mail to: 94102-1234',
    expectedType: PIIType.POSTAL_CODE,
    expectedCount: 1,
    shouldDetect: true,
  },

  // Bank Account Tests
  {
    name: 'Bank account number',
    input: 'Account: 1234567890123456',
    expectedType: PIIType.BANK_ACCOUNT,
    expectedCount: 1,
    shouldDetect: true,
  },

  // Routing Number Tests
  {
    name: 'Valid routing number',
    input: 'Bank routing: 021000021',
    expectedType: PIIType.ROUTING_NUMBER,
    expectedCount: 1,
    shouldDetect: true,
  },
];

// Run tests
console.log('🧪 Running PII Detection Tests...\n');

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  const matches = detectPII(testCase.input);
  const detectedType = matches.length > 0 ? matches[0].type : null;
  const detectedCount = matches.filter(m => m.type === testCase.expectedType).length;

  const success = testCase.shouldDetect
    ? detectedType === testCase.expectedType && detectedCount === testCase.expectedCount
    : detectedCount === 0;

  if (success) {
    console.log(`✅ PASS: ${testCase.name}`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${testCase.name}`);
    console.log(`   Input: "${testCase.input}"`);
    console.log(`   Expected: ${testCase.expectedType} (${testCase.expectedCount}x)`);
    console.log(`   Got: ${detectedType || 'none'} (${detectedCount}x)`);
    console.log(`   Matches:`, matches);
    failed++;
  }
}

// Redaction Tests
console.log('\n📝 Testing Redaction...\n');

const redactionTests = [
  {
    name: 'Redact SSN',
    input: 'My SSN is 123-45-6789 and email is john@example.com',
    expectedRedacted: 'My SSN is [SSN_REDACTED] and email is [EMAIL_REDACTED]',
  },
  {
    name: 'Redact credit card',
    input: 'Pay with card 4532-1234-5678-9006',
    expectedRedacted: 'Pay with card [CREDIT_CARD_REDACTED]',
  },
  {
    name: 'Redact phone',
    input: 'Call (555) 123-4567',
    expectedRedacted: 'Call [PHONE_REDACTED]',
  },
];

for (const test of redactionTests) {
  const result = redactPII(test.input);
  const success = result.redactedText === test.expectedRedacted;

  if (success) {
    console.log(`✅ PASS: ${test.name}`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${test.name}`);
    console.log(`   Input: "${test.input}"`);
    console.log(`   Expected: "${test.expectedRedacted}"`);
    console.log(`   Got: "${result.redactedText}"`);
    failed++;
  }
}

// Summary
console.log('\n' + '='.repeat(50));
console.log(`📊 Test Summary:`);
console.log(`   Passed: ${passed}`);
console.log(`   Failed: ${failed}`);
console.log(`   Total: ${passed + failed}`);
console.log(`   Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
console.log('='.repeat(50));

if (failed === 0) {
  console.log('\n🎉 All tests passed!');
} else {
  console.log(`\n⚠️  ${failed} test(s) failed`);
  process.exit(1);
}
