/**
 * RAG (Retrieval-Augmented Generation) API Routes
 *
 * Provides web-based RAG functionality for the FinTech suite.
 * This replaces the CLI interface with online services.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env, APIRequest, APIResponse } from '../types';
import { UnifiedRAGService } from '../rag/unified-rag-service';
import { RAGOrchestrator } from '../rag/orchestration/rag-orchestrator';
import { MultiModalProcessor } from '../rag/multi-modal/multi-modal-processor';
import { RealTimeLearningSystem } from '../rag/learning/real-time-learning-system';
import { IntelligentDocumentProcessor } from '../rag/document-processing/intelligent-document-processor';
import { VectorizeService } from '../rag/vectorize/services/vector-service';
import { DocumentIngester } from '../rag/ingestion/document-ingester';
import { ContentExtractor } from '../rag/extraction/content-extractor';
import { EmbeddingGenerator } from '../rag/vectorize/embedding-generator';
import { KnowledgeGraphBuilder } from '../rag/knowledge-graph/builder/graph-builder';
import { UnifiedQueryEngine } from '../rag/query/engine/unified-query-engine';

const ragApp = new Hono<{ Bindings: Env }>();

// Initialize RAG services (lazy loading)
let ragService: UnifiedRAGService | null = null;

function getRAGService(c: any): UnifiedRAGService {
  if (!ragService) {
    ragService = new UnifiedRAGService({
      ai: c.env.AI,
      r2: c.env.DOCUMENTS,
      kv: c.env.CACHE,
      d1: c.env.DB_INTELLIGENCE_US, // Use appropriate DB
      vectorize: c.env.VECTORIZE_INDEX,
      analytics: c.env.ANALYTICS,
      logger: console,

      // RAG-specific services
      documentIngester: new DocumentIngester(c.env.QUEUE_MANAGE, console),
      contentExtractor: new ContentExtractor(c.env.AI, console),
      embeddingGenerator: new EmbeddingGenerator(c.env.AI, c.env.VECTORIZE_INDEX, console),
      knowledgeGraphBuilder: new KnowledgeGraphBuilder(c.env.DB_INTELLIGENCE_US, console),
      queryEngine: new UnifiedQueryEngine(c.env.VECTORIZE_INDEX, c.env.AI, console),
      queueManager: c.env.QUEUE_MANAGE,
      notificationManager: c.env.NOTIFICATIONS,
      knowledgeGraph: c.env.DB_INTELLIGENCE_US
    });
  }
  return ragService;
}

// Request schemas
const initSchema = z.object({
  project: z.string().optional(),
  vectorStore: z.string().optional(),
  embeddingModel: z.string().optional(),
  targetTokens: z.number().optional(),
  strategy: z.enum(['balanced', 'maximum', 'quality']).optional()
});

const indexSchema = z.object({
  force: z.boolean().optional(),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  maxFileSize: z.number().optional()
});

const querySchema = z.object({
  query: z.string().min(1),
  topK: z.number().min(1).max(50).optional(),
  type: z.enum(['semantic', 'graph', 'hybrid', 'question', 'compliance', 'risk']).optional(),
  filter: z.record(z.any()).optional(),
  excerpts: z.boolean().optional(),
  optimizeTokens: z.boolean().optional(),
  session: z.string().optional(),
  context: z.record(z.any()).optional()
});

const updateSchema = z.object({
  files: z.array(z.string()),
  incremental: z.boolean().optional(),
  rebuild: z.boolean().optional()
});

const chatSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().optional(),
  context: z.record(z.any()).optional(),
  options: z.record(z.any()).optional()
});

// Routes

/**
 * GET /api/rag/health
 * Check RAG system health and availability
 */
ragApp.get('/health', async (c) => {
  try {
    const ragService = getRAGService(c);
    const health = await ragService.getHealth();

    return c.json({
      success: true,
      data: health,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'RAG_HEALTH_CHECK_FAILED',
        message: 'Failed to check RAG system health',
        details: error.message
      }
    }, 500);
  }
});

/**
 * POST /api/rag/init
 * Initialize RAG system for the current organization/project
 */
ragApp.post('/init', zValidator('json', initSchema), async (c) => {
  const data = c.req.valid('json');
  const organizationId = c.get('organization')?.id;
  const userId = c.get('user')?.id;

  if (!organizationId || !userId) {
    return c.json({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication and organization context required'
      }
    }, 401);
  }

  try {
    // Initialize RAG with organization-specific context
    const initRequest = {
      id: `init_${Date.now()}`,
      operation: 'initialize',
      data: {
        ...data,
        organizationId,
        namespace: `org-${organizationId}`,
        userContext: {
          userId,
          permissions: c.get('permissions') || []
        }
      },
      options: {
        priority: 'high',
        enablePersonalization: true,
        enableCompliance: true
      },
      context: {
        product: 'rag',
        organizationId,
        userId
      },
      userId,
      timestamp: new Date().toISOString()
    };

    const ragService = getRAGService(c);
    const result = await ragService.process(initRequest);

    return c.json({
      success: result.status === 'completed',
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        organizationId,
        userId
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'RAG_INITIALIZATION_FAILED',
        message: 'Failed to initialize RAG system',
        details: error.message
      }
    }, 500);
  }
});

