/**
 * Luna Agents Plugin Entry Point
 *
 * This plugin provides comprehensive AI-powered development lifecycle management
 * with backend API integration for enhanced capabilities.
 */

const LunaAPIClient = require('./lib/api-client');
const RAGUtils = require('./lib/rag-utils');
const path = require('path');
const fs = require('fs');

class LunaAgentsPlugin {
  constructor() {
    this.apiClient = new LunaAPIClient();
    this.ragUtils = null; // Will be initialized after API client
    this.config = {};
    this.initialized = false;
  }

  /**
   * Initialize the plugin
   */
  async initialize(config = {}) {
    try {
      console.log('🌙 Luna Agents v2.1.0 plugin initializing...');
      console.log('🔗 Connecting to Claude Agent Platform API...');

      // Load configuration
      this.config = this.loadConfiguration(config);

      // Initialize API client
      await this.apiClient.initialize(this.config.api);

      // Initialize RAG utilities
      this.ragUtils = new RAGUtils(this.apiClient);

      // Setup plugin capabilities
      this.setupCapabilities();

      this.initialized = true;

      console.log('✅ Luna Agents plugin initialized successfully');
      console.log(`🏠 Active project: ${this.apiClient.projectId}`);
      console.log('🚀 Ready for AI-powered development lifecycle management');

      // Show status
      await this.showStatus();

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Luna Agents plugin:', error.message);

      // Fallback to offline mode
      console.log('🔄 Falling back to offline mode...');
      return this.initializeOfflineMode();
    }
  }

