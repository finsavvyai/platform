/**
 * RAG Utilities for Luna Agents Plugin
 *
 * Provides convenient methods for repository indexing, semantic search,
 * and context-aware AI interactions using the enhanced RAG system.
 */

const fs = require('fs');
const path = require('path');

class RAGUtils {
  constructor(apiClient) {
    this.apiClient = apiClient;
  }

  /**
   * Automatically detect and index the current project repository
   */
  async indexCurrentProject(options = {}) {
    try {
      const currentDir = process.cwd();
      console.log(`🔍 Analyzing project directory: ${currentDir}`);

      // Detect repository type and structure
      const projectInfo = this.analyzeProjectStructure(currentDir);

      console.log(`📁 Project type: ${projectInfo.type}`);
      console.log(`📊 Found ${projectInfo.fileCount} files in ${projectInfo.dirCount} directories`);

      // Configure indexing options based on project type
      const indexOptions = this.configureIndexingOptions(projectInfo, options);

      console.log('🚀 Starting repository indexing...');
      const result = await this.apiClient.indexRepository(currentDir, indexOptions);

      if (result.errors && result.errors.length > 0) {
        console.warn(`⚠️  ${result.errors.length} files had indexing errors`);
        console.log('   First few errors:', result.errors.slice(0, 3));
      }

      console.log(`✅ Successfully indexed ${result.indexedFiles} files`);
      console.log(`📈 Skipped ${result.skippedFiles} files`);
      console.log(`🕒 Processing took ${(result.scanTime / 1000).toFixed(2)} seconds`);

      return {
        success: true,
        ...result,
        projectInfo
      };

    } catch (error) {
      console.error('❌ Failed to index current project:', error.message);
      throw error;
    }
  }

  /**
   * Analyze project structure to determine optimal indexing strategy
   */
  analyzeProjectStructure(projectPath) {
    const stats = {
      type: 'unknown',
      fileCount: 0,
      dirCount: 0,
      languages: new Set(),
      frameworks: new Set(),
      hasTests: false,
      hasDocs: false,
      configFiles: []
    };

    // Scan directory structure
    this.scanDirectory(projectPath, stats, 0, 5); // Limit depth for performance

    // Determine project type
    if (stats.frameworks.has('react') || stats.frameworks.has('next')) {
      stats.type = 'react';
    } else if (stats.frameworks.has('vue')) {
      stats.type = 'vue';
    } else if (stats.frameworks.has('angular')) {
      stats.type = 'angular';
    } else if (stats.frameworks.has('express')) {
      stats.type = 'express';
    } else if (stats.languages.has('python')) {
      stats.type = 'python';
    } else if (stats.languages.has('go')) {
      stats.type = 'go';
    } else if (stats.languages.has('rust')) {
      stats.type = 'rust';
    } else if (stats.languages.has('java')) {
      stats.type = 'java';
    } else if (stats.languages.has('typescript') || stats.languages.has('javascript')) {
      stats.type = 'javascript';
    }

    return stats;
  }

  /**
   * Recursively scan directory (with depth limit)
   */
  scanDirectory(dirPath, stats, depth = 0, maxDepth = 3) {
    if (depth > maxDepth) return;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          stats.dirCount++;

          // Skip certain directories
          if (this.shouldSkipDirectory(entry.name)) {
            continue;
          }

          this.scanDirectory(path.join(dirPath, entry.name), stats, depth + 1, maxDepth);
        } else if (entry.isFile()) {
          stats.fileCount++;
          this.analyzeFile(path.join(dirPath, entry.name), stats);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  /**
   * Analyze individual file for project insights
   */
  analyzeFile(filePath, stats) {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath).toLowerCase();

    // Track languages
    const languageMap = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby'
    };

    if (languageMap[ext]) {
      stats.languages.add(languageMap[ext]);
    }

