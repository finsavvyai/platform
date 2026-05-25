import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

// Test configuration
export const options = {
    stages: [
        { duration: '1m', target: 20 },   // Ramp up to 20 users
        { duration: '3m', target: 20 },   // Stay at 20 users
        { duration: '2m', target: 50 },   // Ramp up to 50 users
        { duration: '3m', target: 50 },   // Stay at 50 users
        { duration: '1m', target: 100 },  // Spike to 100 users
        { duration: '2m', target: 100 },  // Stay at 100 users
        { duration: '2m', target: 0 },    // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% under 500ms, 99% under 1s
        errors: ['rate<0.05'],                          // Error rate under 5%
        response_time: ['p(95)<500'],
    },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:8080';

// Shared test data
let authToken = null;

export function setup() {
    // Login to get auth token
    const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
        email: 'loadtest@example.com',
        password: 'testpassword123',
    }), {
        headers: { 'Content-Type': 'application/json' },
    });

    if (loginRes.status === 200) {
        const body = JSON.parse(loginRes.body);
        return { token: body.access_token };
    }

    console.log('Login failed, running tests without auth');
    return { token: null };
}

export default function (data) {
    const headers = {
        'Content-Type': 'application/json',
    };

    if (data.token) {
        headers['Authorization'] = `Bearer ${data.token}`;
    }

    // Test 1: Health check (should be fast)
    const healthRes = http.get(`${BASE_URL}/health`);
    check(healthRes, {
        'health check status is 200': (r) => r.status === 200,
        'health check response time < 100ms': (r) => r.timings.duration < 100,
    });
    errorRate.add(healthRes.status !== 200);
    responseTime.add(healthRes.timings.duration);

    sleep(0.5);

    // Test 2: Ready check
    const readyRes = http.get(`${BASE_URL}/health/ready`);
    check(readyRes, {
        'ready check status is 200': (r) => r.status === 200,
    });
    errorRate.add(readyRes.status !== 200);
    responseTime.add(readyRes.timings.duration);

    sleep(0.5);

    // Test 3: List connectors
    const connectorsRes = http.get(`${BASE_URL}/api/v1/connectors`, { headers });
    check(connectorsRes, {
        'list connectors status is 200': (r) => r.status === 200,
        'list connectors response time < 500ms': (r) => r.timings.duration < 500,
    });
    errorRate.add(connectorsRes.status !== 200 && connectorsRes.status !== 401);
    responseTime.add(connectorsRes.timings.duration);

    sleep(1);

    // Test 4: Metrics endpoint
    const metricsRes = http.get(`${BASE_URL}/metrics`);
    check(metricsRes, {
        'metrics endpoint status is 200': (r) => r.status === 200,
        'metrics contains http_requests_total': (r) => r.body.includes('http_requests_total'),
    });

    sleep(0.5);
}

export function teardown(data) {
    console.log('Load test completed');
}
