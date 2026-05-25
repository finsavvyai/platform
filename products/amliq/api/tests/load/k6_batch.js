import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '2m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API_KEY = __ENV.API_KEY || 'test-key';
const TENANT_ID = __ENV.TENANT_ID || 'tnt_testbatch001';

export default function () {
  const entities = [];
  for (let i = 0; i < 100; i++) {
    entities.push({ name: `Entity ${i}`, type: 'person' });
  }

  const res = http.post(
    `${BASE_URL}/api/v1/batch`,
    JSON.stringify({ entities: entities, format: 'json' }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'X-Tenant-ID': TENANT_ID,
      },
    }
  );

  check(res, {
    'batch accepted': (r) => r.status === 202,
    'has batch_id': (r) => r.json('data.batch_id') !== undefined,
  });

  sleep(1);
}
