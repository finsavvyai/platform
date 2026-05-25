import { RAGController } from './rag-controller.js';
import { TeamController } from './team-controller.js';
import { SharedWorkspaceController } from './shared-workspace-controller.js';
import { TeamAnalyticsController } from './team-analytics-controller.js';
import { RealtimeAnalyticsController } from './realtime-analytics-controller.js';
import { DatabasePerformanceController } from './database-performance-controller.js';
import CachingMiddleware from './caching-middleware.js';
import CacheManager from './cache-manager.js';
import RateLimiter from './rate-limiter.js';
import { AuthService } from './auth.js';
import { DatabaseService } from './database.js';

export default {
  async fetch(request, env, ctx) {
    const ragController = new RAGController(env);
    const teamController = new TeamController(env);
    const sharedWorkspaceController = new SharedWorkspaceController(env);
    const analyticsController = new TeamAnalyticsController(env);
    const realtimeAnalytics = new RealtimeAnalyticsController(env);
    const performanceController = new DatabasePerformanceController(env);
    const cachingMiddleware = new CachingMiddleware(env);
    const rateLimiter = new RateLimiter(env);
    const authService = new AuthService(env);

    try {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 200,
          headers: getCorsHeaders()
        });
      }

      // Parse URL and route request
      const url = new URL(request.url);
      const pathParts = url.pathname.replace(/^\/+/, '').split('/');

      console.log(`${request.method} ${url.pathname}`);

      // Health check endpoint (bypass rate limiting)
      if (url.pathname === '/health') {
        return await handleHealthCheck(env);
      }

      // Apply IP-based rate limiting first (DDoS protection)
      const ipRateLimit = await rateLimiter.checkIpRateLimit(request);
      if (!ipRateLimit.allowed) {
        console.warn('IP rate limit exceeded:', request.headers.get('CF-Connecting-IP'));
        return rateLimiter.createRateLimitResponse(ipRateLimit);
      }

      // Extract authentication info
      const authInfo = authService.extractAuthInfo(request);
      let userId = null;
      let userTier = 'free';

      // Apply user/API key rate limiting for authenticated requests
      if (authInfo) {
        if (authInfo.type === 'api_key') {
          // TODO: Get user from API key and apply API key rate limiting
          const apiKeyRateLimit = await rateLimiter.checkApiKeyRateLimit(authInfo.token, userTier);
          if (!apiKeyRateLimit.allowed) {
            return rateLimiter.createRateLimitResponse(apiKeyRateLimit);
          }
        } else if (authInfo.type === 'jwt') {
          try {
            const payload = await authService.verifyJWT(authInfo.token);
            userId = payload.userId;
            userTier = payload.tier || 'free';

            const userRateLimit = await rateLimiter.checkUserRateLimit(userId, userTier);
            if (!userRateLimit.allowed) {
              return rateLimiter.createRateLimitResponse(userRateLimit);
            }
          } catch (error) {
            // Invalid JWT - will be handled by endpoint
          }
        }
      }

      // Apply caching middleware before routing
      const cachedResponse = await applyCachingMiddleware(request, env, ctx, cachingMiddleware);
      if (cachedResponse) {
        // Add rate limit headers to cached response
        const headers = new Headers(cachedResponse.headers);
        Object.entries(rateLimiter.getRateLimitHeaders(ipRateLimit)).forEach(([key, value]) => {
          headers.set(key, value);
        });

        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          headers
        });
      }

      // Route to appropriate handler
      let result;

      switch (request.method) {
        case 'GET':
          result = await handleGetRequest(pathParts, url, request, env, ragController, teamController, sharedWorkspaceController, analyticsController, performanceController);
          break;

        case 'POST':
          result = await handlePostRequest(pathParts, request, env, ragController, teamController, sharedWorkspaceController, analyticsController, performanceController);
          break;

        default:
          result = {
            success: false,
            error: 'Method not allowed',
            error_code: 'method_not_allowed'
          };
        break;
      }

      // Apply post-request caching middleware
      const finalResponse = new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: {
          ...getCorsHeaders(),
          'Content-Type': 'application/json'
        }
      });

      await applyPostCachingMiddleware(finalResponse, request, env, ctx, cachingMiddleware);

      // Apply cache invalidation for modifying requests
      await applyCacheInvalidation(request, env, ctx, cachingMiddleware);

      return finalResponse;

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Internal server error',
        error_code: 'internal_error'
      }), {
        status: 500,
        headers: {
          ...getCorsHeaders(),
          'Content-Type': 'application/json'
        }
      });
    }
  },

  async scheduled(event, env, ctx) {
    const cacheManager = new CacheManager(env);

    switch (event.cron) {
      case '0 */15 * * *': // Every 15 minutes
        console.log('Running 15-minute cache optimization');
        await cacheManager.optimizeCache();
        break;

      case '0 0 * * *': // Daily at midnight
        console.log('Running daily cache maintenance');
        await cacheManager.cleanupCache();
        await cacheManager.warmupCache();
        break;

      case '0 2 * * 0': // Weekly on Sunday at 2 AM
        console.log('Running weekly cache deep clean');
        await cacheManager.cleanupCache();
        await cacheManager.optimizeCache();

        // Generate health report
        const healthReport = await cacheManager.getHealthReport();
        console.log('Cache health report:', JSON.stringify(healthReport, null, 2));
        break;

      default:
        console.log(`Unknown scheduled task: ${event.cron}`);
    }

    // Run daily/weekly tasks
    // P1-3 FIX: Use Promise.allSettled instead of Promise.all
    // to prevent one failure from crashing all tasks
    const taskResults = await Promise.allSettled([
      handleDailyTasks(env).catch(err => {
        console.error('Daily task failed:', err);
        // Send alert to monitoring system if available
        return { error: err.message };
      }),
      handleWeeklyTasks(env).catch(err => {
        console.error('Weekly task failed:', err);
        return { error: err.message };
      })
    ]);

    // Log results for monitoring
    const failures = taskResults.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      console.error('Some scheduled tasks failed:', failures);
    }
  }
};

