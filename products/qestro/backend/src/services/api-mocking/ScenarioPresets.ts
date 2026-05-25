/**
 * Pre-built scenario presets
 * Happy path, errors, slow network, auth failures
 */

import { v4 as uuid } from 'uuid';
import { MockEndpoint } from './types.js';

export class ScenarioPresets {
  static getHappyPath(): MockEndpoint[] {
    return [
      {
        id: uuid(),
        method: 'GET',
        path: '/api/users',
        defaultResponse: {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: [
            { id: 1, name: 'Alice', email: 'alice@example.com' },
            { id: 2, name: 'Bob', email: 'bob@example.com' },
          ],
        },
        rules: [],
      },
      {
        id: uuid(),
        method: 'POST',
        path: '/api/users',
        defaultResponse: {
          statusCode: 201,
          body: { id: 3, name: 'Charlie', email: 'charlie@example.com', created: true },
        },
        rules: [],
      },
      {
        id: uuid(),
        method: 'GET',
        path: '/api/users/{id}',
        defaultResponse: { statusCode: 200, body: { id: 1, name: 'Alice', email: 'alice@example.com' } },
        rules: [],
      },
    ];
  }

  static getErrors(): MockEndpoint[] {
    return [
      {
        id: uuid(),
        method: 'GET',
        path: '/api/invalid',
        defaultResponse: { statusCode: 404, body: { error: 'Not Found', code: 'NOT_FOUND' } },
        rules: [],
      },
      {
        id: uuid(),
        method: 'POST',
        path: '/api/users',
        defaultResponse: { statusCode: 400, body: { error: 'Bad Request', details: 'Invalid email' } },
        rules: [
          {
            id: uuid(),
            conditions: [{ type: 'body', key: 'email', value: 'invalid', operator: 'contains' }],
            response: { statusCode: 400, body: { error: 'Invalid email format' } },
            priority: 10,
          },
        ],
      },
      {
        id: uuid(),
        method: 'GET',
        path: '/api/unauthorized',
        defaultResponse: { statusCode: 401, body: { error: 'Unauthorized', code: 'AUTH_REQUIRED' } },
        rules: [],
      },
      {
        id: uuid(),
        method: 'GET',
        path: '/api/forbidden',
        defaultResponse: { statusCode: 403, body: { error: 'Forbidden', code: 'INSUFFICIENT_PERMISSIONS' } },
        rules: [],
      },
      {
        id: uuid(),
        method: 'GET',
        path: '/api/server-error',
        defaultResponse: { statusCode: 500, body: { error: 'Internal Server Error', code: 'SERVER_ERROR' } },
        rules: [],
      },
    ];
  }

  static getSlowNetwork(): MockEndpoint[] {
    return [
      {
        id: uuid(),
        method: 'GET',
        path: '/api/users',
        defaultResponse: { statusCode: 200, body: [{ id: 1, name: 'Alice' }], delay: 5000 },
        rules: [],
      },
      {
        id: uuid(),
        method: 'POST',
        path: '/api/users',
        defaultResponse: { statusCode: 201, body: { id: 3, name: 'Charlie', created: true }, delay: 3000 },
        rules: [],
      },
      {
        id: uuid(),
        method: 'GET',
        path: '/api/data',
        defaultResponse: { statusCode: 200, body: { data: 'slow response' }, delay: 10000 },
        rules: [],
      },
    ];
  }

  static getAuthFailure(): MockEndpoint[] {
    return [
      {
        id: uuid(),
        method: 'POST',
        path: '/api/login',
        defaultResponse: { statusCode: 401, body: { error: 'Invalid credentials' } },
        rules: [
          {
            id: uuid(),
            conditions: [
              { type: 'body', key: 'username', value: 'admin', operator: 'equals' },
              { type: 'body', key: 'password', value: 'admin123', operator: 'equals' },
            ],
            response: { statusCode: 200, body: { token: 'valid-token', user: { id: 1, name: 'Admin' } } },
            priority: 10,
          },
        ],
      },
      {
        id: uuid(),
        method: 'GET',
        path: '/api/protected',
        defaultResponse: { statusCode: 401, body: { error: 'Missing or invalid token' } },
        rules: [
          {
            id: uuid(),
            conditions: [{ type: 'header', key: 'Authorization', value: 'Bearer', operator: 'contains' }],
            response: { statusCode: 200, body: { data: 'protected data' } },
            priority: 10,
          },
        ],
      },
      {
        id: uuid(),
        method: 'POST',
        path: '/api/logout',
        defaultResponse: { statusCode: 200, body: { message: 'Logged out successfully' } },
        rules: [],
      },
    ];
  }
}
