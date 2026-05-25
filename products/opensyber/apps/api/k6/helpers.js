import http from 'k6/http';
import { check } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8787';
export const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'load-test-token';

export function defaultHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${AUTH_TOKEN}`,
  };
}

export function publicHeaders() {
  return { 'Content-Type': 'application/json' };
}

export const ENDPOINTS = {
  health: '/health',
  instances: '/api/instances',
  skills: '/api/skills',
  securityDashboard: '/api/security/instances',
  threats: '/api/threats',
  score: '/api/score',
  user: '/api/user',
  achievements: '/api/achievements',
  marketplace: '/api/marketplace/skills',
};

export function checkOk(res, name) {
  check(res, {
    [`${name} status 200-299`]: (r) => r.status >= 200 && r.status < 300,
    [`${name} response time < 2s`]: (r) => r.timings.duration < 2000,
  });
}

export function checkPublic(res, name) {
  check(res, {
    [`${name} status ok`]: (r) => r.status >= 200 && r.status < 400,
    [`${name} response time < 1s`]: (r) => r.timings.duration < 1000,
  });
}

export function randomInstancePayload() {
  const id = Math.random().toString(36).substring(7);
  return JSON.stringify({
    name: `load-test-${id}`,
    region: 'us-east',
  });
}

export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const PUBLIC_ENDPOINTS = [
  ENDPOINTS.health,
  ENDPOINTS.threats,
  ENDPOINTS.score,
  ENDPOINTS.achievements,
  ENDPOINTS.marketplace,
];

export const AUTH_ENDPOINTS = [
  ENDPOINTS.user,
  ENDPOINTS.instances,
  ENDPOINTS.skills,
  ENDPOINTS.securityDashboard,
];