// Queue handler for email processing with retry logic
// P1-4 FIX: Implement retry mechanism and dead letter queue
async function queueHandler(batch, env) {
  console.log('Processing email queue batch:', batch.messages.length);

  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [60, 300, 900]; // 1min, 5min, 15min

  for (const message of batch.messages) {
    const retryCount = message.attempts || 0;

    try {
      const { type, data } = JSON.parse(message.body);

      // Process email based on type
      await processEmail(type, data, env);

      // Acknowledge successful processing
      await message.ack();
      console.log(`Email processed successfully: ${type}`);

    } catch (error) {
      console.error(`Email processing error (attempt ${retryCount + 1}):`, error);

      // Retry up to MAX_RETRIES times
      if (retryCount < MAX_RETRIES) {
        const delaySeconds = RETRY_DELAYS[retryCount];
        console.log(`Retrying email in ${delaySeconds} seconds (attempt ${retryCount + 1}/${MAX_RETRIES})`);

        await message.retry({ delaySeconds });
      } else {
        // Max retries exceeded - move to dead letter queue
        console.error(`Max retries exceeded for email. Moving to dead letter queue.`);

        try {
          // Store in database for manual review
          const deadLetterEntry = {
            message_body: message.body,
            error: error.message,
            retry_count: retryCount,
            failed_at: new Date().toISOString()
          };

          // You could store this in a dead_letter_queue table
          // For now, log it for monitoring
          console.error('DEAD LETTER QUEUE:', JSON.stringify(deadLetterEntry));

          // Acknowledge to prevent infinite loop
          await message.ack();
        } catch (dlqError) {
          console.error('Failed to process dead letter:', dlqError);
        }
      }
    }
  }
}

// Helper function to process different email types
async function processEmail(type, data, env) {
  switch (type) {
    case 'welcome':
      // Send welcome email
      break;
    case 'trial_expiry':
      // Send trial expiry email
      break;
    case 'payment_success':
      // Send payment success email
      break;
    default:
      console.warn('Unknown email type:', type);
  }
}

/**
 * Handle GET requests
 */
