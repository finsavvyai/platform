// @ts-nocheck
/**
 * Default test case data for the Policy Test Panel
 */

import { TestCase } from './types';

export function createDefaultTestCases(): TestCase[] {
  return [
    {
      id: '1',
      name: 'Valid User Access',
      description: 'Test with authenticated user with proper permissions',
      input: {
        user: {
          id: 'user123',
          authenticated: true,
          mfa_verified: true,
          roles: ['admin', 'user'],
          permissions: ['read', 'write']
        },
        resource: {
          id: 'resource456',
          type: 'document',
          classification: 'internal'
        },
        context: {
          action: 'read',
          ip_address: '192.168.1.1',
          timestamp: new Date().toISOString()
        }
      },
      expectedOutput: {
        allow: true,
        reason: 'User has required permissions'
      },
      status: 'idle'
    },
    {
      id: '2',
      name: 'Unauthenticated Access',
      description: 'Test with unauthenticated user',
      input: {
        user: {
          id: 'guest',
          authenticated: false,
          roles: [],
          permissions: []
        },
        resource: {
          id: 'resource456',
          type: 'document',
          classification: 'internal'
        },
        context: {
          action: 'read',
          ip_address: '192.168.1.1',
          timestamp: new Date().toISOString()
        }
      },
      expectedOutput: {
        allow: false,
        reason: 'User is not authenticated'
      },
      status: 'idle'
    },
    {
      id: '3',
      name: 'Insufficient Permissions',
      description: 'Test with authenticated user lacking required permissions',
      input: {
        user: {
          id: 'user789',
          authenticated: true,
          mfa_verified: false,
          roles: ['readonly'],
          permissions: ['read']
        },
        resource: {
          id: 'resource789',
          type: 'document',
          classification: 'confidential'
        },
        context: {
          action: 'write',
          ip_address: '192.168.1.1',
          timestamp: new Date().toISOString()
        }
      },
      expectedOutput: {
        allow: false,
        reason: 'Insufficient permissions for confidential data'
      },
      status: 'idle'
    }
  ];
}