/**
 * POST /api/rag/index
 * Index documents and content for RAG
 */
ragApp.post('/index', zValidator('json', indexSchema), async (c) => {
  const data = c.req.valid('json');
  const organizationId = c.get('organization')?.id;
  const userId = c.get('user')?.id;

  if (!organizationId || !userId) {
    return c.json({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication and organization context required'
      }
    }, 401);
  }

  try {
    // Start indexing process
    const indexRequest = {
      id: `index_${Date.now()}`,
      operation: 'ingest_document',
      data: {
        source: 'web_upload',
        organizationId,
        options: {
          ...data,
          namespace: `org-${organizationId}`,
          permissions: c.get('permissions') || []
        }
      },
      options: {
        priority: 'normal',
        enableLearning: true,
        enableCompliance: true
      },
      context: {
        product: 'rag',
        organizationId,
        userId,
        sessionId: c.get('sessionId')
      },
      userId,
      timestamp: new Date().toISOString()
    };

    const ragService = getRAGService(c);
    const result = await ragService.process(indexRequest);

    return c.json({
      success: result.status === 'completed',
      data: {
        ...result,
        message: result.status === 'completed'
          ? 'Indexing completed successfully'
          : 'Indexing started in background'
      },
      meta: {
        timestamp: new Date().toISOString(),
        organizationId,
        userId
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'RAG_INDEXING_FAILED',
        message: 'Failed to index documents',
        details: error.message
      }
    }, 500);
  }
});

/**
 * POST /api/rag/query
 * Search and retrieve information using RAG
 */
ragApp.post('/query', zValidator('json', querySchema), async (c) => {
  const data = c.req.valid('json');
  const organizationId = c.get('organization')?.id;
  const userId = c.get('user')?.id;

  if (!organizationId || !userId) {
    return c.json({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication and organization context required'
      }
    }, 401);
  }

  try {
    const queryRequest = {
      id: `query_${Date.now()}`,
      operation: 'search',
      data: {
        ...data,
        namespace: `org-${organizationId}`,
        organizationId,
        userContext: {
          userId,
          permissions: c.get('permissions') || []
        }
      },
      options: {
        enablePersonalization: true,
        includeMetadata: true,
        enableLearning: true
      },
      context: {
        ...data.context,
        product: 'rag',
        organizationId,
        userId,
        sessionId: data.session
      },
      userId,
      timestamp: new Date().toISOString()
    };

    const ragService = getRAGService(c);
    const result = await ragService.process(queryRequest);

    return c.json({
      success: result.status === 'completed',
      data: {
        ...result,
        results: result.result?.results || [],
        query: data.query,
        queryType: data.type || 'hybrid',
        resultsCount: result.result?.results?.length || 0
      },
      meta: {
        timestamp: new Date().toISOString(),
        organizationId,
        userId,
        processingTime: result.processingTime
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'RAG_QUERY_FAILED',
        message: 'Failed to process query',
        details: error.message
      }
    }, 500);
  }
});

/**
 * POST /api/rag/chat
 * Interactive chat with RAG system
 */
ragApp.post('/chat', zValidator('json', chatSchema), async (c) => {
  const data = c.req.valid('json');
  const organizationId = c.get('organization')?.id;
  const userId = c.get('user')?.id;

  if (!organizationId || !userId) {
    return c.json({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication and organization context required'
      }
    }, 401);
  }

  try {
    const chatRequest = {
      id: `chat_${Date.now()}`,
      operation: 'search',
      data: {
        query: data.message,
        searchType: 'hybrid',
        maxResults: 5,
        includeExcerpts: true,
        conversationHistory: data.context?.previousMessages || [],
        namespace: `org-${organizationId}`,
        organizationId,
        chatMode: true
      },
      options: {
        enablePersonalization: true,
        includeMetadata: false,
        enableLearning: true
      },
      context: {
        ...data.context,
        product: 'rag',
        organizationId,
        userId,
        sessionId: data.sessionId,
        conversationMode: true
      },
      userId,
      timestamp: new Date().toISOString()
    };

    const ragService = getRAGService(c);
    const result = await ragService.process(chatRequest);

    // Track learning if enabled
    if (result.status === 'completed') {
      const learningRequest = {
        id: `learning_chat_${Date.now()}`,
        operation: 'track_learning',
        data: {
          learningType: 'track_behavior',
          interactionType: 'chat',
          message: data.message,
          resultsCount: result.result?.results?.length || 0,
          sessionId: data.sessionId,
          satisfaction: 'pending' // Can be updated with user feedback
        },
        options: {},
        context: {
          product: 'rag',
          organizationId,
          userId,
          sessionId: data.sessionId
        },
        userId,
        timestamp: new Date().toISOString()
      };

      await ragService.process(learningRequest);
    }

    return c.json({
      success: result.status === 'completed',
      data: {
        message: 'Chat response generated',
        response: {
          type: 'search_results',
          content: result.result?.results || [],
          contextual: true
        },
        sessionId: data.sessionId,
        query: data.message,
        resultsCount: result.result?.results?.length || 0
      },
      meta: {
        timestamp: new Date().toISOString(),
        organizationId,
        userId,
        processingTime: result.processingTime
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'RAG_CHAT_FAILED',
        message: 'Failed to process chat message',
        details: error.message
      }
    }, 500);
  }
});