async function handleGetRequest(pathParts, url, request, env, ragController, teamController, sharedWorkspaceController, analyticsController, performanceController) {
  const route = pathParts[0];

  switch (route) {
    case 'health':
      return {
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: env.ENVIRONMENT || 'development'
      };

    case 'status':
      const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '') ||
                   request.headers.get('X-API-Key') ||
                   url.searchParams.get('api_key');
      const userId = url.searchParams.get('userId');

      if (!userId && !apiKey) {
        return {
          success: false,
          error: 'Missing userId or apiKey parameter',
          error_code: 'missing_credentials'
        };
      }

      return await ragController.handleRAGQuery(userId, 'status', apiKey);

    case 'pricing':
      return {
        success: true,
        data: {
          free: {
            searches_per_day: 100,
            files_indexed: 1000,
            vision_analyses: 0,
            price: 0
          },
          pro: {
            searches_per_day: -1, // unlimited
            files_indexed: -1,
            vision_analyses: -1,
            price: 29
          },
          enterprise: {
            searches_per_day: -1,
            files_indexed: -1,
            vision_analyses: -1,
            price: 'custom'
          }
        }
      };

    case 'teams':
      // Handle team GET operations
      return await handleTeamRoutes(pathParts.slice(1), request, teamController);

    case 'workspace':
      // Handle workspace GET operations
      return await handleWorkspaceRoutes(pathParts.slice(1), request, sharedWorkspaceController);

    case 'analytics':
      // Handle analytics GET operations
      return await handleAnalyticsRoutes(pathParts.slice(1), request, analyticsController, realtimeAnalytics);

    case 'performance':
      // Handle performance monitoring GET operations
      return await handlePerformanceRoutes(pathParts.slice(1), request, performanceController);

    default:
      return {
        success: false,
        error: 'Endpoint not found',
        error_code: 'not_found'
      };
  }
}

/**
 * Handle POST requests
 */
async function handlePostRequest(pathParts, request, env, ragController, teamController, sharedWorkspaceController, analyticsController, performanceController) {
  const route = pathParts[0];
  const body = await request.json().catch(() => ({}));

  switch (route) {
    case 'query':
      const { userId, message, apiKey, sessionId, licenseKey } = body;

      if (!userId && !apiKey) {
        return {
          success: false,
          error: 'Missing userId or apiKey',
          error_code: 'missing_credentials'
        };
      }

      if (!message) {
        return {
          success: false,
          error: 'Missing message parameter',
          error_code: 'missing_message'
        };
      }

      return await ragController.handleRAGQuery(userId, message, apiKey, sessionId, licenseKey);

    case 'upgrade':
      const { email, userId: upgradeUserId } = body;

      if (!email) {
        return {
          success: false,
          error: 'Missing email parameter',
          error_code: 'missing_email'
        };
      }

      return await ragController.startUpgradeProcess(email, upgradeUserId);

    case 'webhook':
      // Handle LemonSqueezy webhook
      const signature = request.headers.get('X-Signature') || request.headers.get('x-signature');
      const payload = JSON.stringify(body);

      // Verify webhook signature
      const isValid = await ragController.ls.verifyWebhookSignature(payload, signature);
      if (!isValid) {
        return {
          success: false,
          error: 'Invalid webhook signature',
          error_code: 'invalid_signature'
        };
      }

      const eventType = body.meta?.event_name;
      return await ragController.processWebhook(eventType, body);

    case 'contact':
      // Handle enterprise contact form
      const { company, name, email: contactEmail, teamSize, message: contactMessage } = body;

      if (!company || !name || !contactEmail || !contactMessage) {
        return {
          success: false,
          error: 'Missing required contact information',
          error_code: 'missing_contact_info'
        };
      }

      await ragController.email.sendEnterpriseContactEmail({
        company,
        name,
        email: contactEmail,
        teamSize: teamSize || 'Not specified',
        message: contactMessage
      });

      return {
        success: true,
        message: 'Thank you for your inquiry! We\'ll contact you within 24 hours.'
      };

    case 'teams':
      // Handle team management operations
      return await handleTeamRoutes(pathParts.slice(1), request, teamController);

    case 'workspace':
      // Handle shared workspace operations
      return await handleWorkspaceRoutes(pathParts.slice(1), request, sharedWorkspaceController);

    case 'analytics':
      // Handle analytics operations
      return await handleAnalyticsRoutes(pathParts.slice(1), request, analyticsController, realtimeAnalytics);

    case 'performance':
      // Handle performance monitoring operations
      return await handlePerformanceRoutes(pathParts.slice(1), request, performanceController);

    default:
      return {
        success: false,
        error: 'Endpoint not found',
        error_code: 'not_found'
      };
  }
}

