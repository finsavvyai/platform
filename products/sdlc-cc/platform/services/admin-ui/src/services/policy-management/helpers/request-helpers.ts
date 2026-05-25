// @ts-nocheck
/**
 * Request helper methods for Policy Management Service
 */

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function getChanges(current: any, updates: any): Record<string, any> {
  const changes: Record<string, any> = {};
  for (const key in updates) {
    if (JSON.stringify(current[key]) !== JSON.stringify(updates[key])) {
      changes[key] = { from: current[key], to: updates[key] };
    }
  }
  return changes;
}

export function handleApiError(error: any, defaultMessage: string): Error {
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;

    switch (status) {
      case 400: return new Error(data.message || 'Invalid request data');
      case 401: return new Error('Authentication required');
      case 403: return new Error('Insufficient permissions');
      case 404: return new Error('Policy not found');
      case 409: return new Error(data.message || 'Policy conflict detected');
      case 422: return new Error(data.message || 'Validation failed');
      case 429: return new Error('Too many requests. Please try again later');
      case 500: return new Error('Internal server error');
      default: return new Error(data.message || defaultMessage);
    }
  }
  return new Error(defaultMessage);
}

export function auditLog(action: string, details: Record<string, any>) {
  console.log('AUDIT:', {
    timestamp: new Date().toISOString(),
    action,
    service: 'policy-management',
    ...details
  });
}