/**
 * POST /api/rag/upload
 * Upload and process documents for RAG indexing
 */
ragApp.post('/upload', async (c) => {
  const organizationId = c.get('organization')?.id;
  const userId = c.get('user')?.id;

  if (!organizationId || !userId) {
    return c.json({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication and organization context required'
      }
    }, 401);
  }

  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const documentType = formData.get('documentType') as string || 'auto';
    const options = JSON.parse(formData.get('options') as string || '{}');

    if (!file) {
      return c.json({
        success: false,
        error: {
          code: 'NO_FILE_UPLOADED',
          message: 'No file provided for upload'
        }
      }, 400);
    }

    // Process file upload
    const uploadRequest = {
      id: `upload_${Date.now()}`,
      operation: 'process_multi_modal',
      data: {
        content: new Uint8Array(await file.arrayBuffer()),
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        documentType,
        namespace: `org-${organizationId}`,
        organizationId,
        options: {
          ...options,
          enableOCR: true,
          enableExtraction: true,
          storeOriginal: true
        }
      },
      options: {
        priority: 'normal',
        enableLearning: true
      },
      context: {
        product: 'rag',
        organizationId,
        userId
      },
      userId,
      timestamp: new Date().toISOString()
    };

    const ragService = getRAGService(c);
    const result = await ragService.process(uploadRequest);

    return c.json({
      success: result.status === 'completed',
      data: {
        ...result,
        message: 'Document uploaded and processed successfully',
        fileName: file.name,
        fileSize: file.size,
        documentType
      },
      meta: {
        timestamp: new Date().toISOString(),
        organizationId,
        userId
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'RAG_UPLOAD_FAILED',
        message: 'Failed to upload document',
        details: error.message
      }
    }, 500);
  }
});

/**
 * GET /api/rag/stats
 * Get RAG system statistics and analytics
 */
ragApp.get('/stats', async (c) => {
  const organizationId = c.get('organization')?.id;
  const userId = c.get('user')?.id;

  if (!organizationId || !userId) {
    return c.json({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication and organization context required'
      }
    }, 401);
  }

  try {
    const ragService = getRAGService(c);
    const health = await ragService.getHealth();
    const stats = ragService.getStats();

    return c.json({
      success: true,
      data: {
        health,
        stats,
        organizationStats: {
          namespace: `org-${organizationId}`,
          documentCount: health.metrics.processedRequests || 0,
          averageResponseTime: health.metrics.averageResponseTime || 0
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        organizationId,
        userId
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'RAG_STATS_FAILED',
        message: 'Failed to retrieve statistics',
        details: error.message
      }
    }, 500);
  }
});

/**
 * POST /api/rag/feedback
 * Submit feedback for RAG learning improvement
 */
ragApp.post('/feedback', zValidator('json', z.object({
  requestId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
  helpful: z.boolean().optional()
})), async (c) => {
  const data = c.req.valid('json');
  const organizationId = c.get('organization')?.id;
  const userId = c.get('user')?.id;

  if (!organizationId || !userId) {
    return c.json({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication and organization context required'
      }
    }, 401);
  }

  try {
    const feedbackRequest = {
      id: `feedback_${Date.now()}`,
      operation: 'track_learning',
      data: {
        learningType: 'process_feedback',
        requestId: data.requestId,
        rating: data.rating,
        comment: data.comment,
        helpful: data.helpful,
        userId,
        organizationId
      },
      options: {},
      context: {
        product: 'rag',
        organizationId,
        userId
      },
      userId,
      timestamp: new Date().toISOString()
    };

    const ragService = getRAGService(c);
    const result = await ragService.process(feedbackRequest);

    return c.json({
      success: result.status === 'completed',
      data: {
        message: 'Feedback submitted successfully',
        feedbackId: feedbackRequest.id
      },
      meta: {
        timestamp: new Date().toISOString(),
        organizationId,
        userId
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'RAG_FEEDBACK_FAILED',
        message: 'Failed to submit feedback',
        details: error.message
      }
    }, 500);
  }
});

export default ragApp;