/**
 * Handle daily scheduled tasks
 */
async function handleDailyTasks(env) {
  console.log('Running daily tasks');

  try {
    // Check for expiring trials
    // Send usage reports
    // Cleanup old data
    console.log('Daily tasks completed');
  } catch (error) {
    console.error('Error in daily tasks:', error);
  }
}

/**
 * Handle weekly scheduled tasks
 */
async function handleWeeklyTasks(env) {
  console.log('Running weekly tasks');

  try {
    // Send weekly analytics
    // Update user statistics
    // Maintenance tasks
    console.log('Weekly tasks completed');
  } catch (error) {
    console.error('Error in weekly tasks:', error);
  }
}

/**
 * Handle team management routes
 */
async function handleTeamRoutes(pathParts, request, teamController) {
  const method = request.method;
  const route = pathParts[0];
  const url = new URL(request.url);
  let userId = url.searchParams.get('userId') ||
                request.headers.get('X-User-ID') ||
                request.headers.get('Authorization')?.replace('Bearer ', '');

  // For POST requests, get userId from body
  let body = {};
  if (method === 'POST') {
    body = await request.json().catch(() => ({}));
    if (!userId && body.userId) {
      userId = body.userId;
    }
  }

  if (!userId) {
    return {
      success: false,
      error: 'Missing userId parameter or header',
      error_code: 'missing_user_id'
    };
  }

  // Handle different team routes
  if (method === 'GET') {
    switch (route) {
      case undefined:
      case 'list':
        // Get user's teams
        return await teamController.getUserTeams(userId);

      default:
        // Get specific team details
        const teamId = route;
        if (!teamId) {
          return {
            success: false,
            error: 'Team ID is required',
            error_code: 'missing_team_id'
          };
        }
        return await teamController.getTeamById(userId, teamId);
    }
  }

  if (method === 'POST') {
    switch (route) {
      case 'create':
        // Create new team
        return await teamController.createTeam(userId, body);

      case 'invite':
        // Invite member to team
        const { teamId, email, role } = body;
        if (!teamId) {
          return {
            success: false,
            error: 'Team ID is required',
            error_code: 'missing_team_id'
          };
        }
        return await teamController.inviteMember(userId, teamId, { email, role });

      case 'leave':
        // Leave team
        const { teamId: leaveTeamId } = body;
        if (!leaveTeamId) {
          return {
            success: false,
            error: 'Team ID is required',
            error_code: 'missing_team_id'
          };
        }
        return await teamController.leaveTeam(userId, leaveTeamId);

      case 'settings':
        // Update team settings
        const { teamId: settingsTeamId, settings } = body;
        if (!settingsTeamId) {
          return {
            success: false,
            error: 'Team ID is required',
            error_code: 'missing_team_id'
          };
        }
        return await teamController.updateTeamSettings(userId, settingsTeamId, settings);

      default:
        // Handle team member operations
        const defaultTeamId = route;
        if (!defaultTeamId) {
          return {
            success: false,
            error: 'Team ID is required',
            error_code: 'missing_team_id'
          };
        }

        const subRoute = pathParts[1];
        const memberId = pathParts[2];

        if (subRoute === 'members' && memberId) {
          if (method === 'POST') {
            // Update member role
            const { role } = body;
            return await teamController.updateMemberRole(userId, defaultTeamId, memberId, role);
          } else if (method === 'DELETE') {
            // Remove member
            return await teamController.removeMember(userId, defaultTeamId, memberId);
          }
        }

        return {
          success: false,
          error: 'Team endpoint not found',
          error_code: 'team_endpoint_not_found'
        };
    }
  }

  if (method === 'DELETE') {
    if (!route) {
      return {
        success: false,
        error: 'Team ID is required',
        error_code: 'missing_team_id'
      };
    }

    const teamId = route;
    const memberId = pathParts[1];

    if (memberId) {
      // Remove team member
      return await teamController.removeMember(userId, teamId, memberId);
    } else {
      return {
        success: false,
        error: 'Member ID is required for deletion',
        error_code: 'missing_member_id'
      };
    }
  }

  return {
    success: false,
    error: 'Method not allowed',
    error_code: 'method_not_allowed'
  };
}

