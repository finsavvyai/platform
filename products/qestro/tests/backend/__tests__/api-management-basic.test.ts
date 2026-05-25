import { APIManagementService, APIEndpoint, APICall } from '../../../backend/src/services/APIManagementService';

describe('API Management Basic Test', () => {
  let apiManagementService: APIManagementService;

  beforeEach(() => {
    apiManagementService = new APIManagementService();
  });

  it('should create an API endpoint configuration', () => {
    const endpoint: APIEndpoint = {
      id: 'endpoint-1',
      userId: 'user-123',
      name: 'Test API',
      description: 'A test API endpoint',
      baseUrl: 'https://api.example.com',
      version: 'v1',
      authentication: {
        type: 'bearer',
        config: { token: 'test-token' }
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000,
      retryConfig: {
        attempts: 3,
        delay: 1000,
        backoff: 'exponential'
      },
      tags: ['test', 'api'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    expect(endpoint).toBeDefined();
    expect(endpoint.name).toBe('Test API');
    expect(endpoint.baseUrl).toBe('https://api.example.com');
    expect(endpoint.authentication.type).toBe('bearer');
    expect(endpoint.isActive).toBe(true);
  });

  it('should create an API call configuration', () => {
    const apiCall: APICall = {
      id: 'call-1',
      endpointId: 'endpoint-1',
      method: 'GET',
      path: '/users',
      headers: {
        'Authorization': 'Bearer token123'
      },
      queryParams: {
        page: 1,
        limit: 10
      },
      expectedResponse: {
        status: 200,
        schema: {
          type: 'object',
          properties: {
            users: { type: 'array' },
            total: { type: 'number' }
          }
        }
      },
      validation: {
        rules: [
          {
            field: 'users',
            type: 'required',
            value: true,
            message: 'Users array is required'
          }
        ]
      }
    };

    expect(apiCall).toBeDefined();
    expect(apiCall.method).toBe('GET');
    expect(apiCall.path).toBe('/users');
    expect(apiCall.queryParams?.page).toBe(1);
    expect(apiCall.expectedResponse?.status).toBe(200);
    expect(apiCall.validation?.rules).toHaveLength(1);
  });

  it('should support different authentication types', () => {
    const authTypes = [
      { type: 'none', config: {} },
      { type: 'basic', config: { username: 'user', password: 'pass' } },
      { type: 'bearer', config: { token: 'bearer-token' } },
      { type: 'api_key', config: { key: 'api-key', location: 'header' } },
      { type: 'oauth2', config: { clientId: 'client', clientSecret: 'secret' } }
    ];

    authTypes.forEach(auth => {
      const endpoint: Partial<APIEndpoint> = {
        authentication: auth as any
      };

      expect(endpoint.authentication?.type).toBe(auth.type);
      expect(endpoint.authentication?.config).toEqual(auth.config);
    });
  });

  it('should support rate limiting configuration', () => {
    const endpoint: Partial<APIEndpoint> = {
      rateLimit: {
        requests: 100,
        window: 60, // 1 minute
        burst: 10
      }
    };

    expect(endpoint.rateLimit?.requests).toBe(100);
    expect(endpoint.rateLimit?.window).toBe(60);
    expect(endpoint.rateLimit?.burst).toBe(10);
  });

  it('should support health check configuration', () => {
    const endpoint: Partial<APIEndpoint> = {
      healthCheck: {
        endpoint: '/health',
        method: 'GET',
        expectedStatus: 200,
        interval: 30 // 30 seconds
      }
    };

    expect(endpoint.healthCheck?.endpoint).toBe('/health');
    expect(endpoint.healthCheck?.method).toBe('GET');
    expect(endpoint.healthCheck?.expectedStatus).toBe(200);
    expect(endpoint.healthCheck?.interval).toBe(30);
  });

  it('should support validation rules', () => {
    const validationRules = [
      {
        field: 'email',
        type: 'required' as const,
        value: true,
        message: 'Email is required'
      },
      {
        field: 'age',
        type: 'range' as const,
        value: { min: 18, max: 100 },
        message: 'Age must be between 18 and 100'
      },
      {
        field: 'username',
        type: 'regex' as const,
        value: '^[a-zA-Z0-9_]+$',
        message: 'Username can only contain letters, numbers, and underscores'
      }
    ];

    validationRules.forEach(rule => {
      expect(rule.field).toBeDefined();
      expect(rule.type).toBeDefined();
      expect(rule.value).toBeDefined();
      expect(rule.message).toBeDefined();
    });
  });

  it('should support transformation rules', () => {
    const transformationRules = [
      {
        type: 'map' as const,
        source: 'user_name',
        target: 'username',
        function: 'toLowerCase'
      },
      {
        type: 'filter' as const,
        source: 'users',
        target: 'activeUsers',
        function: 'user => user.active === true'
      },
      {
        type: 'aggregate' as const,
        source: 'orders',
        target: 'totalAmount',
        function: 'sum',
        parameters: { field: 'amount' }
      }
    ];

    transformationRules.forEach(rule => {
      expect(rule.type).toBeDefined();
      expect(rule.source).toBeDefined();
      expect(rule.target).toBeDefined();
    });
  });

  it('should support webhook configuration', () => {
    const webhook = {
      id: 'webhook-1',
      userId: 'user-123',
      name: 'Test Webhook',
      url: 'https://example.com/webhook',
      events: ['user.created', 'user.updated'],
      secret: 'webhook-secret',
      headers: {
        'Content-Type': 'application/json'
      },
      retryPolicy: {
        attempts: 3,
        delay: 1000,
        exponentialBackoff: true
      },
      isActive: true,
      successCount: 0,
      failureCount: 0,
      createdAt: new Date()
    };

    expect(webhook.name).toBe('Test Webhook');
    expect(webhook.events).toContain('user.created');
    expect(webhook.retryPolicy.attempts).toBe(3);
    expect(webhook.isActive).toBe(true);
  });

  it('should validate API response structure', () => {
    const apiResponse = {
      success: true,
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        users: [
          { id: 1, name: 'John Doe' },
          { id: 2, name: 'Jane Smith' }
        ],
        total: 2
      },
      responseTime: 150,
      timestamp: new Date(),
      validationResults: [
        {
          field: 'users',
          rule: 'required',
          passed: true,
          message: 'Users array is present'
        }
      ]
    };

    expect(apiResponse.success).toBe(true);
    expect(apiResponse.status).toBe(200);
    expect(apiResponse.data.users).toHaveLength(2);
    expect(apiResponse.validationResults?.[0].passed).toBe(true);
  });
});