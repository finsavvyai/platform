/**
 * Revolutionary AI Enhancement Middleware
 * Intelligent request processing with autonomous agent orchestration and learning
 */

import type { Context, Next } from 'hono';
import type { Env, User, ProductContext, AgentTask, AgentResponse } from '../types';

export interface AIMiddlewareOptions {
  enableAI?: boolean;
  enableAgentOrchestration?: boolean;
  enableLearning?: boolean;
  enablePersonalization?: boolean;
  enablePreprocessing?: boolean;
  enablePostprocessing?: boolean;
  modelConfig?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
  customPrompts?: Record<string, string>;
  agentRouting?: (c: Context) => Promise<string[]>;
}

export interface AIContext {
  enabled: boolean;
  modelAvailable: boolean;
  processingTime: number;
  confidence: number;
  suggestions: string[];
  preprocessed?: any;
  postprocessed?: any;
  agentTasks?: AgentTask[];
  personalizedFeatures?: PersonalizedFeatures;
}

export interface PersonalizedFeatures {
  preferredLanguage: string;
  responseStyle: 'concise' | 'detailed' | 'technical' | 'simple';
  uiPreferences: Record<string, any>;
  workflowOptimizations: string[];
  adaptiveHelp: boolean;
}

export interface RequestAnalysis {
  category: string;
  intent: string;
  complexity: 'low' | 'medium' | 'high';
  entities: Array<{
    type: string;
    value: string;
    confidence: number;
  }>;
  sentiment?: 'positive' | 'negative' | 'neutral';
  urgency: 'low' | 'medium' | 'high';
  suggestedActions: string[];
}

export function AIMiddleware(options: AIMiddlewareOptions = {}) {
  const {
    enableAI = true,
    enableAgentOrchestration = true,
    enableLearning = true,
    enablePersonalization = true,
    enablePreprocessing = true,
    enablePostprocessing = true,
    modelConfig = {
      model: '@cf/meta/llama-3.1-8b-instruct',
      temperature: 0.3,
      maxTokens: 2000
    },
    customPrompts = {},
    agentRouting
  } = options;

  return async (c: Context, next: Next) => {
    const startTime = Date.now();
    const productContext = c.get('productContext') as ProductContext;
    const user = c.get('user') as User | undefined;

    // Initialize AI context
    const aiContext: AIContext = {
      enabled: enableAI && !!c.env.AI,
      modelAvailable: false,
      processingTime: 0,
      confidence: 0,
      suggestions: []
    };

    try {
      // Check AI availability
      if (aiContext.enabled) {
        aiContext.modelAvailable = await checkAIAvailability(c.env);
      }

      if (!aiContext.modelAvailable) {
        c.set('aiContext', aiContext);
        await next();
        return;
      }

      // AI Preprocessing
      if (enablePreprocessing) {
        aiContext.preprocessed = await performAIPreprocessing(c, user, productContext);
      }

      // Personalization
      if (enablePersonalization && user) {
        aiContext.personalizedFeatures = await getPersonalizedFeatures(user.id, c);
      }

      // Request Analysis
      const requestAnalysis = await analyzeRequest(c, aiContext, productContext);

      // Agent Orchestration
      if (enableAgentOrchestration && requestAnalysis.suggestedActions.length > 0) {
        aiContext.agentTasks = await orchestrateAgents(c, requestAnalysis, user);
      }

      // AI Enhancement
      const aiEnhancements = await generateAIEnhancements(c, requestAnalysis, aiContext);
      aiContext.suggestions = aiEnhancements.suggestions;
      aiContext.confidence = aiEnhancements.confidence;

      // Set AI context for downstream handlers
      c.set('aiContext', aiContext);
      c.set('requestAnalysis', requestAnalysis);
      c.set('aiEnhancements', aiEnhancements);

      await next();

      // AI Postprocessing
      if (enablePostprocessing) {
        aiContext.postprocessed = await performAIPostprocessing(c, aiContext, requestAnalysis);
      }

      // Learning and Analytics
      if (enableLearning) {
        await updateAILearning(c, aiContext, requestAnalysis);
      }

      aiContext.processingTime = Date.now() - startTime;

    } catch (error) {
      console.error('AI Middleware error:', error);
      aiContext.enabled = false;
      aiContext.processingTime = Date.now() - startTime;
      c.set('aiContext', aiContext);
      await next();
    }
  };
}