/**
 * Handle shared workspace routes
 */
async function handleWorkspaceRoutes(pathParts, request, workspaceController) {
  const method = request.method;
  const route = pathParts[0];
  const url = new URL(request.url);
  let userId = url.searchParams.get('userId') ||
                request.headers.get('X-User-ID') ||
                request.headers.get('Authorization')?.replace('Bearer ', '');

  // For POST requests, get userId from body
  let body = {};
  if (method === 'POST') {
    body = await request.json().catch(() => ({}));
    if (!userId && body.userId) {
      userId = body.userId;
    }
  }

  if (!userId) {
    return {
      success: false,
      error: 'Missing userId parameter or header',
      error_code: 'missing_user_id'
    };
  }

  // Handle different workspace routes
  if (method === 'GET') {
    switch (route) {
      case 'projects':
        // Get team projects
        const teamId = url.searchParams.get('teamId');
        if (!teamId) {
          return {
            success: false,
            error: 'Team ID is required',
            error_code: 'missing_team_id'
          };
        }
        return await workspaceController.getTeamProjects(userId, teamId);

      case 'conversations':
        // Get shared conversations
        const convTeamId = url.searchParams.get('teamId');
        if (!convTeamId) {
          return {
            success: false,
            error: 'Team ID is required',
            error_code: 'missing_team_id'
          };
        }
        return await workspaceController.getSharedConversations(userId, convTeamId, {
          limit: parseInt(url.searchParams.get('limit')) || 50,
          offset: parseInt(url.searchParams.get('offset')) || 0,
          search: url.searchParams.get('search'),
          member_id: url.searchParams.get('memberId')
        });

      case 'knowledge':
        // Search team knowledge base
        const knowTeamId = url.searchParams.get('teamId');
        const query = url.searchParams.get('query');
        if (!knowTeamId || !query) {
          return {
            success: false,
            error: 'Team ID and query are required',
            error_code: 'missing_required_params'
          };
        }
        return await workspaceController.searchTeamKnowledgeBase(userId, knowTeamId, query, {
          type: url.searchParams.get('type'),
          category: url.searchParams.get('category'),
          tags: url.searchParams.get('tags')?.split(','),
          max_results: parseInt(url.searchParams.get('maxResults')) || 20
        });

      case 'cross-search':
        // Cross-team search
        const crossQuery = url.searchParams.get('query');
        const teamIds = url.searchParams.get('teamIds')?.split(',');
        if (!crossQuery) {
          return {
            success: false,
            error: 'Query is required',
            error_code: 'missing_query'
          };
        }
        return await workspaceController.crossTeamSearch(userId, crossQuery, teamIds || []);

      default:
        return {
          success: false,
          error: 'Workspace endpoint not found',
          error_code: 'endpoint_not_found'
        };
    }
  }

  if (method === 'POST') {
    switch (route) {
      case 'index-project':
        // Index team project
        const { teamId: indexTeamId, name, description, repository_url, language, settings } = body;
        if (!indexTeamId || !name || !repository_url) {
          return {
            success: false,
            error: 'Team ID, name, and repository URL are required',
            error_code: 'missing_required_params'
          };
        }
        return await workspaceController.indexTeamProject(userId, indexTeamId, {
          name,
          description,
          repository_url,
          language,
          settings
        });

      case 'query':
        // Collaborative RAG query
        const { teamId: queryTeamId, query: ragQuery, options } = body;
        if (!queryTeamId || !ragQuery) {
          return {
            success: false,
            error: 'Team ID and query are required',
            error_code: 'missing_required_params'
          };
        }
        return await workspaceController.collaborativeRAGQuery(userId, queryTeamId, ragQuery, options);

      case 'add-knowledge':
        // Add team knowledge entry
        const { teamId: knowTeamId, title, content, type, tags, category } = body;
        if (!knowTeamId || !title || !content) {
          return {
            success: false,
            error: 'Team ID, title, and content are required',
            error_code: 'missing_required_params'
          };
        }
        return await workspaceController.addTeamKnowledge(userId, knowTeamId, {
          title,
          content,
          type,
          tags,
          category
        });

      default:
        return {
          success: false,
          error: 'Workspace endpoint not found',
          error_code: 'endpoint_not_found'
        };
    }
  }

  return {
    success: false,
    error: 'Method not allowed',
    error_code: 'method_not_allowed'
  };
}

