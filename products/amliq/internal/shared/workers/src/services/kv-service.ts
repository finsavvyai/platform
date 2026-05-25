/**
 * AI-Enhanced KV Storage Service
 * Revolutionary caching, session management, and agent memory with intelligent optimization
 */

import type { Env, User, Organization, ProductContext, AgentMemory, AgentTask } from '../types';

export interface KVCacheOptions {
  ttl?: number;
  tags?: string[];
  aiCompress?: boolean;
  aiOptimize?: boolean;
}

export interface SessionData {
  user: User;
  organization: Organization;
  productContext: ProductContext;
  permissions: string[];
  lastActivity: string;
  aiContext?: any;
  conversationHistory?: any[];
  preferences?: any;
}

export interface AgentMemoryConfig {
  shortTermTTL?: number; // 1 hour
  longTermTTL?: number; // 30 days
  contextTTL?: number; // 24 hours
  learningTTL?: number; // 90 days
  compressLongTerm?: boolean;
  aiOrganize?: boolean;
}

export class KVService {
  private env: Env;
  private aiEnabled: boolean;
  private defaultConfig: AgentMemoryConfig;

  constructor(env: Env) {
    this.env = env;
    this.aiEnabled = env.ENVIRONMENT !== 'development' || true; // AI enabled in all environments
    this.defaultConfig = {
      shortTermTTL: 3600, // 1 hour
      longTermTTL: 30 * 24 * 3600, // 30 days
      contextTTL: 24 * 3600, // 24 hours
      learningTTL: 90 * 24 * 3600, // 90 days
      compressLongTerm: true,
      aiOrganize: true
    };
  }

  // AI-Enhanced Cache Operations
  async cache<T = any>(
    key: string,
    value: T,
    options: KVCacheOptions = {}
  ): Promise<boolean> {
    try {
      const {
        ttl = 3600, // 1 hour default
        tags = [],
        aiCompress = true,
        aiOptimize = true
      } = options;

      let processedValue = value;

      // AI compression for large objects
      if (aiCompress && this.aiEnabled && JSON.stringify(value).length > 1024) {
        processedValue = await this.aiCompress(value);
      }

      // AI optimization for cache structure
      if (aiOptimize && this.aiEnabled) {
        processedValue = await this.optimizeForCache(processedValue, key);
      }

      const cacheData = {
        value: processedValue,
        tags,
        created_at: new Date().toISOString(),
        ai_processed: aiCompress || aiOptimize,
        original_size: JSON.stringify(value).length,
        compressed_size: JSON.stringify(processedValue).length
      };

      await this.env.CACHE.put(key, JSON.stringify(cacheData), { expirationTtl: ttl });

      // Store tag associations for intelligent cache invalidation
      if (tags.length > 0) {
        await this.storeTagAssociations(key, tags);
      }

      return true;
    } catch (error) {
      console.error('Cache operation failed:', error);
      return false;
    }
  }

