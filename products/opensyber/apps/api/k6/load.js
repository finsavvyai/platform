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
    http_req_duration: ['p(95)<500', 'p(99)<2000'],
    http_req_failed: ['rate<0.01'],
  },
  scenarios: {
    health_check: {
      executor: 'ramping-vus',
      exec: 'healthCheck',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 5 },
        { duration: '3m', target: 5 },
        { duration: '2m', target: 25 },
        { duration: '3m', target: 25 },
        { duration: '2m', target: 50 },
        { duration: '5m', target: 50 },
        { duration: '2m', target: 0 },
      ],
    },
    instance_crud: {
      executor: 'ramping-vus',
      exec: 'instanceCrud',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 25 },
        { duration: '3m', target: 25 },
        { duration: '2m', target: 125 },
        { duration: '3m', target: 125 },
        { duration: '2m', target: 250 },
        { duration: '5m', target: 250 },
        { duration: '2m', target: 0 },
      ],
    },
    security_browse: {
      executor: 'ramping-vus',
      exec: 'securityBrowse',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 30 },
        { duration: '3m', target: 30 },
        { duration: '2m', target: 150 },
        { duration: '3m', target: 150 },
        { duration: '2m', target: 300 },
        { duration: '5m', target: 300 },
        { duration: '2m', target: 0 },
      ],
    },
    skill_browse: {
      executor: 'ramping-vus',
      exec: 'skillBrowse',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },
        { duration: '3m', target: 20 },
        { duration: '2m', target: 100 },
        { duration: '3m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '5m', target: 200 },
        { duration: '2m', target: 0 },
      ],
    },
    auth_flow: {
      executor: 'ramping-vus',
      exec: 'authFlow',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 10 },
        { duration: '3m', target: 10 },
        { duration: '2m', target: 50 },
        { duration: '3m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 0 },
      ],
    },
    mixed: {
      executor: 'ramping-vus',
      exec: 'mixedTraffic',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 10 },
        { duration: '3m', target: 10 },
        { duration: '2m', target: 50 },
        { duration: '3m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 0 },
      ],
    },
  },
};

export function healthCheck() {
  const res = http.get(`${BASE_URL}${ENDPOINTS.health}`, {
    headers: publicHeaders(),
  });
  checkPublic(res, 'health');
  sleep(0.5);
}

export function instanceCrud() {
  // List instances
  const listRes = http.get(`${BASE_URL}${ENDPOINTS.instances}`, {
    headers: defaultHeaders(),
  });
  checkOk(listRes, 'list-instances');

  // Create instance (POST)
  const createRes = http.post(
    `${BASE_URL}${ENDPOINTS.instances}`,
    randomInstancePayload(),
    { headers: defaultHeaders() },
  );
  checkOk(createRes, 'create-instance');

  sleep(1);
}

export function securityBrowse() {
  const dashRes = http.get(`${BASE_URL}${ENDPOINTS.securityDashboard}`, {
    headers: defaultHeaders(),
  });
  checkOk(dashRes, 'security-dashboard');

  const threatsRes = http.get(`${BASE_URL}${ENDPOINTS.threats}`, {
    headers: publicHeaders(),
  });
  checkPublic(threatsRes, 'threats');

  sleep(0.5);
}

export function skillBrowse() {
  const skillsRes = http.get(`${BASE_URL}${ENDPOINTS.skills}`, {
    headers: defaultHeaders(),
  });
  checkOk(skillsRes, 'skills');

  const marketRes = http.get(`${BASE_URL}${ENDPOINTS.marketplace}`, {
    headers: publicHeaders(),
  });
  checkPublic(marketRes, 'marketplace');

  sleep(0.5);
}

export function authFlow() {
  const userRes = http.get(`${BASE_URL}${ENDPOINTS.user}`, {
    headers: defaultHeaders(),
  });
  checkOk(userRes, 'user');
  sleep(1);
}

export function mixedTraffic() {
  const endpoint = pickRandom([...PUBLIC_ENDPOINTS, ...AUTH_ENDPOINTS]);
  const isAuth = AUTH_ENDPOINTS.includes(endpoint);
  const headers = isAuth ? defaultHeaders() : publicHeaders();

  const res = http.get(`${BASE_URL}${endpoint}`, { headers });

  if (isAuth) {
    checkOk(res, `mixed-${endpoint}`);
  } else {
    checkPublic(res, `mixed-${endpoint}`);
  }

  sleep(0.5);
}