  /**
   * Load plugin configuration
   */
  loadConfiguration(userConfig = {}) {
    const defaultConfig = {
      api: {
        baseURL: process.env.LUNA_API_URL || 'http://localhost:3000/api/v1',
        timeout: 30000,
        retries: 3
      },
      features: {
        enableAPI: true,
        enableOfflineMode: true,
        enableCaching: true,
        autoDetectProject: true
      },
      auth: {
        autoLogin: true,
        storeCredentials: true
      }
    };

    // Load from config file if exists
    const configPath = path.join(process.cwd(), '.luna-config.json');
    let fileConfig = {};

    if (fs.existsSync(configPath)) {
      try {
        fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (error) {
        console.warn('⚠️ Could not load .luna-config.json:', error.message);
      }
    }

    return this.mergeConfigs(defaultConfig, fileConfig, userConfig);
  }

  /**
   * Merge configuration objects
   */
  mergeConfigs(...configs) {
    return configs.reduce((merged, config) => {
      return this.deepMerge(merged, config);
    }, {});
  }

  deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Setup plugin capabilities
   */
  setupCapabilities() {
    // API-based capabilities
    this.capabilities = {
      // Authentication
      login: this.apiClient.login.bind(this.apiClient),
      register: this.apiClient.register.bind(this.apiClient),

      // Project management
      createProject: this.apiClient.createProject.bind(this.apiClient),
      getProjects: this.apiClient.getProjects.bind(this.apiClient),

      // Agent management
      getAgents: this.apiClient.getAgents.bind(this.apiClient),
      startAgent: this.apiClient.startAgent.bind(this.apiClient),
      stopAgent: this.apiClient.stopAgent.bind(this.apiClient),

      // Task management
      createTask: this.apiClient.createTask.bind(this.apiClient),
      getTasks: this.apiClient.getTasks.bind(this.apiClient),

      // Enhanced RAG and context management
      indexProject: this.apiClient.indexProject.bind(this.apiClient),
      indexRepository: this.apiClient.indexRepository.bind(this.apiClient),
      indexFile: this.apiClient.indexFile.bind(this.apiClient),
      queryRAG: this.apiClient.queryRAG.bind(this.apiClient),
      searchDocuments: this.apiClient.searchDocuments.bind(this.apiClient),
      getRAGStatus: this.apiClient.getRAGStatus.bind(this.apiClient),
      getRAGStatistics: this.apiClient.getRAGStatistics.bind(this.apiClient),
      deleteDocuments: this.apiClient.deleteDocuments.bind(this.apiClient),
      getConversationHistory: this.apiClient.getConversationHistory.bind(this.apiClient),
      clearConversationHistory: this.apiClient.clearConversationHistory.bind(this.apiClient),
      getTokenUsage: this.apiClient.getTokenUsage.bind(this.apiClient),

      // Enhanced RAG utilities
      indexCurrentProject: this.ragUtils ? this.ragUtils.indexCurrentProject.bind(this.ragUtils) : null,
      interactiveIndexing: this.ragUtils ? this.ragUtils.interactiveIndexing.bind(this.ragUtils) : null,
      searchWithEnhancement: this.ragUtils ? this.ragUtils.searchWithEnhancement.bind(this.ragUtils) : null,
      getSystemStatus: this.ragUtils ? this.ragUtils.getSystemStatus.bind(this.ragUtils) : null,
      contextualQuery: this.ragUtils ? this.ragUtils.contextualQuery.bind(this.ragUtils) : null,

      // AI generation
      generateText: this.apiClient.generateText.bind(this.apiClient),
      analyzeCode: this.apiClient.analyzeCode.bind(this.apiClient),

      // Status and health
      getStatus: this.apiClient.getStatus.bind(this.apiClient)
    };
  }

  /**
   * Initialize offline mode
   */
  initializeOfflineMode() {
    console.log('📱 Luna Agents running in offline mode');
    console.log('📚 Local skills reference available');

    this.capabilities = {
      // Limited offline capabilities
      getLocalInfo: () => ({ mode: 'offline', skills: 'available' }),
      checkLocalEnvironment: this.checkLocalEnvironment.bind(this)
    };

    this.initialized = true;
    return true;
  }

  /**
   * Show current status
   */
  async showStatus() {
    try {
      const status = await this.capabilities.getStatus();

      console.log('\n📊 Luna Platform Status:');
      console.log('==================');
      console.log(`🔗 API Status: ${status.connected ? '✅ Connected' : '❌ Disconnected'}`);
      console.log(`🤖 Agents Available: ${status.agentsAvailable ? '✅ Yes' : '❌ No'}`);
      console.log(`⚡ Tasks Active: ${status.tasksActive ? '✅ Yes' : '❌ No'}`);
      console.log(`🏠 Project: ${status.project || 'Not detected'}`);

      if (status.error) {
        console.log(`⚠️ Warning: ${status.error}`);
      }

      console.log('==================\n');
    } catch (error) {
      console.log('ℹ️ Status check failed, continuing...');
    }
  }

  /**
   * Check local environment
   */
  checkLocalEnvironment() {
    const packagePath = path.join(process.cwd(), 'package.json');
    const hasPackageJson = fs.existsSync(packagePath);

    return {
      hasProject: hasPackageJson,
      projectType: hasPackageJson ? this.detectProjectType(packagePath) : 'unknown',
      nodeVersion: process.version,
      platform: process.platform,
      workingDirectory: process.cwd()
    };
  }

  /**
   * Detect project type from package.json
   */
  detectProjectType(packagePath) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (dependencies.react || dependencies['react-dom']) return 'react';
      if (dependencies.vue) return 'vue';
      if (dependencies.angular) return 'angular';
      if (dependencies.express) return 'express';
      if (dependencies.next) return 'next';
      if (dependencies.gatsby) return 'gatsby';
      if (dependencies.electron) return 'electron';

      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Plugin cleanup
   */
  async cleanup() {
    try {
      if (this.initialized && this.capabilities) {
        // Clear API client cache if available
        if (this.apiClient.clearCache) {
          this.apiClient.clearCache();
        }
      }

      console.log('🌙 Luna Agents plugin cleaned up');
    } catch (error) {
      console.error('⚠️ Error during cleanup:', error.message);
    }
  }

  /**
   * Get plugin capabilities
   */
  getCapabilities() {
    return this.capabilities || {};
  }

  /**
   * Check if plugin is initialized
   */
  isInitialized() {
    return this.initialized;
  }
}

// Create and export plugin instance
const plugin = new LunaAgentsPlugin();

// Export the plugin interface for Claude
module.exports = {
  name: 'luna-agents',
  version: '2.1.0',
  description: '🌙 Complete AI-powered development lifecycle management with API integration - From requirements to post-launch monitoring',

  // Initialize plugin
  initialize: async function(config) {
    return await plugin.initialize(config);
  },

  // Cleanup plugin
  cleanup: async function() {
    return await plugin.cleanup();
  },

  // Get capabilities
  getCapabilities: function() {
    return plugin.getCapabilities();
  },

  // Check initialization status
  isInitialized: function() {
    return plugin.isInitialized();
  },

  // Direct access to API client for advanced usage
  api: plugin.apiClient,

  // Plugin configuration
  config: plugin.config
};