  async getCache<T = any>(key: string): Promise<T | null> {
    try {
      const cached = await this.env.CACHE.get(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      let value = cacheData.value;

      // AI decompression if needed
      if (cacheData.ai_processed) {
        value = await this.aiDecompress(value);
      }

      return value as T;
    } catch (error) {
      console.error('Cache get operation failed:', error);
      return null;
    }
  }

  async invalidateCache(pattern: string | string[]): Promise<number> {
    try {
      const patterns = Array.isArray(pattern) ? pattern : [pattern];
      let invalidatedCount = 0;

      for (const patternStr of patterns) {
        // Simple pattern matching (can be enhanced with more sophisticated pattern matching)
        const list = await this.env.CACHE.list();
        for (const key of list.keys) {
          if (key.name.includes(patternStr)) {
            await this.env.CACHE.delete(key.name);
            invalidatedCount++;
          }
        }
      }

      return invalidatedCount;
    } catch (error) {
      console.error('Cache invalidation failed:', error);
      return 0;
    }
  }

  async invalidateByTag(tag: string): Promise<number> {
    try {
      const tagKey = `tag:${tag}`;
      const keys = await this.env.CACHE.get(tagKey);
      if (!keys) return 0;

      const keyList = JSON.parse(keys);
      let invalidatedCount = 0;

      for (const key of keyList) {
        await this.env.CACHE.delete(key);
        invalidatedCount++;
      }

      // Clean up tag association
      await this.env.CACHE.delete(tagKey);

      return invalidatedCount;
    } catch (error) {
      console.error('Tag-based cache invalidation failed:', error);
      return 0;
    }
  }

  // AI-Enhanced Session Management
  async createSession(
    sessionId: string,
    sessionData: SessionData,
    ttl: number = 24 * 3600 // 24 hours
  ): Promise<boolean> {
    try {
      const enhancedSessionData = {
        ...sessionData,
        session_id: sessionId,
        created_at: new Date().toISOString(),
        ai_enhancements: {
          predicted_behavior: await this.predictUserBehavior(sessionData),
          recommended_actions: await this.getRecommendedActions(sessionData),
          personalization_profile: await this.buildPersonalizationProfile(sessionData)
        }
      };

      await this.env.SESSIONS.put(
        `session:${sessionId}`,
        JSON.stringify(enhancedSessionData),
        { expirationTtl: ttl }
      );

      // Store session index for user lookup
      await this.env.SESSIONS.put(
        `user_sessions:${sessionData.user.id}`,
        JSON.stringify({
          session_id: sessionId,
          created_at: enhancedSessionData.created_at,
          product_context: sessionData.productContext
        }),
        { expirationTtl: ttl }
      );

      return true;
    } catch (error) {
      console.error('Session creation failed:', error);
      return false;
    }
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const session = await this.env.SESSIONS.get(`session:${sessionId}`);
      if (!session) return null;

      const sessionData = JSON.parse(session);

      // Update last activity
      sessionData.lastActivity = new Date().toISOString();
      await this.env.SESSIONS.put(
        `session:${sessionId}`,
        JSON.stringify(sessionData),
        { expirationTtl: 24 * 3600 }
      );

      return sessionData;
    } catch (error) {
      console.error('Session retrieval failed:', error);
      return null;
    }
  }

