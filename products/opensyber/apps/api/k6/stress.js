import http from 'k6/http';
import { sleep } from 'k6';
import {
  BASE_URL,
  defaultHeaders,
  publicHeaders,
  checkOk,
  checkPublic,
  ENDPOINTS,
  pickRandom,
  PUBLIC_ENDPOINTS,
  AUTH_ENDPOINTS,
  randomInstancePayload,
} from './helpers.js';

export const options = {
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
  stages: [
    { duration: '2m', target: 500 },
    { duration: '3m', target: 1500 },
    { duration: '5m', target: 1500 },
    { duration: '2m', target: 2000 },
    { duration: '3m', target: 2000 },
    { duration: '2m', target: 0 },
  ],
};

export default function () {
  const roll = Math.random();

  if (roll < 0.05) {
    // 5% — health check
    const res = http.get(`${BASE_URL}${ENDPOINTS.health}`, {
      headers: publicHeaders(),
    });
    checkPublic(res, 'stress-health');
  } else if (roll < 0.30) {
    // 25% — instance operations
    const listRes = http.get(`${BASE_URL}${ENDPOINTS.instances}`, {
      headers: defaultHeaders(),
    });
    checkOk(listRes, 'stress-list-instances');

    if (Math.random() < 0.3) {
      const createRes = http.post(
        `${BASE_URL}${ENDPOINTS.instances}`,
        randomInstancePayload(),
        { headers: defaultHeaders() },
      );
      checkOk(createRes, 'stress-create-instance');
    }
  } else if (roll < 0.60) {
    // 30% — security browsing
    const dashRes = http.get(`${BASE_URL}${ENDPOINTS.securityDashboard}`, {
      headers: defaultHeaders(),
    });
    checkOk(dashRes, 'stress-security');

    const threatsRes = http.get(`${BASE_URL}${ENDPOINTS.threats}`, {
      headers: publicHeaders(),
    });
    checkPublic(threatsRes, 'stress-threats');
  } else if (roll < 0.80) {
    // 20% — skill browsing
    const skillsRes = http.get(`${BASE_URL}${ENDPOINTS.skills}`, {
      headers: defaultHeaders(),
    });
    checkOk(skillsRes, 'stress-skills');

    const marketRes = http.get(`${BASE_URL}${ENDPOINTS.marketplace}`, {
      headers: publicHeaders(),
    });
    checkPublic(marketRes, 'stress-marketplace');
  } else {
    // 20% — mixed auth + public
    const endpoint = pickRandom([...PUBLIC_ENDPOINTS, ...AUTH_ENDPOINTS]);
    const isAuth = AUTH_ENDPOINTS.includes(endpoint);
    const headers = isAuth ? defaultHeaders() : publicHeaders();
    const res = http.get(`${BASE_URL}${endpoint}`, { headers });

    if (isAuth) {
      checkOk(res, `stress-mixed-${endpoint}`);
    } else {
      checkPublic(res, `stress-mixed-${endpoint}`);
    }
  }

  sleep(0.3);
}
