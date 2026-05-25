import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const BASE_URL = __ENV.API_URL || 'http://localhost:8787'
const AUTH_TOKEN = __ENV.AUTH_TOKEN || ''

// Custom metrics
const errorRate = new Rate('errors')
const aiLatency = new Trend('ai_latency')

export const options = {
  scenarios: {
    // Scenario 1: Normal API traffic
    api_traffic: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 100 },
        { duration: '1m', target: 100 },
        { duration: '30s', target: 0 },
      ],
    },
    // Scenario 2: AI endpoint stress test
    ai_stress: {
      executor: 'constant-arrival-rate',
      rate: 10,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 20,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    errors: ['rate<0.05'],
    ai_latency: ['p(95)<10000'],
  },
}

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${AUTH_TOKEN}`,
}

export default function () {
  // Health check
  const health = http.get(`${BASE_URL}/health`)
  check(health, { 'health 200': (r) => r.status === 200 })

  // Tenant list
  const tenants = http.get(`${BASE_URL}/api/tenants`, { headers })
  check(tenants, { 'tenants 200': (r) => r.status === 200 })
  errorRate.add(tenants.status !== 200)

  sleep(1)
}

export function ai_stress() {
  const start = Date.now()
  const res = http.post(
    `${BASE_URL}/api/ai/ask/test-tenant`,
    JSON.stringify({
      question: 'How many licenses do we have?',
      agent: '365-security',
    }),
    { headers }
  )
  aiLatency.add(Date.now() - start)
  check(res, {
    'ai 200': (r) => r.status === 200 || r.status === 401,
  })
  errorRate.add(res.status >= 500)
}