async function checkAIAvailability(env: Env): Promise<boolean> {
  try {
    const testResponse = await env.AI.run(modelConfig.model, {
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 10
    });
    return !!testResponse?.response;
  } catch (error) {
    console.error('AI availability check failed:', error);
    return false;
  }
}

async function performAIPreprocessing(
  c: Context,
  user?: User,
  productContext?: ProductContext
): Promise<any> {
  try {
    const url = new URL(c.req.url);
    const method = c.req.method;
    const body = await tryParseRequestBody(c);

    const preprocessingPrompt = customPrompts.preprocess || `
    Analyze this ${productContext?.product} API request for preprocessing:

    Method: ${method}
    Path: ${url.pathname}
    Query: ${url.searchParams.toString()}
    Body: ${JSON.stringify(body, null, 2)}
    User Role: ${user?.role || 'anonymous'}
    Product: ${productContext?.product}

    Provide JSON response with:
    {
      "requestType": "type_of_request",
      "complexity": "low|medium|high",
      "requiredData": ["list", "of", "required", "fields"],
      "validationRules": ["validation", "rules"],
      "optimizationSuggestions": ["suggestions"],
      "securityFlags": ["potential", "security", "concerns"]
    }`;

    const response = await c.env.AI.run(modelConfig.model, {
      messages: [{ role: 'user', content: preprocessingPrompt }],
      temperature: 0.1,
      max_tokens: 500
    });

    if (response?.response) {
      return JSON.parse(response.response);
    }
  } catch (error) {
    console.error('AI preprocessing failed:', error);
  }

  return null;
}

async function analyzeRequest(
  c: Context,
  aiContext: AIContext,
  productContext: ProductContext
): Promise<RequestAnalysis> {
  try {
    const url = new URL(c.req.url);
    const method = c.req.method;
    const userAgent = c.req.header('User-Agent') || '';
    const body = await tryParseRequestBody(c);

    const analysisPrompt = customPrompts.analyze || `
    Analyze this ${productContext.product} request for AI enhancement:

    Request Details:
    - Method: ${method}
    - Path: ${url.pathname}
    - Query Parameters: ${url.searchParams.toString()}
    - Request Body: ${JSON.stringify(body, null, 2)}
    - User Agent: ${userAgent}
    - Product Context: ${productContext.product}
    - User Preferences: ${JSON.stringify(aiContext.personalizedFeatures || {})}

    Provide detailed analysis in JSON format:
    {
      "category": "api|data|query|automation|compliance|billing|risk",
      "intent": "what_the_user_is_trying_to_accomplish",
      "complexity": "low|medium|high",
      "entities": [
        {"type": "invoice|customer|transaction|user|organization", "value": "extracted_value", "confidence": 0.8}
      ],
      "sentiment": "positive|negative|neutral",
      "urgency": "low|medium|high",
      "suggestedActions": ["action1", "action2", "action3"]
    }`;

    const response = await c.env.AI.run(modelConfig.model, {
      messages: [{ role: 'user', content: analysisPrompt }],
      temperature: 0.2,
      max_tokens: 1000
    });

    if (response?.response) {
      const analysis = JSON.parse(response.response);

      // Enhance with product-specific analysis
      return await enhanceAnalysisWithProductContext(analysis, productContext, c);
    }
  } catch (error) {
    console.error('Request analysis failed:', error);
  }

  // Fallback basic analysis
  return {
    category: 'api',
    intent: 'process request',
    complexity: 'medium',
    entities: [],
    urgency: 'medium',
    suggestedActions: []
  };
}

async function enhanceAnalysisWithProductContext(
  analysis: RequestAnalysis,
  productContext: ProductContext,
  c: Context
): Promise<RequestAnalysis> {
  try {
    const url = new URL(c.req.url);

    // Product-specific enhancements
    switch (productContext.product) {
      case 'smart-billing':
        if (url.pathname.includes('/invoice')) {
          analysis.category = 'billing';
          analysis.suggestedActions.push('validate_invoice_data', 'check_customer_credit', 'suggest_payment_terms');
        }
        break;

      case 'enterprise-compliance':
        if (url.pathname.includes('/kyc') || url.pathname.includes('/screening')) {
          analysis.category = 'compliance';
          analysis.suggestedActions.push('enhanced_document_analysis', 'risk_assessment', 'regulatory_check');
        }
        break;

      case 'financial-intelligence':
        if (url.pathname.includes('/analytics') || url.pathname.includes('/forecast')) {
          analysis.category = 'intelligence';
          analysis.suggestedActions.push('data_enrichment', 'pattern_detection', 'predictive_analysis');
        }
        break;

      case 'risk-investigator':
        if (url.pathname.includes('/risk') || url.pathname.includes('/fraud')) {
          analysis.category = 'risk';
          analysis.suggestedActions.push('behavioral_analysis', 'network_analysis', 'threat_intelligence');
        }
        break;
    }

    return analysis;
  } catch (error) {
    console.error('Product context enhancement failed:', error);
    return analysis;
  }
}

