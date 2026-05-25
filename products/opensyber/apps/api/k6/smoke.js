import http from 'k6/http';
import { sleep } from 'k6';
import {
  BASE_URL,
  defaultHeaders,
  publicHeaders,
  checkOk,
  checkPublic,
  ENDPOINTS,
} from './helpers.js';

export const options = {
  vus: 10,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // Public endpoints
  const healthRes = http.get(`${BASE_URL}${ENDPOINTS.health}`, {
    headers: publicHeaders(),
  });
  checkPublic(healthRes, 'health');

  const threatsRes = http.get(`${BASE_URL}${ENDPOINTS.threats}`, {
    headers: publicHeaders(),
  });
  checkPublic(threatsRes, 'threats');

  const scoreRes = http.get(`${BASE_URL}${ENDPOINTS.score}`, {
    headers: publicHeaders(),
  });
  checkPublic(scoreRes, 'score');

  // Authenticated endpoints
  const userRes = http.get(`${BASE_URL}${ENDPOINTS.user}`, {
    headers: defaultHeaders(),
  });
  checkOk(userRes, 'user');

  const achieveRes = http.get(`${BASE_URL}${ENDPOINTS.achievements}`, {
    headers: publicHeaders(),
  });
  checkPublic(achieveRes, 'achievements');

  sleep(1);
}
