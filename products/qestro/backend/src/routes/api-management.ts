import express from 'express';
import { apiManagementService } from '../services/APIManagementService';
import { authenticateToken as auth } from '../middleware/auth';

const router = express.Router();

// ==================== API Endpoints Management ====================

// Get all API endpoints for user
router.get('/endpoints', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { provider, isActive, tags } = req.query;
    
    const filters: any = { userId };
    if (provider) filters.provider = provider as string;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (tags) filters.tags = (tags as string).split(',');

    const endpoints = await apiManagementService.getAPIEndpoints(userId, filters);
    
    res.json({
      success: true,
      endpoints
    });
  } catch (error) {
    console.error('Failed to fetch API endpoints:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch API endpoints'
    });
  }
});

// Get specific API endpoint
router.get('/endpoints/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const endpoint = await apiManagementService.getAPIEndpoint(id);
    
    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'API endpoint not found'
      });
    }

    if (endpoint.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      endpoint
    });
  } catch (error) {
    console.error('Failed to fetch API endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch API endpoint'
    });
  }
});

// Create new API endpoint
router.post('/endpoints', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      name,
      description,
      baseUrl,
      version,
      authentication,
      headers,
      rateLimit,
      timeout,
      retryConfig,
      healthCheck,
      documentation,
      tags
    } = req.body;

    // Validate required fields
    if (!name || !baseUrl || !version) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, baseUrl, version'
      });
    }

    // Validate URL format
    try {
      new URL(baseUrl);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid base URL format'
      });
    }

    const endpoint = await apiManagementService.createAPIEndpoint({
      userId,
      name,
      description,
      baseUrl,
      version,
      authentication: authentication || { type: 'none', config: {} },
      headers: headers || {},
      rateLimit,
      timeout: timeout || 30000,
      retryConfig,
      healthCheck,
      documentation,
      tags: tags || [],
      isActive: true
    });

    res.status(201).json({
      success: true,
      endpoint
    });
  } catch (error) {
    console.error('Failed to create API endpoint:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create API endpoint'
    });
  }
});

// Update API endpoint
router.put('/endpoints/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Get existing endpoint to check ownership
    const existingEndpoint = await apiManagementService.getAPIEndpoint(id);
    if (!existingEndpoint) {
      return res.status(404).json({
        success: false,
        error: 'API endpoint not found'
      });
    }

    if (existingEndpoint.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.userId;
    delete updates.createdAt;

    const updatedEndpoint = await apiManagementService.updateAPIEndpoint(id, updates);

    res.json({
      success: true,
      endpoint: updatedEndpoint
    });
  } catch (error) {
    console.error('Failed to update API endpoint:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update API endpoint'
    });
  }
});

// Delete API endpoint
router.delete('/endpoints/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Get existing endpoint to check ownership
    const existingEndpoint = await apiManagementService.getAPIEndpoint(id);
    if (!existingEndpoint) {
      return res.status(404).json({
        success: false,
        error: 'API endpoint not found'
      });
    }

    if (existingEndpoint.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await apiManagementService.deleteAPIEndpoint(id);

    res.json({
      success: true,
      message: 'API endpoint deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete API endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete API endpoint'
    });
  }
});

// Test API endpoint connection
router.post('/endpoints/:id/test', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Get existing endpoint to check ownership
    const existingEndpoint = await apiManagementService.getAPIEndpoint(id);
    if (!existingEndpoint) {
      return res.status(404).json({
        success: false,
        error: 'API endpoint not found'
      });
    }

    if (existingEndpoint.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const result = await apiManagementService.testAPIConnection(id);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Failed to test API connection:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test connection'
    });
  }
});

// Make API call
router.post('/endpoints/:id/call', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      method,
      path,
      headers,
      queryParams,
      body,
      expectedResponse,
      validation,
      transformation
    } = req.body;

    // Get existing endpoint to check ownership
    const existingEndpoint = await apiManagementService.getAPIEndpoint(id);
    if (!existingEndpoint) {
      return res.status(404).json({
        success: false,
        error: 'API endpoint not found'
      });
    }

    if (existingEndpoint.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Validate required fields
    if (!method || !path) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: method, path'
      });
    }

    const apiCall = {
      id: Date.now().toString(),
      endpointId: id,
      method,
      path,
      headers,
      queryParams,
      body,
      expectedResponse,
      validation,
      transformation
    };

    const result = await apiManagementService.makeAPICall(existingEndpoint, apiCall);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Failed to make API call:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to make API call'
    });
  }
});

// ==================== Webhook Management ====================

// Get all webhooks for user
router.get('/webhooks', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { isActive, events } = req.query;
    
    const filters: any = { userId };
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (events) filters.events = (events as string).split(',');

    const webhooks = await apiManagementService.getWebhooks(userId, filters);
    
    res.json({
      success: true,
      webhooks
    });
  } catch (error) {
    console.error('Failed to fetch webhooks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch webhooks'
    });
  }
});

