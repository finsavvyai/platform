import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 200 },
    { duration: '1m', target: 1000 },
    { duration: '2m', target: 1000 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<10', 'p(99)<25'],
    http_req_failed: ['rate<0.001'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API_KEY = __ENV.API_KEY || 'test-key';

const names = [
  'John Doe', 'Mohammed Al-Rashid', 'Sergei Ivanov',
  'Chen Wei', 'Maria Garcia', 'Ahmed Hassan',
  'Yuki Tanaka', 'Boris Petrov', 'Kim Jong Un',
  'Hans Mueller', 'Pierre Dupont', 'Vladimir Putin',
  'Ali Khamenei', 'Nicolas Maduro', 'Bashar al-Assad',
];

export default function () {
  const name = names[Math.floor(Math.random() * names.length)];
  const payload = JSON.stringify({ name });

  const res = http.post(`${BASE_URL}/api/v1/screen/fast`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
  });

  check(res, {
    'status 200': (r) => r.status === 200,
    'has match field': (r) => r.json('match') !== undefined,
    'p95 < 10ms': (r) => r.timings.duration < 10,
  });

  sleep(0.05);
}
