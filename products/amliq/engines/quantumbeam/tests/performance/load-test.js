import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";

// Custom metrics
export let errorRate = new Rate('errors');
export let quantumProcessingTime = new Rate('quantum_processing_time');
export let fraudDetectionRate = new Rate('fraud_detection_rate');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 300 }, // Ramp up to 300 users
    { duration: '5m', target: 300 }, // Stay at 300 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],   // Error rate under 1%
    errors: ['rate<0.05'],            // Custom error rate under 5%
  },
  ext: {
    loadimpact: {
      projectID: 123456,
      testRunID: "quantumbeam-load-test",
    },
  },
};

// Base URL and configuration
const BASE_URL = __ENV.BASE_URL || 'https://api.quantumbeam.io';
const API_KEY = __ENV.API_KEY || 'test-api-key';

// Test data generators
function generateTransaction() {
  return {
    transaction_id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    amount: Math.random() * 10000 + 10, // $10 - $10010
    currency: 'USD',
    merchant_id: `merchant-${Math.floor(Math.random() * 1000)}`,
    card_number: generateCardNumber(),
    timestamp: new Date().toISOString(),
    customer_id: `customer-${Math.floor(Math.random() * 10000)}`,
    ip_address: generateRandomIP(),
    device_id: `device-${Math.random().toString(36).substr(2, 9)}`,
  };
}

function generateCardNumber() {
  // Generate valid test card numbers
  const cardNumbers = [
    '4111111111111111', // Visa
    '5555555555554444', // Mastercard
    '378282246310005',   // American Express
    '6011111111111117', // Discover
    '30569309025904',    // Diner's Club
  ];
  return cardNumbers[Math.floor(Math.random() * cardNumbers.length)];
}

function generateRandomIP() {
  return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

// API helper functions
function analyzeFraud(transaction) {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'X-Request-ID': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    },
  };

  const response = http.post(`${BASE_URL}/api/v1/analyze`, JSON.stringify(transaction), params);

  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'response has fraud_score': (r) => JSON.parse(r.body).fraud_score !== undefined,
    'response has decision': (r) => JSON.parse(r.body).decision !== undefined,
  });

  if (!success) {
    errorRate.add(1);
  }

  // Parse response and update metrics
  try {
    const responseBody = JSON.parse(response.body);

    if (responseBody.quantum_processed) {
      quantumProcessingTime.add(1);
    }

    if (responseBody.decision === 'fraud') {
      fraudDetectionRate.add(1);
    }
  } catch (e) {
    console.error('Failed to parse response:', e);
    errorRate.add(1);
  }

  return response;
}

function healthCheck() {
  const params = {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
    },
  };

  return http.get(`${BASE_URL}/api/v1/health`, params);
}

function getMetrics() {
  const params = {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
    },
  };

  return http.get(`${BASE_URL}/metrics`, params);
}

// Test scenarios
export function setup() {
  console.log('Starting load test setup...');

  // Verify API is accessible
  const healthResponse = healthCheck();
  check(healthResponse, {
    'health check passed': (r) => r.status === 200,
  });

  console.log('Setup completed');
}

export default function () {
  // Main load test
  const transaction = generateTransaction();
  const response = analyzeFraud(transaction);

  // Brief pause between requests
  sleep(Math.random() * 0.5 + 0.1); // 100-600ms random pause
}

// Additional test scenarios
export function handleSummary(data) {
  // Generate HTML report
  htmlReport(data);

  console.log('Load test completed');
  console.log(`Total requests: ${data.metrics.http_reqs.count}`);
  console.log(`Average response time: ${data.metrics.http_req_duration.avg}ms`);
  console.log(`95th percentile: ${data.metrics.http_req_duration['p(95)']}ms`);
  console.log(`Error rate: ${(data.metrics.http_req_failed.rate * 100).toFixed(2)}%`);
  console.log(`Quantum processing rate: ${(quantumProcessingTime.rate * 100).toFixed(2)}%`);
  console.log(`Fraud detection rate: ${(fraudDetectionRate.rate * 100).toFixed(2)}%`);
}

// Export for external reporting
export function handleData(data) {
  return {
    'total_requests': data.metrics.http_reqs.count,
    'avg_response_time': data.metrics.http_req_duration.avg,
    'p95_response_time': data.metrics.http_req_duration['p(95)'],
    'p99_response_time': data.metrics.http_req_duration['p(99)'],
    'error_rate': data.metrics.http_req_failed.rate,
    'quantum_processing_rate': quantumProcessingTime.rate,
    'fraud_detection_rate': fraudDetectionRate.rate,
  };
}