/**
 * Handle analytics routes
 */
async function handleAnalyticsRoutes(pathParts, request, analyticsController, realtimeAnalyticsController) {
  const method = request.method;
  const route = pathParts[0];

  // Real-time analytics sub-routes: /analytics/realtime/*
  if (route === 'realtime' && realtimeAnalyticsController) {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') ||
      request.headers.get('X-User-ID') ||
      request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }
    return realtimeAnalyticsController.handle(
      new Request(request.url.replace('/realtime', ''), { method: request.method, body: request.body, headers: request.headers }),
      userId
    );
  }

  const url = new URL(request.url);
  let userId = url.searchParams.get('userId') ||
                request.headers.get('X-User-ID') ||
                request.headers.get('Authorization')?.replace('Bearer ', '');

  // For POST requests, get userId from body
  let body = {};
  if (method === 'POST') {
    body = await request.json().catch(() => ({}));
    if (!userId && body.userId) {
      userId = body.userId;
    }
  }

  if (!userId) {
    return {
      success: false,
      error: 'Missing userId parameter or header',
      error_code: 'missing_user_id'
    };
  }

  // Handle different analytics routes
  if (method === 'GET') {
    switch (route) {
      case 'dashboard':
        // Get team analytics dashboard
        const teamId = url.searchParams.get('teamId');
        if (!teamId) {
          return {
            success: false,
            error: 'Team ID is required',
            error_code: 'missing_team_id'
          };
        }

        const dateRange = url.searchParams.get('startDate') && url.searchParams.get('endDate')
          ? {
              start: url.searchParams.get('startDate'),
              end: url.searchParams.get('endDate')
            }
          : null;

        return await analyticsController.getTeamAnalytics(userId, teamId, dateRange);

      case 'usage':
        // Get usage statistics
        const usageTeamId = url.searchParams.get('teamId');
        if (!usageTeamId) {
          return {
            success: false,
            error: 'Team ID is required',
            error_code: 'missing_team_id'
          };
        }

        const usageDateRange = url.searchParams.get('startDate') && url.searchParams.get('endDate')
          ? {
              start: url.searchParams.get('startDate'),
              end: url.searchParams.get('endDate')
            }
          : null;

        return await analyticsController.getUsageStats(usageTeamId, usageDateRange);

      case 'member-activity':
        // Get member activity tracking
        const memberTeamId = url.searchParams.get('teamId');
        if (!memberTeamId) {
          return {
            success: false,
            error: 'Team ID is required',
            error_code: 'missing_team_id'
          };
        }

        const memberDateRange = url.searchParams.get('startDate') && url.searchParams.get('endDate')
          ? {
              start: url.searchParams.get('startDate'),
              end: url.searchParams.get('endDate')
            }
          : null;

        return await analyticsController.getMemberActivity(memberTeamId, memberDateRange);

      case 'feature-adoption':
        // Get feature adoption metrics
        const adoptionTeamId = url.searchParams.get('teamId');
        if (!adoptionTeamId) {
          return {
            success: false,
            error: 'Team ID is required',
            error_code: 'missing_team_id'
          };
        }

        const adoptionDateRange = url.searchParams.get('startDate') && url.searchParams.get('endDate')
          ? {
              start: url.searchParams.get('startDate'),
              end: url.searchParams.get('endDate')
            }
          : null;

        return await analyticsController.getFeatureAdoptionMetrics(adoptionTeamId, adoptionDateRange);

      case 'performance':
        // Get performance benchmarks
        const perfTeamId = url.searchParams.get('teamId');
        if (!perfTeamId) {
          return {
            success: false,
            error: 'Team ID is required',
            error_code: 'missing_team_id'
          };
        }

        const perfDateRange = url.searchParams.get('startDate') && url.searchParams.get('endDate')
          ? {
              start: url.searchParams.get('startDate'),
              end: url.searchParams.get('endDate')
            }
          : null;

        return await analyticsController.getPerformanceMetrics(perfTeamId, perfDateRange);

      default:
        return {
          success: false,
          error: 'Analytics endpoint not found',
          error_code: 'analytics_endpoint_not_found'
        };
    }
  }

  if (method === 'POST') {
    switch (route) {
      case 'export':
        // Export analytics data
        const { teamId: exportTeamId, format, dateRange: exportDateRange } = body;
        if (!exportTeamId || !format) {
          return {
            success: false,
            error: 'Team ID and export format are required',
            error_code: 'missing_export_params'
          };
        }

        return await analyticsController.exportAnalytics(userId, exportTeamId, format, exportDateRange);

      case 'refresh':
        // Refresh analytics data (re-calculate metrics)
        const { teamId: refreshTeamId, force } = body;
        if (!refreshTeamId) {
          return {
            success: false,
            error: 'Team ID is required',
            error_code: 'missing_team_id'
          };
        }

        // This would trigger background processing to refresh analytics
        return {
          success: true,
          data: {
            message: 'Analytics refresh initiated',
            team_id: refreshTeamId,
            force_refresh: force || false
          }
        };

      default:
        return {
          success: false,
          error: 'Analytics endpoint not found',
          error_code: 'analytics_endpoint_not_found'
        };
    }
  }

  return {
    success: false,
    error: 'Method not allowed',
    error_code: 'method_not_allowed'
  };
}