    // Track frameworks
    if (fileName === 'package.json') {
      try {
        const packageJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

        if (deps.react) stats.frameworks.add('react');
        if (deps.next) stats.frameworks.add('next');
        if (deps.vue) stats.frameworks.add('vue');
        if (deps.angular) stats.frameworks.add('angular');
        if (deps.express) stats.frameworks.add('express');
        if (deps.gatsby) stats.frameworks.add('gatsby');
      } catch (error) {
        // Ignore parse errors
      }
    }

    // Check for tests and docs
    if (fileName.includes('test') || fileName.includes('spec')) {
      stats.hasTests = true;
    }

    if (fileName === 'readme.md' || fileName.endsWith('.md')) {
      stats.hasDocs = true;
    }

    // Track config files
    const configFiles = ['tsconfig.json', 'webpack.config.js', 'vite.config.js', 'dockerfile', '.gitignore'];
    if (configFiles.includes(fileName)) {
      stats.configFiles.push(fileName);
    }
  }

  /**
   * Check if directory should be skipped during scanning
   */
  shouldSkipDirectory(dirName) {
    const skipDirs = [
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage',
      '.next',
      '.nuxt',
      'target',
      'bin',
      'obj',
      '.vscode',
      '.idea',
      '__pycache__'
    ];

    return skipDirs.includes(dirName) || dirName.startsWith('.');
  }

  /**
   * Configure indexing options based on project analysis
   */
  configureIndexingOptions(projectInfo, userOptions = {}) {
    const baseOptions = {
      filePatterns: [
        '**/*.ts',
        '**/*.tsx',
        '**/*.js',
        '**/*.jsx',
        '**/*.py',
        '**/*.go',
        '**/*.rs',
        '**/*.java',
        '**/*.cpp',
        '**/*.c',
        '**/*.cs',
        '**/*.php',
        '**/*.rb',
        '**/*.swift',
        '**/*.kt',
        '**/*.md',
        '**/*.txt',
        '**/*.json',
        '**/*.yaml',
        '**/*.yml',
        '**/*.toml',
        '**/*.xml',
        '**/*.sql',
        '**/*.sh',
        '**/*.dockerfile',
        '**/README*',
        '**/CHANGELOG*',
        '**/LICENSE*'
      ],
      excludePatterns: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/.next/**',
        '**/.nuxt/**',
        '**/coverage/**',
        '**/vendor/**',
        '**/target/**',
        '**/bin/**',
        '**/obj/**',
        '**/*.log',
        '**/*.tmp',
        '**/.DS_Store',
        '**/Thumbs.db',
        '**/*.min.js',
        '**/*.min.css',
        '**/*.map',
        '**/*.lock'
      ],
      extractGitMetadata: true,
      followSymlinks: false
    };

    // Customize based on project type
    switch (projectInfo.type) {
      case 'react':
      case 'next':
        baseOptions.filePatterns.push('**/*.css', '**/*.scss', '**/*.less');
        break;
      case 'python':
        baseOptions.filePatterns.push('**/*.pyx', '**/*.pyi');
        baseOptions.excludePatterns.push('**/__pycache__/**');
        break;
      case 'go':
        baseOptions.excludePatterns.push('**/vendor/**');
        break;
      case 'rust':
        baseOptions.excludePatterns.push('**/target/**');
        break;
    }

    // Add project-specific patterns
    if (projectInfo.hasTests) {
      baseOptions.filePatterns.push('**/*test*', '**/*spec*');
    }

    if (projectInfo.hasDocs) {
      baseOptions.filePatterns.push('**/*.md', '**/*.rst');
    }

    return {
      ...baseOptions,
      ...userOptions,
      metadata: {
        ...baseOptions.metadata,
        ...userOptions.metadata,
        projectType: projectInfo.type,
        languages: Array.from(projectInfo.languages),
        frameworks: Array.from(projectInfo.frameworks),
        analysisTimestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Perform semantic search with context
   */
  async searchWithEnhancement(query, options = {}) {
    try {
      console.log(`🔍 Searching for: "${query}"`);

      const result = await this.apiClient.queryRAG(query, {
        maxResults: options.maxResults || 5,
        temperature: options.temperature || 0.7,
        includeContext: true,
        includeSources: true,
        filters: options.filters || {}
      });

      console.log(`📝 Generated response (${result.answer?.length || 0} chars)`);
      console.log(`📚 Found ${result.sources?.length || 0} relevant sources`);

      if (result.sources && result.sources.length > 0) {
        console.log('\n📖 Top sources:');
        result.sources.slice(0, 3).forEach((source, index) => {
          console.log(`   ${index + 1}. ${source.title || source.id} (score: ${(source.relevanceScore || 0).toFixed(3)})`);
        });
      }

      return result;

    } catch (error) {
      console.error('❌ Search failed:', error.message);
      throw error;
    }
  }

  /**
   * Get RAG system status and statistics
   */
  async getSystemStatus() {
    try {
      const [status, stats] = await Promise.all([
        this.apiClient.getRAGStatus(),
        this.apiClient.getRAGStatistics()
      ]);

      console.log('📊 RAG System Status:');
      console.log(`   Status: ${status.status}`);
      console.log(`   Message: ${status.message}`);

      if (status.statistics) {
        console.log('📈 Statistics:');
        console.log(`   Documents: ${status.statistics.totalDocuments || 'N/A'}`);
        console.log(`   Queries: ${status.statistics.totalQueries || 'N/A'}`);
        console.log(`   Avg Response Time: ${status.statistics.averageResponseTime || 'N/A'}ms`);
      }

      return { status, stats };

    } catch (error) {
      console.error('❌ Failed to get RAG status:', error.message);
      throw error;
    }
  }

  /**
   * Interactive repository indexing with user confirmation
   */
  async interactiveIndexing() {
    try {
      const currentDir = process.cwd();
      console.log(`📁 Current directory: ${currentDir}`);

      // Quick analysis
      const projectInfo = this.analyzeProjectStructure(currentDir);

      console.log('\n🔍 Project Analysis:');
      console.log(`   Type: ${projectInfo.type}`);
      console.log(`   Files: ${projectInfo.fileCount}`);
      console.log(`   Languages: ${Array.from(projectInfo.languages).join(', ')}`);
      console.log(`   Frameworks: ${Array.from(projectInfo.frameworks).join(', ')}`);

      // Check if already indexed
      try {
        const ragStatus = await this.getSystemStatus();
        if (ragStatus.status.status === 'active' && ragStatus.status.statistics?.totalDocuments > 0) {
          console.log('\n💡 This project appears to already be indexed.');
          console.log(`   Found ${ragStatus.status.statistics.totalDocuments} documents in the system.`);

          // In a real implementation, you'd ask for user confirmation here
          console.log('🔄 Re-indexing with updated configuration...');
        }
      } catch (error) {
        console.log('🆕 Fresh indexing (no existing index found)');
      }

      // Perform indexing
      const result = await this.indexCurrentProject();

      console.log('\n✅ Indexing completed successfully!');
      console.log(`📊 Processed ${result.indexedFiles} files`);
      console.log(`🕒 Took ${(result.scanTime / 1000).toFixed(2)} seconds`);

      return result;

    } catch (error) {
      console.error('❌ Interactive indexing failed:', error.message);
      throw error;
    }
  }

  /**
   * Create a smart query based on current context
   */
  async contextualQuery(intent, options = {}) {
    const contextQueries = {
      'overview': 'What is this project about and what are its main components?',
      'architecture': 'What is the architecture and design patterns used in this project?',
      'apis': 'What are the main API endpoints and their purposes?',
      'database': 'What is the database schema and data model?',
      'testing': 'What testing strategies and frameworks are used?',
      'deployment': 'How is this project deployed and what are the deployment configurations?',
      'security': 'What security measures and authentication mechanisms are implemented?',
      'performance': 'What are the performance considerations and optimizations?',
      'recent-changes': 'What are the most recent changes and updates to the codebase?'
    };

    const query = contextQueries[intent] || intent;
    return this.searchWithEnhancement(query, options);
  }
}

module.exports = RAGUtils;