  async updateSession(sessionId: string, updates: Partial<SessionData>): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) return false;

      const updatedSession = {
        ...session,
        ...updates,
        lastActivity: new Date().toISOString()
      };

      await this.env.SESSIONS.put(
        `session:${sessionId}`,
        JSON.stringify(updatedSession),
        { expirationTtl: 24 * 3600 }
      );

      return true;
    } catch (error) {
      console.error('Session update failed:', error);
      return false;
    }
  }

  async destroySession(sessionId: string): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      if (session) {
        // Clean up user session index
        await this.env.SESSIONS.delete(`user_sessions:${session.user.id}`);
      }

      await this.env.SESSIONS.delete(`session:${sessionId}`);
      return true;
    } catch (error) {
      console.error('Session destruction failed:', error);
      return false;
    }
  }

  async getUserSessions(userId: string): Promise<string[]> {
    try {
      const userSessions = await this.env.SESSIONS.get(`user_sessions:${userId}`);
      return userSessions ? [JSON.parse(userSessions).session_id] : [];
    } catch (error) {
      console.error('User sessions retrieval failed:', error);
      return [];
    }
  }

  // AI-Enhanced Agent Memory Management
  async storeAgentMemory(
    agentId: string,
    memoryType: 'short_term' | 'long_term' | 'context' | 'learning',
    data: any,
    config: Partial<AgentMemoryConfig> = {}
  ): Promise<boolean> {
    try {
      const finalConfig = { ...this.defaultConfig, ...config };
      const ttl = this.getMemoryTTL(memoryType, finalConfig);

      let processedData = data;

      // AI organization and compression for long-term memory
      if (memoryType === 'long_term' && this.aiEnabled && finalConfig.aiOrganize) {
        processedData = await this.aiOrganizeMemory(data);
      }

      if (finalConfig.compressLongTerm && memoryType === 'long_term') {
        processedData = await this.aiCompress(processedData);
      }

      const memoryEntry = {
        type: memoryType,
        data: processedData,
        created_at: new Date().toISOString(),
        agent_id: agentId,
        ai_processed: finalConfig.aiOrganize || finalConfig.compressLongTerm,
        importance_score: await this.calculateImportanceScore(data, agentId),
        tags: await this.generateMemoryTags(data, agentId)
      };

      const key = `agent_memory:${agentId}:${memoryType}:${Date.now()}:${crypto.randomUUID()}`;
      await this.env.AGENT_MEMORY.put(key, JSON.stringify(memoryEntry), { expirationTtl: ttl });

      // Update memory index for efficient retrieval
      await this.updateMemoryIndex(agentId, memoryType, key, memoryEntry);

      return true;
    } catch (error) {
      console.error('Agent memory storage failed:', error);
      return false;
    }
  }

  async getAgentMemory(
    agentId: string,
    memoryType?: 'short_term' | 'long_term' | 'context' | 'learning',
    limit: number = 50
  ): Promise<any[]> {
    try {
      const indexKey = `agent_memory_index:${agentId}${memoryType ? `:${memoryType}` : ''}`;
      const index = await this.env.AGENT_MEMORY.get(indexKey);

      if (!index) return [];

      const memoryKeys = JSON.parse(index).slice(0, limit);
      const memories = [];

      for (const key of memoryKeys) {
        const memory = await this.env.AGENT_MEMORY.get(key);
        if (memory) {
          const memoryData = JSON.parse(memory);

          // AI decompression if needed
          if (memoryData.ai_processed) {
            memoryData.data = await this.aiDecompress(memoryData.data);
          }

          memories.push(memoryData);
        }
      }

      return memories.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } catch (error) {
      console.error('Agent memory retrieval failed:', error);
      return [];
    }
  }

  async searchAgentMemory(
    agentId: string,
    query: string,
    memoryType?: 'short_term' | 'long_term' | 'context' | 'learning'
  ): Promise<any[]> {
    try {
      const memories = await this.getAgentMemory(agentId, memoryType, 100);

      if (!this.aiEnabled) {
        // Simple text search fallback
        return memories.filter(memory =>
          JSON.stringify(memory.data).toLowerCase().includes(query.toLowerCase())
        );
      }

      // AI-powered semantic search
      const relevantMemories = [];
      for (const memory of memories) {
        const relevanceScore = await this.calculateSemanticRelevance(query, memory.data);
        if (relevanceScore > 0.5) {
          relevantMemories.push({
            ...memory,
            relevance_score: relevanceScore
          });
        }
      }

      return relevantMemories.sort((a, b) => b.relevance_score - a.relevance_score);
    } catch (error) {
      console.error('Agent memory search failed:', error);
      return [];
    }
  }

  async clearAgentMemory(
    agentId: string,
    memoryType?: 'short_term' | 'long_term' | 'context' | 'learning'
  ): Promise<number> {
    try {
      const memories = await this.getAgentMemory(agentId, memoryType);
      let clearedCount = 0;

      for (const memory of memories) {
        const key = `agent_memory:${agentId}:${memory.type}:${Date.now()}`;
        await this.env.AGENT_MEMORY.delete(key);
        clearedCount++;
      }

      // Clear memory index
      const indexKey = `agent_memory_index:${agentId}${memoryType ? `:${memoryType}` : ''}`;
      await this.env.AGENT_MEMORY.delete(indexKey);

      return clearedCount;
    } catch (error) {
      console.error('Agent memory clearing failed:', error);
      return 0;
    }
  }

  // AI Learning and Adaptation
  async storeLearningData(
    agentId: string,
    lesson: any,
    config: { importance?: number; tags?: string[] } = {}
  ): Promise<boolean> {
    try {
      const learningData = {
        agent_id: agentId,
        lesson: lesson,
        importance: config.importance || await this.calculateLessonImportance(lesson),
        tags: config.tags || await this.generateLessonTags(lesson),
        created_at: new Date().toISOString(),
        applied_count: 0,
        effectiveness_score: 0.0,
        feedback_history: []
      };

      const key = `agent_learning:${agentId}:${Date.now()}:${crypto.randomUUID()}`;
      await this.env.AGENT_MEMORY.put(key, JSON.stringify(learningData), {
        expirationTtl: this.defaultConfig.learningTTL
      });

      // Update learning index
      await this.updateLearningIndex(agentId, key, learningData);

      return true;
    } catch (error) {
      console.error('Learning data storage failed:', error);
      return false;
    }
  }

  async getLearningData(
    agentId: string,
    limit: number = 20
  ): Promise<any[]> {
    try {
      const indexKey = `agent_learning_index:${agentId}`;
      const index = await this.env.AGENT_MEMORY.get(indexKey);

      if (!index) return [];

      const learningKeys = JSON.parse(index).slice(0, limit);
      const learningData = [];

      for (const key of learningKeys) {
        const data = await this.env.AGENT_MEMORY.get(key);
        if (data) {
          learningData.push(JSON.parse(data));
        }
      }

      return learningData.sort((a, b) => b.importance - a.importance);
    } catch (error) {
      console.error('Learning data retrieval failed:', error);
      return [];
    }
  }

  async applyLearning(
    agentId: string,
    lessonId: string,
    outcome: 'success' | 'partial' | 'failure',
    feedback?: string
  ): Promise<boolean> {
    try {
      // Update learning effectiveness
      const learningData = await this.getLearningData(agentId, 50);
      const lesson = learningData.find(l => l.id === lessonId);

      if (lesson) {
        lesson.applied_count++;
        lesson.feedback_history.push({
          outcome,
          feedback,
          applied_at: new Date().toISOString()
        });

        // Calculate new effectiveness score
        lesson.effectiveness_score = this.calculateEffectivenessScore(lesson.feedback_history);

        // Store updated lesson
        const key = `agent_learning:${agentId}:${lessonId}`;
        await this.env.AGENT_MEMORY.put(key, JSON.stringify(lesson));
      }

      return true;
    } catch (error) {
      console.error('Learning application failed:', error);
      return false;
    }
  }

  // Private helper methods
  private async aiCompress(data: any): Promise<any> {
    try {
      if (!this.aiEnabled) return data;

      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{
          role: 'user',
          content: `Compress and optimize this JSON data for storage while preserving all essential information:
          ${JSON.stringify(data)}

          Return a valid JSON object with the same structure but optimized for size.`
        }],
        temperature: 0.1,
        max_tokens: 1000
      });

      return response?.response ? JSON.parse(response.response) : data;
    } catch (error) {
      console.error('AI compression failed:', error);
      return data;
    }
  }

  private async aiDecompress(data: any): Promise<any> {
    // If data was AI compressed, it might need reconstruction
    // For now, return as-is since compression maintains structure
    return data;
  }

  private async optimizeForCache(data: any, key: string): Promise<any> {
    try {
      if (!this.aiEnabled) return data;

      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{
          role: 'user',
          content: `Optimize this data for caching with key "${key}":
          ${JSON.stringify(data)}

          Reorganize the structure to improve cache hit rates and access patterns while maintaining all data.`
        }],
        temperature: 0.1,
        max_tokens: 1000
      });

      return response?.response ? JSON.parse(response.response) : data;
    } catch (error) {
      console.error('AI cache optimization failed:', error);
      return data;
    }
  }

  private async storeTagAssociations(key: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      const tagKey = `tag:${tag}`;
      const existingKeys = await this.env.CACHE.get(tagKey);
      const keyList = existingKeys ? JSON.parse(existingKeys) : [];

      if (!keyList.includes(key)) {
        keyList.push(key);
        await this.env.CACHE.put(tagKey, JSON.stringify(keyList));
      }
    }
  }

  private async predictUserBehavior(sessionData: SessionData): Promise<any> {
    if (!this.aiEnabled) return null;

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{
          role: 'user',
          content: `Based on this user session data, predict likely next actions and behavior:
          ${JSON.stringify(sessionData)}

          Return JSON with: likely_actions (array), session_duration_estimate (minutes), friction_points (array)`
        }],
        temperature: 0.2,
        max_tokens: 300
      });

      return response?.response ? JSON.parse(response.response) : null;
    } catch (error) {
      console.error('User behavior prediction failed:', error);
      return null;
    }
  }

  private async getRecommendedActions(sessionData: SessionData): Promise<string[]> {
    if (!this.aiEnabled) return [];

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{
          role: 'user',
          content: `Based on this user session data, recommend 3-5 specific actions to improve their experience:
          ${JSON.stringify(sessionData)}

          Return a JSON array of recommended actions as strings.`
        }],
        temperature: 0.3,
        max_tokens: 200
      });

      return response?.response ? JSON.parse(response.response) : [];
    } catch (error) {
      console.error('Recommended actions generation failed:', error);
      return [];
    }
  }

  private async buildPersonalizationProfile(sessionData: SessionData): Promise<any> {
    if (!this.aiEnabled) return null;

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{
          role: 'user',
          content: `Create a personalization profile from this session data:
          ${JSON.stringify(sessionData)}

          Return JSON with: preferences (object), communication_style (string), expertise_level (string), feature_usage (object)`
        }],
        temperature: 0.2,
        max_tokens: 400
      });

      return response?.response ? JSON.parse(response.response) : null;
    } catch (error) {
      console.error('Personalization profile creation failed:', error);
      return null;
    }
  }

  private getMemoryTTL(memoryType: string, config: AgentMemoryConfig): number {
    switch (memoryType) {
      case 'short_term': return config.shortTermTTL || 3600;
      case 'long_term': return config.longTermTTL || 30 * 24 * 3600;
      case 'context': return config.contextTTL || 24 * 3600;
      case 'learning': return config.learningTTL || 90 * 24 * 3600;
      default: return 3600;
    }
  }

  private async aiOrganizeMemory(data: any): Promise<any> {
    if (!this.aiEnabled) return data;

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{
          role: 'user',
          content: `Organize and structure this memory data for long-term storage and retrieval:
          ${JSON.stringify(data)}

          Reorganize with clear categories, tags, and hierarchical structure while preserving all information.`
        }],
        temperature: 0.1,
        max_tokens: 1000
      });

      return response?.response ? JSON.parse(response.response) : data;
    } catch (error) {
      console.error('AI memory organization failed:', error);
      return data;
    }
  }

  private async calculateImportanceScore(data: any, agentId: string): Promise<number> {
    if (!this.aiEnabled) return 0.5;

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{
          role: 'user',
          content: `Rate the importance of this memory data for agent ${agentId} on a scale of 0.0 to 1.0:
          ${JSON.stringify(data)}

          Return only a number (e.g., 0.75). Consider factors like: complexity, uniqueness, potential for future use, learning value.`
        }],
        temperature: 0.1,
        max_tokens: 10
      });

      const score = parseFloat(response?.response || '0.5');
      return Math.max(0.0, Math.min(1.0, score));
    } catch (error) {
      console.error('Importance score calculation failed:', error);
      return 0.5;
    }
  }

  private async generateMemoryTags(data: any, agentId: string): Promise<string[]> {
    if (!this.aiEnabled) return [];

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{
          role: 'user',
          content: `Generate 3-5 relevant tags for this memory data:
          ${JSON.stringify(data)}

          Return a JSON array of tag strings (e.g., ["customer_service", "payment_issue", "resolved"]).`
        }],
        temperature: 0.2,
        max_tokens: 100
      });

      return response?.response ? JSON.parse(response.response) : [];
    } catch (error) {
      console.error('Memory tag generation failed:', error);
      return [];
    }
  }

  private async updateMemoryIndex(agentId: string, memoryType: string, key: string, memoryEntry: any): Promise<void> {
    const indexKey = `agent_memory_index:${agentId}:${memoryType}`;
    const existingIndex = await this.env.AGENT_MEMORY.get(indexKey);
    const index = existingIndex ? JSON.parse(existingIndex) : [];

    index.unshift(key);

    // Keep only the most recent 100 entries
    const trimmedIndex = index.slice(0, 100);

    await this.env.AGENT_MEMORY.put(indexKey, JSON.stringify(trimmedIndex));
  }

  private async updateLearningIndex(agentId: string, key: string, learningData: any): Promise<void> {
    const indexKey = `agent_learning_index:${agentId}`;
    const existingIndex = await this.env.AGENT_MEMORY.get(indexKey);
    const index = existingIndex ? JSON.parse(existingIndex) : [];

    index.unshift(key);

    // Keep only the most recent 50 entries
    const trimmedIndex = index.slice(0, 50);

    await this.env.AGENT_MEMORY.put(indexKey, JSON.stringify(trimmedIndex));
  }

  private async calculateSemanticRelevance(query: string, data: any): Promise<number> {
    if (!this.aiEnabled) return 0.5;

    try {
      const response = await this.env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: [query, JSON.stringify(data)]
      });

      if (response?.data?.shape?.[0] === 2) {
        // Calculate cosine similarity between query and data embeddings
        const [queryEmbedding, dataEmbedding] = response.data.data;

        let dotProduct = 0;
        let queryMagnitude = 0;
        let dataMagnitude = 0;

        for (let i = 0; i < queryEmbedding.length; i++) {
          dotProduct += queryEmbedding[i] * dataEmbedding[i];
          queryMagnitude += queryEmbedding[i] * queryEmbedding[i];
          dataMagnitude += dataEmbedding[i] * dataEmbedding[i];
        }

        return dotProduct / (Math.sqrt(queryMagnitude) * Math.sqrt(dataMagnitude));
      }

      return 0.5;
    } catch (error) {
      console.error('Semantic relevance calculation failed:', error);
      return 0.5;
    }
  }

  private async calculateLessonImportance(lesson: any): Promise<number> {
    if (!this.aiEnabled) return 0.5;

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{
          role: 'user',
          content: `Rate the importance of this learning lesson on a scale of 0.0 to 1.0:
          ${JSON.stringify(lesson)}

          Consider: potential impact, generalizability, complexity, and improvement potential. Return only a number.`
        }],
        temperature: 0.1,
        max_tokens: 10
      });

      const score = parseFloat(response?.response || '0.5');
      return Math.max(0.0, Math.min(1.0, score));
    } catch (error) {
      console.error('Lesson importance calculation failed:', error);
      return 0.5;
    }
  }

  private async generateLessonTags(lesson: any): Promise<string[]> {
    if (!this.aiEnabled) return [];

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{
          role: 'user',
          content: `Generate 3-5 tags for this learning lesson:
          ${JSON.stringify(lesson)}

          Return a JSON array of tag strings.`
        }],
        temperature: 0.2,
        max_tokens: 100
      });

      return response?.response ? JSON.parse(response.response) : [];
    } catch (error) {
      console.error('Lesson tag generation failed:', error);
      return [];
    }
  }

  private calculateEffectivenessScore(feedbackHistory: any[]): number {
    if (feedbackHistory.length === 0) return 0.0;

    const weights = { success: 1.0, partial: 0.5, failure: 0.0 };
    let totalScore = 0;

    for (const feedback of feedbackHistory) {
      totalScore += weights[feedback.outcome] || 0.0;
    }

    return totalScore / feedbackHistory.length;
  }
}