/**
 * Get CORS headers
 */
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Apply caching middleware before request handling
 */
async function applyCachingMiddleware(request, env, ctx, cachingMiddleware) {
  const url = new URL(request.url);
  const pathParts = url.pathname.replace(/^\/+/, '').split('/');

  // Apply different caching strategies based on endpoint
  if (pathParts[0] === 'analytics' && request.method === 'GET') {
    // Cache analytics responses
    return await cachingMiddleware.cacheAnalytics()(request, env, ctx);
  }

  if (pathParts[0] === 'query' && request.method === 'POST') {
    // Cache RAG query responses
    return await cachingMiddleware.cacheRAGQuery()(request, env, ctx);
  }

  // Session caching for auth endpoints
  if (pathParts[0] === 'auth' && pathParts[1] === 'me' && request.method === 'GET') {
    return await cachingMiddleware.cacheSession()(request, env, ctx);
  }

  return null; // No cached response
}

/**
 * Apply post-request caching middleware
 */
async function applyPostCachingMiddleware(response, request, env, ctx, cachingMiddleware) {
  const url = new URL(request.url);
  const pathParts = url.pathname.replace(/^\/+/, '').split('/');

  // Store successful responses in cache
  if (response.ok) {
    try {
      let cacheConfig = null;

      if (pathParts[0] === 'analytics' && request.method === 'GET') {
        cacheConfig = {
          ttl: 1800, // 30 minutes
          keyGenerator: (req) => `analytics:${req.url}`,
          tags: ['analytics']
        };
      }

      if (pathParts[0] === 'query' && request.method === 'POST') {
        cacheConfig = {
          ttl: 300, // 5 minutes
          keyGenerator: async (req) => {
            const body = await req.json().catch(() => ({}));
            const hash = await cachingMiddleware.hashString(JSON.stringify(body));
            return `query:${req.url}:${hash}`;
          },
          tags: ['query', 'rag']
        };
      }

      if (cacheConfig) {
        await cachingMiddleware.storeResponse(cacheConfig)(response, request, env, ctx);
      }
    } catch (error) {
      console.error('Post-caching error:', error);
    }
  }
}

/**
 * Apply cache invalidation for modifying requests
 */