async function orchestrateAgents(
  c: Context,
  requestAnalysis: RequestAnalysis,
  user?: User
): Promise<AgentTask[]> {
  try {
    const tasks: AgentTask[] = [];

    // Determine which agents should handle this request
    const agentTypes = await determineRequiredAgents(requestAnalysis);

    for (const agentType of agentTypes) {
      const task: AgentTask = {
        id: crypto.randomUUID(),
        type: agentType,
        priority: determineTaskPriority(requestAnalysis),
        status: 'pending',
        input: {
          requestAnalysis,
          userContext: {
            userId: user?.id,
            organizationId: user?.organization_id,
            role: user?.role,
            permissions: user?.permissions
          },
          requestDetails: {
            method: c.req.method,
            path: new URL(c.req.url).pathname,
            query: Object.fromEntries(new URL(c.req.url).searchParams),
            body: await tryParseRequestBody(c)
          }
        },
        created_at: new Date().toISOString(),
        retry_count: 0,
        max_retries: 3
      };

      tasks.push(task);

      // Queue agent task for processing
      await queueAgentTask(c, task);
    }

    return tasks;
  } catch (error) {
    console.error('Agent orchestration failed:', error);
    return [];
  }
}

async function determineRequiredAgents(requestAnalysis: RequestAnalysis): Promise<string[]> {
  const agents: string[] = [];

  // Map request categories to agent types
  const categoryAgentMap = {
    'billing': ['billing'],
    'compliance': ['compliance'],
    'intelligence': ['intelligence'],
    'risk': ['risk'],
    'api': [], // Will be determined by path
    'data': ['intelligence'],
    'query': ['intelligence'],
    'automation': ['orchestrator']
  };

  const baseAgents = categoryAgentMap[requestAnalysis.category] || [];

  // Add orchestrator for complex requests
  if (requestAnalysis.complexity === 'high' || requestAnalysis.suggestedActions.length > 2) {
    baseAgents.push('orchestrator');
  }

  // Add specialized agents based on intent
  if (requestAnalysis.intent.includes('invoice') || requestAnalysis.intent.includes('payment')) {
    baseAgents.push('billing');
  }

  if (requestAnalysis.intent.includes('compliance') || requestAnalysis.intent.includes('risk')) {
    baseAgents.push('compliance');
  }

  if (requestAnalysis.intent.includes('analysis') || requestAnalysis.intent.includes('forecast')) {
    baseAgents.push('intelligence');
  }

  return [...new Set(baseAgents)]; // Remove duplicates
}

function determineTaskPriority(requestAnalysis: RequestAnalysis): 'low' | 'medium' | 'high' | 'critical' {
  if (requestAnalysis.urgency === 'high') return 'high';
  if (requestAnalysis.complexity === 'high') return 'medium';
  if (requestAnalysis.urgency === 'medium') return 'medium';
  return 'low';
}

