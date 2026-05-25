/**
 * Luna API Client
 *
 * Handles communication between the Luna plugin and the Claude Agent Platform API
 */

class LunaAPIClient {
  constructor() {
    this.baseURL = null;
    this.apiKey = null;
    this.projectId = null;
    this.initialized = false;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Initialize the API client with configuration
   */
  async initialize(config = {}) {
    try {
      // Load configuration from multiple sources
      this.baseURL = config.baseURL ||
                     process.env.LUNA_API_URL ||
                     'https://luna-rag-api-prod.broad-dew-49ad.workers.dev/api/v1';

      this.apiKey = config.apiKey ||
                  process.env.LUNA_API_KEY ||
                  this.loadStoredApiKey();

      this.projectId = config.projectId ||
                      await this.detectProjectId();

      // Validate configuration
      if (!this.baseURL) {
        throw new Error('API base URL is required');
      }

      // Test connection
      await this.testConnection();

      this.initialized = true;
      console.log('🌙 Luna API Client initialized successfully');
      console.log(`📡 Connected to: ${this.baseURL}`);
      console.log(`🏠 Project ID: ${this.projectId}`);

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Luna API Client:', error.message);
      throw error;
    }
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      const response = await this.makeRequest('GET', '/health');
      return response.status === 'healthy';
    } catch (error) {
      throw new Error(`API connection failed: ${error.message}`);
    }
  }

  /**
   * Make HTTP request with authentication
   */
  async makeRequest(method, endpoint, data = null, options = {}) {
    if (!this.initialized) {
      throw new Error('API client not initialized. Call initialize() first.');
    }

    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
      ...options.headers,
    };

