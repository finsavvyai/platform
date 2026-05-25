/**
 * AI Platform Routes
 * Core AI functionality and intelligent processing endpoints
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types';

const ai = new Hono<{ Bindings: Env }>();

// AI Health Check
ai.get('/health', async (c) => {
  try {
    const env = c.env as any;

    // Test AI model availability
    const testResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 10
    });

    const embeddingResponse = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: ['test']
    });

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        llm: !!testResponse?.response,
        embeddings: !!embeddingResponse,
        vectorize: !!env.RAG_EMBEDDINGS,
        agent_memory: !!env.AGENT_MEMORY
      },
      models: {
        llm: '@cf/meta/llama-3.1-8b-instruct',
        embeddings: '@cf/baai/bge-base-en-v1.5'
      }
    };

    return c.json({
      success: true,
      data: health
    });

  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'AI_HEALTH_CHECK_FAILED',
        message: 'AI health check failed'
      }
    }, 500);
  }
});

// AI Analysis Endpoint
ai.post('/analyze', async (c) => {
  try {
    const { text, context, analysis_type = 'general' } = await c.req.json();

    if (!text || typeof text !== 'string') {
      return c.json({
        success: false,
        error: {
          code: 'INVALID_TEXT',
          message: 'Valid text is required'
        }
      }, 400);
    }

    const env = c.env as any;

    const prompt = `Analyze the following text for ${analysis_type} analysis:

${context ? `Context: ${context}\n\n` : ''}Text: ${text}

Provide a comprehensive analysis including:
1. Key insights and patterns
2. Sentiment analysis
3. Risk assessment (if applicable)
4. Recommendations
5. Confidence score

Format as JSON with clear structure.`;

    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1000
    });

    if (!response?.response) {
      throw new Error('AI model response failed');
    }

    let analysis;
    try {
      analysis = JSON.parse(response.response);
    } catch {
      analysis = {
        insights: response.response,
        sentiment: 'neutral',
        confidence: 0.7,
        recommendations: []
      };
    }

    return c.json({
      success: true,
      data: {
        analysis,
        model: '@cf/meta/llama-3.1-8b-instruct',
        processed_at: new Date().toISOString()
      },
      meta: {
        request_id: c.get('requestId'),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('AI analysis failed:', error);
    return c.json({
      success: false,
      error: {
        code: 'AI_ANALYSIS_FAILED',
        message: 'Failed to analyze text'
      }
    }, 500);
  }
});

// RAG Query Endpoint
ai.post('/rag/query', async (c) => {
  try {
    const { query, organization_id, filters = {}, max_results = 5 } = await c.req.json();

    if (!query || !organization_id) {
      return c.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Query and organization_id are required'
        }
      }, 400);
    }

    const env = c.env as any;

    // Generate embedding for query
    const embeddingResponse = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: [query]
    });

    if (!embeddingResponse?.data?.[0]) {
      throw new Error('Failed to generate query embedding');
    }

    const queryEmbedding = embeddingResponse.data[0];

    // Search vector database
    const vectorResults = await env.RAG_EMBEDDINGS.query(queryEmbedding, {
      topK: max_results,
      namespace: `org_${organization_id}`,
      includeMetadata: true,
      filter: filters
    });

    // Get full documents for matches
    const documents = [];
    for (const match of vectorResults.matches) {
      const docKey = `knowledge:${organization_id}:${match.id}`;
      const document = await env.AGENT_MEMORY.get(docKey);
      if (document) {
        documents.push({
          ...JSON.parse(document),
          similarity: match.score
        });
      }
    }

    // Generate response using retrieved documents
    const contextText = documents.map(doc => doc.content).join('\n\n');

    const ragPrompt = `Based on the following context, answer the user's question:

Context:
${contextText}

Question: ${query}

Provide a comprehensive answer with citations to the source material. If the context doesn't contain enough information, indicate that clearly.

Format as JSON with:
{
  "answer": "detailed answer",
  "sources": [{"title": "source", "snippet": "relevant excerpt", "similarity": 0.95}],
  "confidence": 0.9,
  "related_topics": ["topic1", "topic2"]
}`;

    const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: ragPrompt }],
      temperature: 0.2,
      max_tokens: 1500
    });

    let ragResponse;
    try {
      ragResponse = JSON.parse(aiResponse.response);
    } catch {
      ragResponse = {
        answer: aiResponse.response,
        sources: documents.map(doc => ({
          title: doc.title,
          snippet: doc.content.substring(0, 200) + '...',
          similarity: doc.similarity
        })),
        confidence: 0.7,
        related_topics: []
      };
    }

    return c.json({
      success: true,
      data: {
        query,
        answer: ragResponse,
        retrieved_documents: documents,
        model: '@cf/meta/llama-3.1-8b-instruct',
        processed_at: new Date().toISOString()
      },
      meta: {
        request_id: c.get('requestId'),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('RAG query failed:', error);
    return c.json({
      success: false,
      error: {
        code: 'RAG_QUERY_FAILED',
        message: 'Failed to process RAG query'
      }
    }, 500);
  }
});

// Agent Communication Endpoint
ai.post('/agent/:agentType', async (c) => {
  try {
    const agentType = c.req.param('agentType');
    const { command, parameters = {}, user_context } = await c.req.json();

    if (!command) {
      return c.json({
        success: false,
        error: {
          code: 'INVALID_COMMAND',
          message: 'Command is required'
        }
      }, 400);
    }

    const validAgents = ['billing', 'compliance', 'intelligence', 'risk', 'orchestrator'];
    if (!validAgents.includes(agentType)) {
      return c.json({
        success: false,
        error: {
          code: 'INVALID_AGENT',
          message: `Invalid agent type. Must be one of: ${validAgents.join(', ')}`
        }
      }, 400);
    }

    const env = c.env as any;

    // Create agent task
    const task = {
      id: crypto.randomUUID(),
      agent_type: agentType,
      command,
      parameters,
      user_context,
      created_at: new Date().toISOString(),
      status: 'pending'
    };

    // Store task for agent processing
    await env.AGENT_MEMORY.put(
      `agent_task:${task.id}`,
      JSON.stringify(task),
      { expirationTtl: 24 * 60 * 60 }
    );

    // Queue task for agent
    if (env.AI_PROCESSING_QUEUE) {
      await env.AI_PROCESSING_QUEUE.send({
        type: 'agent_task',
        taskId: task.id,
        agentType,
        timestamp: new Date().toISOString()
      });
    }

    return c.json({
      success: true,
      data: {
        task_id: task.id,
        agent_type: agentType,
        status: 'queued',
        message: 'Task queued for processing'
      },
      meta: {
        request_id: c.get('requestId'),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Agent communication failed:', error);
    return c.json({
      success: false,
      error: {
        code: 'AGENT_COMMUNICATION_FAILED',
        message: 'Failed to communicate with agent'
      }
    }, 500);
  }
});

ai.get('/agent/:agentType/task/:taskId', async (c) => {
  try {
    const agentType = c.req.param('agentType');
    const taskId = c.req.param('taskId');
    const env = c.env as any;

    // Get task status
    const taskData = await env.AGENT_MEMORY.get(`agent_task:${taskId}`);
    if (!taskData) {
      return c.json({
        success: false,
        error: {
          code: 'TASK_NOT_FOUND',
          message: 'Task not found'
        }
      }, 404);
    }

    const task = JSON.parse(taskData);

    return c.json({
      success: true,
      data: task,
      meta: {
        request_id: c.get('requestId'),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Task status check failed:', error);
    return c.json({
      success: false,
      error: {
        code: 'TASK_STATUS_CHECK_FAILED',
        message: 'Failed to check task status'
      }
    }, 500);
  }
});

export { ai as aiRoutes };