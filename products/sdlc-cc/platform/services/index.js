/**
 * LAM Services Entry Point
 * Main entry point for LAM system on Cloudflare Workers
 */

import { LAMSystem } from './lam-system.js';

// Initialize global LAM system instance
let lamSystem = null;

/**
 * Main Cloudflare Worker handler
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
        },
      });
    }

    try {
      // Initialize LAM system if not already done
      if (!lamSystem) {
        lamSystem = new LAMSystem({
          environment: env.ENVIRONMENT || 'development',
          debug: env.DEBUG === 'true',
          services: {
            coreIntelligence: true,
            knowledgeBase: true,
            feedbackLoop: true,
            patternSharing: env.SHARING_MODE !== 'disabled',
            monitoring: true
          },
          agents: {
            policyLearner: env.POLICY_LEARNER !== 'disabled',
            riskAssessor: env.RISK_ASSESSOR !== 'disabled',
            providerRouter: env.PROVIDER_ROUTER !== 'disabled'
          }
        });

        await lamSystem.initialize(env);
        console.log('✅ LAM System initialized in Cloudflare Worker');
      }

      // Route requests
      if (path.startsWith('/api/v1/lam/')) {
        return await handleLAMRequest(request, env, url, method);
      }

      if (path.startsWith('/api/v1/health')) {
        return await handleHealthCheck(request, env);
      }

      if (path.startsWith('/api/v1/stats')) {
        return await handleStats(request, env);
      }

      if (path.startsWith('/api/v1/dashboard')) {
        return await handleDashboard(request, env);
      }

      // Default: process through LAM system
      return await processThroughLAM(request, env, ctx);

    } catch (error) {
      console.error('LAM Worker error:', error);
      return new Response(JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};

/**
 * Handle LAM-specific API requests
 */
async function handleLAMRequest(request, env, url, method) {
  const path = url.pathname.replace('/api/v1/lam/', '');

  switch (path) {
    case 'process':
      if (method === 'POST') {
        return await processThroughLAM(request, env);
      }
      break;

    case 'analyze':
      if (method === 'POST') {
        return await analyzeRequest(request, env);
      }
      break;

    case 'learn':
      if (method === 'POST') {
        return await triggerLearning(request, env);
      }
      break;

    case 'patterns':
      if (method === 'GET') {
        return await getPatterns(request, env);
      }
      break;

    case 'share':
      if (method === 'POST') {
        return await sharePatterns(request, env);
      }
      break;

    default:
      return new Response(JSON.stringify({
        error: 'LAM endpoint not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
  }
}

/**
 * Process request through LAM system
 */
async function processThroughLAM(request, env, ctx) {
  try {
    const body = await request.json();
    const { request: lamRequest, context = {} } = body;

    if (!lamRequest) {
      return new Response(JSON.stringify({
        error: 'Missing request object in body'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Add request metadata
    const enhancedContext = {
      ...context,
      userAgent: request.headers.get('User-Agent'),
      ipAddress: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For'),
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID()
    };

    // Process through LAM system
    const result = await lamSystem.processRequest(lamRequest, enhancedContext);

    return new Response(JSON.stringify({
      success: true,
      ...result
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('LAM processing error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

/**
 * Analyze request without processing
 */
async function analyzeRequest(request, env) {
  try {
    const body = await request.json();
    const { request: lamRequest, context = {} } = body;

    // Get core intelligence service
    const coreService = lamSystem.state.services.get('coreIntelligence');
    if (!coreService) {
      throw new Error('Core intelligence service not available');
    }

    // Run analysis only
    const analysis = await coreService.runAgentAnalysis(lamRequest, context);

    return new Response(JSON.stringify({
      success: true,
      analysis,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Trigger learning cycle
 */
async function triggerLearning(request, env) {
  try {
    const feedbackLoop = lamSystem.state.services.get('feedbackLoop');
    if (!feedbackLoop) {
      throw new Error('Feedback loop service not available');
    }

    const cycle = await feedbackLoop.runLearningCycle();

    return new Response(JSON.stringify({
      success: true,
      cycle,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get learned patterns
 */
async function getPatterns(request, env) {
  try {
    const knowledgeBase = lamSystem.state.services.get('knowledgeBase');
    if (!knowledgeBase) {
      throw new Error('Knowledge base service not available');
    }

    const stats = knowledgeBase.getStatistics();

    return new Response(JSON.stringify({
      success: true,
      patterns: stats,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Share patterns across products
 */
async function sharePatterns(request, env) {
  try {
    const body = await request.json();
    const { sourceProduct, patterns } = body;

    const patternSharing = lamSystem.state.services.get('patternSharing');
    if (!patternSharing) {
      throw new Error('Pattern sharing service not available');
    }

    const result = await patternSharing.sharePatterns(sourceProduct, patterns);

    return new Response(JSON.stringify({
      success: true,
      result,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle health check
 */
async function handleHealthCheck(request, env) {
  try {
    const health = await lamSystem.getHealthStatus();

    return new Response(JSON.stringify({
      status: 'ok',
      health,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      status: 'error',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle statistics request
 */
async function handleStats(request, env) {
  try {
    const stats = lamSystem.getStatistics();

    return new Response(JSON.stringify({
      success: true,
      statistics: stats,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle dashboard request
 */
async function handleDashboard(request, env) {
  try {
    const monitoring = lamSystem.state.services.get('monitoring');
    if (!monitoring) {
      throw new Error('Monitoring service not available');
    }

    const dashboardData = await monitoring.getDashboardData();

    return new Response(JSON.stringify({
      success: true,
      dashboard: dashboardData
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}