// Create new webhook
router.post('/webhooks', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      name,
      url,
      events,
      headers,
      authentication,
      retryPolicy,
      filters,
      transformation
    } = req.body;

    // Validate required fields
    if (!name || !url || !events || !Array.isArray(events)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, url, events (array)'
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }

    const webhook = await apiManagementService.createWebhook({
      userId,
      name,
      url,
      events,
      headers: headers || {},
      authentication,
      retryPolicy: retryPolicy || { attempts: 3, delay: 1000, exponentialBackoff: true },
      filters,
      transformation,
      isActive: true
    });

    res.status(201).json({
      success: true,
      webhook
    });
  } catch (error) {
    console.error('Failed to create webhook:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create webhook'
    });
  }
});

// Test webhook
router.post('/webhooks/:id/test', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { event, payload } = req.body;

    // Get existing webhook to check ownership
    const existingWebhook = await apiManagementService.getWebhook(id);
    if (!existingWebhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found'
      });
    }

    if (existingWebhook.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const result = await apiManagementService.triggerWebhook(
      id,
      event || 'test',
      payload || { test: true, timestamp: new Date().toISOString() }
    );

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Failed to test webhook:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test webhook'
    });
  }
});

// ==================== Integration Management ====================

// Get all integrations for user
router.get('/integrations', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { type, provider, isActive } = req.query;
    
    const filters: any = { userId };
    if (type) filters.type = type as string;
    if (provider) filters.provider = provider as string;
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    const integrations = await apiManagementService.getIntegrations(userId, filters);
    
    res.json({
      success: true,
      integrations
    });
  } catch (error) {
    console.error('Failed to fetch integrations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch integrations'
    });
  }
});

// Create new integration
router.post('/integrations', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      name,
      type,
      provider,
      config,
      dataMappings,
      errorHandling,
      monitoring
    } = req.body;

    // Validate required fields
    if (!name || !type || !provider || !config) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, type, provider, config'
      });
    }

    // Validate integration type
    const validTypes = ['webhook', 'polling', 'streaming', 'batch'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid integration type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    const integration = await apiManagementService.createIntegration({
      userId,
      name,
      type,
      provider,
      config,
      dataMappings: dataMappings || [],
      errorHandling: errorHandling || {
        retryPolicy: { attempts: 3, delay: 1000 },
        alertChannels: []
      },
      monitoring: monitoring || {
        healthCheckInterval: 300,
        performanceThresholds: {},
        alertConditions: []
      },
      isActive: true
    });

    res.status(201).json({
      success: true,
      integration
    });
  } catch (error) {
    console.error('Failed to create integration:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create integration'
    });
  }
});

// Sync integration
router.post('/integrations/:id/sync', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Get existing integration to check ownership
    const existingIntegration = await apiManagementService.getIntegration(id);
    if (!existingIntegration) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found'
      });
    }

    if (existingIntegration.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const result = await apiManagementService.syncIntegration(id);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Failed to sync integration:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync integration'
    });
  }
});

// ==================== API Templates and Discovery ====================

// Get API templates
router.get('/templates', auth, async (req, res) => {
  try {
    const { category, provider } = req.query;
    
    const templates = await apiManagementService.getAPITemplates({
      category: category as string,
      provider: provider as string
    });
    
    res.json({
      success: true,
      templates
    });
  } catch (error) {
    console.error('Failed to fetch API templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch API templates'
    });
  }
});

// Discover API from URL
router.post('/discover', auth, async (req, res) => {
  try {
    const { url, type } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }

    const discovery = await apiManagementService.discoverAPI(url, type);

    res.json({
      success: true,
      discovery
    });
  } catch (error) {
    console.error('Failed to discover API:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to discover API'
    });
  }
});

// ==================== API Documentation ====================

// Generate API documentation
router.post('/endpoints/:id/docs', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { format } = req.body;

    // Get existing endpoint to check ownership
    const existingEndpoint = await apiManagementService.getAPIEndpoint(id);
    if (!existingEndpoint) {
      return res.status(404).json({
        success: false,
        error: 'API endpoint not found'
      });
    }

    if (existingEndpoint.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const documentation = await apiManagementService.generateAPIDocumentation(
      id,
      format || 'openapi'
    );

    res.json({
      success: true,
      documentation
    });
  } catch (error) {
    console.error('Failed to generate API documentation:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate documentation'
    });
  }
});

// ==================== API Analytics ====================

// Get API analytics
router.get('/analytics', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { endpointId, timeRange, metrics } = req.query;
    
    const analytics = await apiManagementService.getAPIAnalytics(userId, {
      endpointId: endpointId as string,
      timeRange: timeRange as string || '7d',
      metrics: metrics ? (metrics as string).split(',') : undefined
    });
    
    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Failed to fetch API analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch API analytics'
    });
  }
});

// Get API health status
router.get('/health-status', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const healthStatus = await apiManagementService.getAPIHealthStatus(userId);
    
    res.json({
      success: true,
      healthStatus
    });
  } catch (error) {
    console.error('Failed to fetch API health status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch health status'
    });
  }
});

export default router;