async function applyCacheInvalidation(request, env, ctx, cachingMiddleware) {
  const url = new URL(request.url);
  const pathParts = url.pathname.replace(/^\/+/, '').split('/');

  // Only invalidate on modifying requests
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    return;
  }

  try {
    const patterns = [];

    // Invalidate analytics cache when team data changes
    if (pathParts[0] === 'teams') {
      patterns.push('analytics:*');
      patterns.push('query:*');
    }

    // Invalidate RAG cache when knowledge base changes
    if (pathParts[0] === 'workspace' && pathParts[1] === 'add-knowledge') {
      patterns.push('query:*');
      patterns.push('workspace:*');
    }

    // Invalidate team-specific caches
    if (pathParts[0] === 'teams' && pathParts[1]) {
      const teamId = pathParts[1];
      patterns.push(`*:*team-${teamId}*`);
    }

    if (patterns.length > 0) {
      await cachingMiddleware.invalidateCache(patterns)(request, env, ctx);
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
}

/**
 * Handle performance monitoring routes
 */
async function handlePerformanceRoutes(pathParts, request, performanceController) {
  const method = request.method;
  const route = pathParts[0];
  const url = new URL(request.url);

  // Handle different performance routes
  if (method === 'GET') {
    switch (route) {
      case 'metrics':
        // Get performance metrics
        return await performanceController.getPerformanceMetrics();

      case 'health':
        // Get database health check
        return await performanceController.getHealthCheck();

      case 'slow-queries':
        // Get slow queries analysis
        const limit = parseInt(url.searchParams.get('limit')) || 50;
        const minTime = parseInt(url.searchParams.get('minTime')) || 50;
        return await performanceController.getSlowQueries({ limit, minTime });

      case 'cache':
        // Get cache performance analysis
        return await performanceController.getCachePerformance();

      case 'indexes':
        // Get index recommendations
        return await performanceController.getIndexRecommendations();

      case 'report':
        // Generate comprehensive performance report
        const period = url.searchParams.get('period') || '24h';
        const includeRecommendations = url.searchParams.get('includeRecommendations') !== 'false';
        const includeQueryPlans = url.searchParams.get('includeQueryPlans') === 'true';
        return await performanceController.generatePerformanceReport({
          period,
          includeRecommendations,
          includeQueryPlans
        });

      default:
        return {
          success: false,
          error: 'Performance endpoint not found',
          error_code: 'performance_endpoint_not_found'
        };
    }
  }

  if (method === 'POST') {
    switch (route) {
      case 'optimize':
        // Run database optimization
        const body = await request.json().catch(() => ({}));
        return await performanceController.runOptimization({
          dryRun: body.dryRun !== false,
          analyzeTables: body.analyzeTables !== false,
          createIndexes: body.createIndexes === true
        });

      case 'query-plan':
        // Analyze query execution plan
        const queryBody = await request.json().catch(() => ({}));
        const { query, params } = queryBody;
        if (!query) {
          return {
            success: false,
            error: 'Query is required',
            error_code: 'missing_query'
          };
        }
        return await performanceController.getQueryPlan(query, params || []);

      default:
        return {
          success: false,
          error: 'Performance endpoint not found',
          error_code: 'performance_endpoint_not_found'
        };
    }
  }

  return {
    success: false,
    error: 'Method not allowed',
    error_code: 'method_not_allowed'
  };
}

/**
 * Handle health check endpoint
 */
async function handleHealthCheck(env) {
  try {
    const checks = {
      database: false,
      cache: false,
      timestamp: new Date().toISOString()
    };

    // Check database connectivity
    try {
      await env.DB.prepare('SELECT 1').first();
      checks.database = true;
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    // Check cache connectivity
    try {
      await env.CACHE.get('health:check');
      checks.cache = true;
    } catch (error) {
      console.error('Cache health check failed:', error);
    }

    const healthy = checks.database && checks.cache;

    return new Response(JSON.stringify({
      status: healthy ? 'healthy' : 'unhealthy',
      checks,
      version: '1.0.0'
    }), {
      status: healthy ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    return new Response(JSON.stringify({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}