async function queueAgentTask(c: Context, task: AgentTask): Promise<void> {
  try {
    const env = c.env as any;

    // Store task in agent memory for processing
    await env.AGENT_MEMORY.put(
      `agent_task:${task.id}`,
      JSON.stringify(task),
      { expirationTtl: 24 * 60 * 60 } // 24 hours
    );

    // Add to processing queue
    if (env.AI_PROCESSING_QUEUE) {
      await env.AI_PROCESSING_QUEUE.send({
        type: 'agent_task',
        taskId: task.id,
        agentType: task.type,
        priority: task.priority,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Failed to queue agent task:', error);
  }
}

async function generateAIEnhancements(
  c: Context,
  requestAnalysis: RequestAnalysis,
  aiContext: AIContext
): Promise<{
  suggestions: string[];
  confidence: number;
  enhancements: Record<string, any>;
}> {
  try {
    const enhancementPrompt = `
    Based on this request analysis, generate AI enhancements:

    Request Analysis: ${JSON.stringify(requestAnalysis, null, 2)}
    User Personalization: ${JSON.stringify(aiContext.personalizedFeatures || {})}

    Provide JSON response:
    {
      "suggestions": ["intelligent", "suggestions"],
      "confidence": 0.85,
      "enhancements": {
        "autoComplete": ["suggested", "completions"],
        "relatedActions": ["related", "actions"],
        "predictions": ["ai", "predictions"],
        "optimizations": ["performance", "optimizations"]
      }
    }`;

    const response = await c.env.AI.run(modelConfig.model, {
      messages: [{ role: 'user', content: enhancementPrompt }],
      temperature: 0.3,
      max_tokens: 800
    });

    if (response?.response) {
      return JSON.parse(response.response);
    }
  } catch (error) {
    console.error('AI enhancement generation failed:', error);
  }

  return {
    suggestions: [],
    confidence: 0.5,
    enhancements: {}
  };
}

async function getPersonalizedFeatures(userId: string, c: Context): Promise<PersonalizedFeatures> {
  try {
    const env = c.env as any;

    // Get user preferences from cache or agent memory
    const preferencesKey = `user_preferences:${userId}`;
    const cachedPreferences = await env.CACHE.get(preferencesKey);

    if (cachedPreferences) {
      return JSON.parse(cachedPreferences);
    }

    // Generate personalized features using AI
    const personalizationPrompt = `
    Generate personalized features for user ${userId} based on typical patterns:

    Provide JSON response:
    {
      "preferredLanguage": "en",
      "responseStyle": "concise|detailed|technical|simple",
      "uiPreferences": {
        "theme": "dark|light",
        "dataVisualization": "charts|tables|both"
      },
      "workflowOptimizations": ["optimization1", "optimization2"],
      "adaptiveHelp": true
    }`;

    const response = await env.AI.run(modelConfig.model, {
      messages: [{ role: 'user', content: personalizationPrompt }],
      temperature: 0.2,
      max_tokens: 300
    });

    let features: PersonalizedFeatures;

    if (response?.response) {
      features = JSON.parse(response.response);
    } else {
      // Default features
      features = {
        preferredLanguage: 'en',
        responseStyle: 'concise',
        uiPreferences: { theme: 'dark', dataVisualization: 'charts' },
        workflowOptimizations: [],
        adaptiveHelp: true
      };
    }

    // Cache personalized features
    await env.CACHE.put(preferencesKey, JSON.stringify(features), {
      expirationTtl: 7 * 24 * 60 * 60 // 7 days
    });

    return features;
  } catch (error) {
    console.error('Personalization failed:', error);

    // Return default features
    return {
      preferredLanguage: 'en',
      responseStyle: 'concise',
      uiPreferences: { theme: 'dark', dataVisualization: 'charts' },
      workflowOptimizations: [],
      adaptiveHelp: true
    };
  }
}

async function performAIPostprocessing(
  c: Context,
  aiContext: AIContext,
  requestAnalysis: RequestAnalysis
): Promise<any> {
  try {
    const response = c.res;
    if (!response) return null;

    const responseData = await tryParseResponse(response);

    const postprocessingPrompt = `
    Analyze and enhance this API response:

    Request Analysis: ${JSON.stringify(requestAnalysis, null, 2)}
    Response Data: ${JSON.stringify(responseData, null, 2)}
    AI Context: ${JSON.stringify(aiContext, null, 2)}

    Provide JSON response:
    {
      "responseOptimization": {
        "additionalData": ["relevant", "additional", "data"],
        "relatedResources": ["related", "resources"],
        "nextActions": ["recommended", "next", "actions"]
      },
      "qualityMetrics": {
        "completeness": 0.9,
        "accuracy": 0.95,
        "relevance": 0.88
      },
      "personalization": {
        "tailoredInsights": ["personalized", "insights"],
        "recommendations": ["user", "recommendations"]
      }
    }`;

    const aiResponse = await c.env.AI.run(modelConfig.model, {
      messages: [{ role: 'user', content: postprocessingPrompt }],
      temperature: 0.2,
      max_tokens: 600
    });

    if (aiResponse?.response) {
      return JSON.parse(aiResponse.response);
    }
  } catch (error) {
    console.error('AI postprocessing failed:', error);
  }

  return null;
}

async function updateAILearning(
  c: Context,
  aiContext: AIContext,
  requestAnalysis: RequestAnalysis
): Promise<void> {
  try {
    const env = c.env as any;
    const user = c.get('user') as User | undefined;

    const learningData = {
      timestamp: new Date().toISOString(),
      userId: user?.id,
      organizationId: user?.organization_id,
      product: c.get('productContext')?.product,
      requestAnalysis,
      aiContext: {
        processingTime: aiContext.processingTime,
        confidence: aiContext.confidence,
        suggestionsCount: aiContext.suggestions.length,
        agentTasksCount: aiContext.agentTasks?.length || 0
      },
      requestDetails: {
        method: c.req.method,
        path: new URL(c.req.url).pathname,
        responseStatus: c.res?.status
      }
    };

    // Store learning data
    const learningKey = `ai_learning:${Date.now()}:${crypto.randomUUID()}`;
    await env.AGENT_MEMORY.put(learningKey, JSON.stringify(learningData), {
      expirationTtl: 30 * 24 * 60 * 60 // 30 days
    });

    // Update model performance metrics
    await updateModelMetrics(c, learningData);

  } catch (error) {
    console.error('AI learning update failed:', error);
  }
}

async function updateModelMetrics(c: Context, learningData: any): Promise<void> {
  try {
    const env = c.env as any;

    const metricsKey = `ai_model_metrics:${new Date().toISOString().split('T')[0]}`;
    const currentMetrics = await env.AGENT_MEMORY.get(metricsKey);

    let metrics = currentMetrics ? JSON.parse(currentMetrics) : {
      totalRequests: 0,
      averageConfidence: 0,
      averageProcessingTime: 0,
      successRate: 0,
      categoryDistribution: {},
      errorCount: 0
    };

    metrics.totalRequests++;

    // Update averages
    metrics.averageConfidence = (metrics.averageConfidence * (metrics.totalRequests - 1) + learningData.aiContext.confidence) / metrics.totalRequests;
    metrics.averageProcessingTime = (metrics.averageProcessingTime * (metrics.totalRequests - 1) + learningData.aiContext.processingTime) / metrics.totalRequests;

    // Update category distribution
    const category = learningData.requestAnalysis.category;
    metrics.categoryDistribution[category] = (metrics.categoryDistribution[category] || 0) + 1;

    // Update success rate
    if (learningData.requestDetails.responseStatus && learningData.requestDetails.responseStatus < 400) {
      const successCount = metrics.successRate * (metrics.totalRequests - 1) + 1;
      metrics.successRate = successCount / metrics.totalRequests;
    } else {
      metrics.errorCount++;
    }

    await env.AGENT_MEMORY.put(metricsKey, JSON.stringify(metrics), {
      expirationTtl: 30 * 24 * 60 * 60 // 30 days
    });

  } catch (error) {
    console.error('Model metrics update failed:', error);
  }
}

// Utility functions
async function tryParseRequestBody(c: Context): Promise<any> {
  try {
    const contentType = c.req.header('content-type');
    if (contentType?.includes('application/json')) {
      return await c.req.json();
    }
    return {};
  } catch {
    return {};
  }
}

async function tryParseResponse(response: Response): Promise<any> {
  try {
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return await response.json();
    }
    return {};
  } catch {
    return {};
  }
}

// Predefined AI middleware configurations
export const createFullAIMiddleware = () => AIMiddleware({
  enableAI: true,
  enableAgentOrchestration: true,
  enableLearning: true,
  enablePersonalization: true,
  enablePreprocessing: true,
  enablePostprocessing: true
});

export const createBasicAIMiddleware = () => AIMiddleware({
  enableAI: true,
  enableAgentOrchestration: false,
  enableLearning: true,
  enablePersonalization: false,
  enablePreprocessing: true,
  enablePostprocessing: false
});

export const createAnalysisOnlyAIMiddleware = () => AIMiddleware({
  enableAI: true,
  enableAgentOrchestration: false,
  enableLearning: true,
  enablePersonalization: false,
  enablePreprocessing: true,
  enablePostprocessing: false,
  customPrompts: {
    analyze: 'Analyze this request for data patterns and insights only.'
  }
});