    const config = {
      method,
      headers,
      ...(data && { body: JSON.stringify(data) }),
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API Error: ${response.status} - ${errorData.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`Network error: Could not connect to ${this.baseURL}`);
      }
      throw error;
    }
  }

  /**
   * Authentication methods
   */
  async login(email, password) {
    try {
      const response = await this.makeRequest('POST', '/auth/login', {
        email,
        password
      });

      if (response.accessToken) {
        this.apiKey = response.accessToken;
        this.storeApiKey(this.apiKey);

        // Store user info
        this.currentUser = response.user;
        this.storeUserData(response.user);
      }

      return response;
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async register(userData) {
    try {
      const response = await this.makeRequest('POST', '/auth/register', userData);

      if (response.accessToken) {
        this.apiKey = response.accessToken;
        this.storeApiKey(this.apiKey);
        this.currentUser = response.user;
        this.storeUserData(response.user);
      }

      return response;
    } catch (error) {
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  /**
   * Project management
   */
  async createProject(projectData) {
    return this.makeRequest('POST', '/projects', projectData);
  }

  async getProjects() {
    return this.makeRequest('GET', '/projects');
  }

  async getProject(projectId) {
    return this.makeRequest('GET', `/projects/${projectId}`);
  }

  /**
   * Agent management
   */
  async getAgents(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.makeRequest('GET', `/agents?${params}`);
  }

  async getAgent(agentId) {
    return this.makeRequest('GET', `/agents/${agentId}`);
  }

  async startAgent(agentId, options = {}) {
    return this.makeRequest('POST', `/agents/${agentId}/start`, options);
  }

  async stopAgent(agentId) {
    return this.makeRequest('POST', `/agents/${agentId}/stop`);
  }

  async getAgentHealth(agentId) {
    return this.makeRequest('GET', `/agents/${agentId}/health`);
  }

  /**
   * Task management
   */
  async createTask(taskData) {
    const payload = {
      ...taskData,
      projectId: this.projectId || taskData.projectId
    };
    return this.makeRequest('POST', '/tasks', payload);
  }

  async getTasks(filters = {}) {
    const params = new URLSearchParams({
      projectId: this.projectId,
      ...filters
    });
    return this.makeRequest('GET', `/tasks?${params}`);
  }

  async getTask(taskId) {
    return this.makeRequest('GET', `/tasks/${taskId}`);
  }

  async cancelTask(taskId) {
    return this.makeRequest('POST', `/tasks/${taskId}/cancel`);
  }

  async retryTask(taskId) {
    return this.makeRequest('POST', `/tasks/${taskId}/retry`);
  }

  /**
   * RAG (Context) management - Enhanced with comprehensive repository processing
   */
  async indexProject(indexOptions = {}) {
    const payload = {
      projectId: this.projectId,
      ...indexOptions
    };
    return this.makeRequest('POST', '/rag/index', payload);
  }

  async indexRepository(repositoryPath, options = {}) {
    const payload = {
      repositoryPath,
      projectId: this.projectId,
      filePatterns: options.filePatterns || [
        '**/*.ts',
        '**/*.js',
        '**/*.tsx',
        '**/*.jsx',
        '**/*.py',
        '**/*.java',
        '**/*.go',
        '**/*.rs',
        '**/*.cpp',
        '**/*.c',
        '**/*.md',
        '**/*.json',
        '**/*.yaml',
        '**/*.yml'
      ],
      excludePatterns: options.excludePatterns || [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/.next/**',
        '**/coverage/**'
      ],
      metadata: {
        ...options.metadata,
        projectId: this.projectId,
        indexedAt: new Date().toISOString(),
        indexingVersion: '2.0.0'
      }
    };
    return this.makeRequest('POST', '/rag/repository/index', payload);
  }

  async indexFile(filePath, content, metadata = {}) {
    const payload = {
      filePath,
      content,
      projectId: this.projectId,
      metadata: {
        ...metadata,
        projectId: this.projectId,
        indexedAt: new Date().toISOString()
      }
    };
    return this.makeRequest('POST', '/rag/file/index', payload);
  }

  async queryRAG(query, options = {}) {
    const payload = {
      query,
      projectId: this.projectId,
      maxResults: options.maxResults || 5,
      temperature: options.temperature || 0.7,
      filters: {
        ...options.filters,
        projectId: this.projectId
      },
      includeContext: options.includeContext !== false,
      includeSources: options.includeSources !== false
    };
    return this.makeRequest('POST', '/rag/query', payload);
  }

  async searchDocuments(query, options = {}) {
    const payload = {
      query,
      projectId: this.projectId,
      maxResults: options.maxResults || 10,
      filters: options.filters || {}
    };
    return this.makeRequest('POST', '/rag/search', payload);
  }

  async getRAGStatus() {
    const params = new URLSearchParams({
      projectId: this.projectId
    });
    return this.makeRequest('GET', `/rag/status?${params}`);
  }

  async getRAGStatistics() {
    const params = new URLSearchParams({
      projectId: this.projectId
    });
    return this.makeRequest('GET', `/rag/statistics?${params}`);
  }

  async deleteDocuments(documentIds) {
    const payload = {
      documentIds,
      projectId: this.projectId
    };
    return this.makeRequest('DELETE', '/rag/documents', payload);
  }

  async getConversationHistory(limit = 10) {
    const params = new URLSearchParams({
      projectId: this.projectId,
      limit: limit.toString()
    });
    return this.makeRequest('GET', `/rag/conversation/history?${params}`);
  }

  async clearConversationHistory() {
    return this.makeRequest('DELETE', '/rag/conversation/history', {
      projectId: this.projectId
    });
  }

  async getTokenUsage() {
    const params = new URLSearchParams({
      projectId: this.projectId
    });
    return this.makeRequest('GET', `/rag/tokens/usage?${params}`);
  }

  /**
   * AI generation methods
   */
  async generateText(prompt, options = {}) {
    const payload = {
      prompt,
      ...options,
      context: {
        projectId: this.projectId,
        ...options.context
      }
    };
    return this.makeRequest('POST', '/ai/generate/text', payload);
  }

  async generateImage(prompt, options = {}) {
    const payload = {
      prompt,
      ...options
    };
    return this.makeRequest('POST', '/ai/generate/image', payload);
  }

  async analyzeCode(code, analysisType, options = {}) {
    const payload = {
      code,
      analysisType,
      ...options,
      context: {
        projectId: this.projectId,
        ...options.context
      }
    };
    return this.makeRequest('POST', '/ai/analyze/code', payload);
  }

  /**
   * Utility methods
   */
  async detectProjectId() {
    try {
      // Try to detect project from current directory
      const currentDir = process.cwd();
      const projectName = currentDir.split('/').pop();

      // Check if a project with this name exists
      const projects = await this.getProjects();
      const existingProject = projects.projects?.find(p =>
        p.name === projectName || p.name?.toLowerCase() === projectName.toLowerCase()
      );

      if (existingProject) {
        return existingProject.id;
      }

      // Create a new project if none exists
      const newProject = await this.createProject({
        name: projectName,
        description: `Project for ${currentDir}`,
        settings: {
          type: 'auto-detected',
          detectedAt: new Date().toISOString()
        }
      });

      return newProject.id;
    } catch (error) {
      console.warn('Could not detect/create project:', error.message);
      return null;
    }
  }

  /**
   * Storage methods for API keys and user data
   */
  storeApiKey(apiKey) {
    // In a real implementation, you'd use secure storage
    // For now, using environment variable as fallback
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('luna_api_key', apiKey);
    }
  }

  loadStoredApiKey() {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('luna_api_key');
    }
    return process.env.LUNA_API_KEY;
  }

  storeUserData(userData) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('luna_user_data', JSON.stringify(userData));
    }
  }

  loadStoredUserData() {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem('luna_user_data');
      return data ? JSON.parse(data) : null;
    }
    return null;
  }

  /**
   * Cache management
   */
  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  getCache(key) {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  clearCache() {
    this.cache.clear();
  }

  /**
   * Status and health
   */
  async getStatus() {
    try {
      const [health, agents, tasks] = await Promise.all([
        this.makeRequest('GET', '/health'),
        this.getAgents({ limit: 1 }),
        this.getTasks({ limit: 1 })
      ]);

      return {
        connected: true,
        api: health,
        agentsAvailable: agents.total > 0,
        tasksActive: tasks.tasks?.some(t => t.status === 'running') || false,
        project: this.projectId
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        project: this.projectId
      };
    }
  }
}

module.exports = LunaAPIClient;
