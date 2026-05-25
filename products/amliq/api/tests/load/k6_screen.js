import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '1m', target: 500 },
    { duration: '30s', target: 1000 },
    { duration: '1m', target: 1000 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<50'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API_KEY = __ENV.API_KEY || 'test-key';
const TENANT_ID = __ENV.TENANT_ID || 'tnt_testscreen01';

const names = [
  'John Doe', 'Mohammed Al-Rashid', 'Sergei Ivanov',
  'Chen Wei', 'Maria Garcia', 'Ahmed Hassan',
  'Yuki Tanaka', 'Boris Petrov', 'Kim Jong',
  'Hans Mueller', 'Pierre Dupont', 'Luigi Rossi',
];

export default function () {
  const name = names[Math.floor(Math.random() * names.length)];
  const payload = JSON.stringify({ name: name, type: 'person' });

  const res = http.post(`${BASE_URL}/api/v1/screen`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'X-Tenant-ID': TENANT_ID,
    },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has results': (r) => r.json('data') !== undefined,
    'latency < 50ms': (r) => r.timings.duration < 50,
  });

  sleep(0.1);
}
