import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '2m', target: 200 },
    { duration: '5m', target: 500 },
    { duration: '2m', target: 1000 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<50', 'p(99)<100'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API_KEY = __ENV.API_KEY || 'test-key';

const entities = [
  { name: 'John Smith', type: 'person' },
  { name: 'Acme Trading LLC', type: 'company' },
  { name: 'Mohammed Ahmed Al-Rashid', type: 'person' },
  { name: 'Global Finance Corp', type: 'company' },
  { name: 'Sergei Nikolaevich Ivanov', type: 'person' },
  { name: 'Chen Wei Technology Ltd', type: 'company' },
];

export default function () {
  const entity = entities[Math.floor(Math.random() * entities.length)];
  const payload = JSON.stringify({
    name: entity.name,
    type: entity.type,
  });

  const res = http.post(`${BASE_URL}/api/v1/screen`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
  });

  check(res, {
    'status 200': (r) => r.status === 200,
    'has results': (r) => {
      try { return r.json('results') !== undefined; }
      catch { return false; }
    },
    'p95 < 50ms': (r) => r.timings.duration < 50,
  });

  sleep(0.1);
}
