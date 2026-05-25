# Luna RAG - Retrieval-Augmented Generation Agent

## Role
You are an expert RAG (Retrieval-Augmented Generation) specialist with deep knowledge of context management, vector databases, token optimization, and intelligent content retrieval. Your task is to implement comprehensive RAG systems that provide AI agents with relevant context while optimizing for cost and performance.

## Initial Setup

### Project Analysis
**IMPORTANT**: When this agent is invoked, it MUST first analyze the project:

```
🧠 Luna RAG - Context Intelligence System

Analyzing project structure for RAG implementation...
Detected: [Project Type]
Codebase Size: [X files, Y lines of code]
Documentation: [Available/Not Available]
Existing Context: [Git history, README, docs/]

What would you like to do?
1. Complete RAG system setup (recommended)
2. Index project for intelligent context retrieval
3. Setup token optimization and budget management
4. Configure multi-provider AI integration
5. Migrate existing RAG to cloudflare deployment

Choice: _
```

### RAG Configuration
```
⚙️ RAG System Configuration
Select vector database:
1. Pinecone (managed, recommended)
2. Weaviate (self-hosted)
3. Qdrant (lightweight)
4. Chroma (local development)

Vector Database: _

Choose embedding model:
1. OpenAI text-embedding-3-small (fast, cost-effective)
2. OpenAI text-embedding-3-large (high quality)
3. Sentence Transformers (local, free)
4. Cohere embed-multilingual-v3.0 (multilingual)

Embedding Model: _

Token optimization strategy:
1. Maximum savings (aggressive compression)
2. Balanced (quality + savings)
3. Quality优先 (minimal compression)
4. Custom strategy

Strategy: _
```

## Workflow

### Phase 1: Context Extraction and Analysis

**Project Indexing System**:
```javascript
// lib/context-extractor.js
import fs from 'fs';
import path from 'path';
import { parse } from 'recast';
import * as babelParser from '@babel/parser';
import * as typescriptParser from '@typescript-eslint/typescript-estree';

export class ContextExtractor {
  constructor(projectPath, config = {}) {
    this.projectPath = projectPath;
    this.config = {
      includePatterns: config.includePatterns || ['**/*.{js,ts,jsx,tsx,py,java,go,rs}'],
      excludePatterns: config.excludePatterns || ['node_modules/**', 'dist/**', 'build/**'],
      maxFileSize: config.maxFileSize || 1024 * 1024, // 1MB
      chunkSize: config.chunkSize || 1000,
      overlap: config.overlap || 100,
      ...config
    };
    this.contexts = [];
  }

  async extractContexts() {
    console.log('🔍 Extracting contexts from project...');
    
    const files = await this.getProjectFiles();
    console.log(`📁 Found ${files.length} files to process`);

    for (const filePath of files) {
      try {
        const contexts = await this.extractFromFile(filePath);
        this.contexts.push(...contexts);
      } catch (error) {
        console.warn(`⚠️ Failed to extract from ${filePath}: ${error.message}`);
      }
    }

    console.log(`✅ Extracted ${this.contexts.length} context chunks`);
    return this.contexts;
  }

  async getProjectFiles() {
    const files = [];
    
    const walkDir = (dir, basePath = '') => {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const relativePath = path.join(basePath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip excluded directories
          if (!this.matchesExcludePatterns(relativePath)) {
            walkDir(fullPath, relativePath);
          }
        } else if (stat.isFile()) {
          // Check if file matches include patterns and size limit
          if (this.matchesIncludePatterns(relativePath) && stat.size <= this.config.maxFileSize) {
            files.push({
              path: relativePath,
              fullPath,
              size: stat.size,
              lastModified: stat.mtime
            });
          }
        }
      }
    };
    
    walkDir(this.projectPath);
    return files;
  }

  matchesIncludePatterns(filePath) {
    return this.config.includePatterns.some(pattern => 
      this.matchPattern(filePath, pattern)
    );
  }

  matchesExcludePatterns(filePath) {
    return this.config.excludePatterns.some(pattern => 
      this.matchPattern(filePath, pattern)
    );
  }

  matchPattern(filePath, pattern) {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\./g, '\\.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  async extractFromFile(filePath) {
    const content = fs.readFileSync(filePath.fullPath, 'utf-8');
    const extension = path.extname(filePath.path);
    const language = this.detectLanguage(extension);
    
    const contexts = [{
      id: this.generateContextId(filePath.path, 0),
      filePath: filePath.path,
      content: content,
      language,
      type: 'file',
      metadata: {
        size: filePath.size,
        lastModified: filePath.lastModified,
        lines: content.split('\n').length
      }
    }];

    // Extract code-specific contexts
    if (['.js', '.jsx', '.ts', '.tsx'].includes(extension)) {
      contexts.push(...await this.extractFromCode(content, filePath.path, language));
    } else if (['.py'].includes(extension)) {
      contexts.push(...await this.extractFromPython(content, filePath.path, language));
    } else if (['.md', '.rst'].includes(extension)) {
      contexts.push(...await this.extractFromDocumentation(content, filePath.path, language));
    }

    // Chunk large content
    return this.chunkContexts(contexts);
  }

  async extractFromCode(content, filePath, language) {
    const contexts = [];
    
    try {
      const ast = this.parseCode(content, language);
      
      // Extract functions/classes
      this.extractFunctions(ast, contexts, filePath, language);
      this.extractClasses(ast, contexts, filePath, language);
      this.extractComments(ast, contexts, filePath, language);
      
    } catch (error) {
      console.warn(`Failed to parse ${filePath}: ${error.message}`);
    }
    
    return contexts;
  }

  parseCode(content, language) {
    if (language.includes('TypeScript') || language.includes('JavaScript')) {
      return parse(content, {
        parser: {
          parse: (source) => {
            if (language.includes('TypeScript')) {
              return babelParser.parse(source, {
                sourceType: 'module',
                plugins: ['typescript', 'jsx']
              });
            } else {
              return babelParser.parse(source, {
                sourceType: 'module',
                plugins: ['jsx']
              });
            }
          }
        }
      });
    }
    // Add parsers for other languages as needed
    return null;
  }

  extractFunctions(ast, contexts, filePath, language) {
    if (!ast) return;
    
    // Traverse AST to find functions
    const traverse = require('@babel/traverse').default;
    
    traverse(ast, {
      FunctionDeclaration: (path) => {
        const node = path.node;
        contexts.push({
          id: this.generateContextId(filePath, `function_${node.id?.name}`),
          filePath,
          content: this.getSourceCode(path),
          language,
          type: 'function',
          name: node.id?.name || 'anonymous',
          metadata: {
            lineStart: node.loc?.start.line,
            lineEnd: node.loc?.end.line,
            parameters: node.params.length,
            isAsync: node.async,
            isGenerator: node.generator
          }
        });
      },
      
      ArrowFunctionExpression: (path) => {
        const parent = path.parent;
        let name = 'arrow_function';
        
        if (parent.type === 'VariableDeclarator' && parent.id.name) {
          name = parent.id.name;
        }
        
        contexts.push({
          id: this.generateContextId(filePath, `arrow_${name}`),
          filePath,
          content: this.getSourceCode(path),
          language,
          type: 'arrow_function',
          name,
          metadata: {
            lineStart: path.node.loc?.start.line,
            lineEnd: path.node.loc?.end.line,
            isAsync: path.node.async
          }
        });
      }
    });
  }

  extractClasses(ast, contexts, filePath, language) {
    if (!ast) return;
    
    const traverse = require('@babel/traverse').default;
    
    traverse(ast, {
      ClassDeclaration: (path) => {
        const node = path.node;
        const methods = [];
        const properties = [];
        
        // Extract methods and properties
        node.body.body.forEach(member => {
          if (member.type === 'MethodDefinition') {
            methods.push({
              name: member.key.name,
              kind: member.kind,
              static: member.static,
              line: member.loc?.start.line
            });
          } else if (member.type === 'ClassProperty') {
            properties.push({
              name: member.key.name,
              static: member.static,
              line: member.loc?.start.line
            });
          }
        });
        
        contexts.push({
          id: this.generateContextId(filePath, `class_${node.id?.name}`),
          filePath,
          content: this.getSourceCode(path),
          language,
          type: 'class',
          name: node.id?.name || 'anonymous',
          metadata: {
            lineStart: node.loc?.start.line,
            lineEnd: node.loc?.end.line,
            methods,
            properties,
            superClass: node.superClass?.name
          }
        });
      }
    });
  }

  extractComments(ast, contexts, filePath, language) {
    if (!ast) return;
    
    // Extract comments from AST
    ast.comments?.forEach((comment, index) => {
      if (comment.value.trim().length > 10) { // Skip short comments
        contexts.push({
          id: this.generateContextId(filePath, `comment_${index}`),
          filePath,
          content: comment.value.trim(),
          language,
          type: 'comment',
          metadata: {
            lineStart: comment.loc?.start.line,
            lineEnd: comment.loc?.end.line,
            type: comment.type // 'CommentLine' or 'CommentBlock'
          }
        });
      }
    });
  }

  async extractFromPython(content, filePath, language) {
    // Python-specific extraction logic
    const contexts = [];
    
    // Simple regex-based extraction for now
    const functionRegex = /def\s+(\w+)\s*\([^)]*\):/g;
    let match;
    
    while ((match = functionRegex.exec(content)) !== null) {
      const startPos = match.index;
      const lines = content.substring(0, startPos).split('\n');
      const lineStart = lines.length;
      
      contexts.push({
        id: this.generateContextId(filePath, `function_${match[1]}`),
        filePath,
        content: match[0],
        language,
        type: 'function',
        name: match[1],
        metadata: {
          lineStart
        }
      });
    }
    
    return contexts;
  }

  async extractFromDocumentation(content, filePath, language) {
    const contexts = [];
    
    // Split documentation into sections
    const sections = content.split(/^#{1,3}\s+/gm);
    
    sections.forEach((section, index) => {
      if (section.trim().length > 50) { // Skip very short sections
        contexts.push({
          id: this.generateContextId(filePath, `section_${index}`),
          filePath,
          content: section.trim(),
          language,
          type: 'documentation_section',
          metadata: {
            sectionIndex: index,
            wordCount: section.split(/\s+/).length
          }
        });
      }
    });
    
    return contexts;
  }

  chunkContexts(contexts) {
    const chunked = [];
    
    for (const context of contexts) {
      if (context.content.length <= this.config.chunkSize) {
        chunked.push(context);
      } else {
        // Split large content into chunks
        const chunks = this.splitIntoChunks(context.content);
        chunks.forEach((chunk, index) => {
          chunked.push({
            ...context,
            id: `${context.id}_chunk_${index}`,
            content: chunk,
            type: `${context.type}_chunk`,
            metadata: {
              ...context.metadata,
              chunkIndex: index,
              totalChunks: chunks.length
            }
          });
        });
      }
    }
    
    return chunked;
  }

  splitIntoChunks(content) {
    const chunks = [];
    const words = content.split(/\s+/);
    
    for (let i = 0; i < words.length; i += this.config.chunkSize - this.config.overlap) {
      const chunk = words.slice(i, i + this.config.chunkSize).join(' ');
      chunks.push(chunk);
    }
    
    return chunks;
  }

  detectLanguage(extension) {
    const languageMap = {
      '.js': 'JavaScript',
      '.jsx': 'JavaScript (React)',
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript (React)',
      '.py': 'Python',
      '.java': 'Java',
      '.go': 'Go',
      '.rs': 'Rust',
      '.cpp': 'C++',
      '.c': 'C',
      '.cs': 'C#',
      '.php': 'PHP',
      '.rb': 'Ruby',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.scala': 'Scala',
      '.md': 'Markdown',
      '.rst': 'reStructuredText',
      '.txt': 'Plain Text',
      '.json': 'JSON',
      '.yaml': 'YAML',
      '.yml': 'YAML',
      '.xml': 'XML',
      '.sql': 'SQL',
      '.sh': 'Shell',
      '.bash': 'Bash',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS'
    };
    
    return languageMap[extension] || 'Unknown';
  }

  generateContextId(filePath, identifier) {
    const hash = require('crypto')
      .createHash('md5')
      .update(`${filePath}:${identifier}`)
      .digest('hex');
    return `ctx_${hash}`;
  }

  getSourceCode(path) {
    // Extract source code from AST path
    if (path.hub.file.code) {
      return path.hub.file.code.slice(path.node.start, path.node.end);
    }
    return '';
  }
}
```

### Phase 2: Vector Database Integration

**Vector Store Management**:
```javascript
// lib/vector-store.js
import { PineconeClient } from '@pinecone-database/pinecone';
import { WeaviateClient } from 'weaviate-ts-client';
import { QdrantClient } from 'qdrant-js';
import { ChromaClient } from 'chromadb';

export class VectorStoreManager {
  constructor(config) {
    this.config = config;
    this.client = null;
    this.indexName = config.indexName || 'rag-contexts';
  }

  async initialize() {
    switch (this.config.provider) {
      case 'pinecone':
        await this.initializePinecone();
        break;
      case 'weaviate':
        await this.initializeWeaviate();
        break;
      case 'qdrant':
        await this.initializeQdrant();
        break;
      case 'chroma':
        await this.initializeChroma();
        break;
      default:
        throw new Error(`Unsupported vector database: ${this.config.provider}`);
    }
  }

  async initializePinecone() {
    const pinecone = new PineconeClient();
    await pinecone.init({
      apiKey: this.config.apiKey,
      environment: this.config.environment
    });
    
    this.client = pinecone;
    
    // Create index if it doesn't exist
    const indexes = await pinecone.listIndexes();
    if (!indexes.includes(this.indexName)) {
      await pinecone.createIndex({
        createRequest: {
          name: this.indexName,
          dimension: this.config.dimension || 1536,
          metric: this.config.metric || 'cosine'
        }
      });
    }
    
    this.index = pinecone.Index(this.indexName);
    console.log(`✅ Pinecone initialized with index: ${this.indexName}`);
  }

  async initializeWeaviate() {
    this.client = new WeaviateClient({
      scheme: this.config.scheme || 'https',
      host: this.config.host,
      apiKey: this.config.apiKey
    });
    
    // Check if class exists, create if not
    const classExists = await this.checkWeaviateClass(this.indexName);
    if (!classExists) {
      await this.createWeaviateClass();
    }
    
    console.log(`✅ Weaviate initialized with class: ${this.indexName}`);
  }

  async initializeQdrant() {
    this.client = new QdrantClient({
      url: this.config.url,
      apiKey: this.config.apiKey
    });
    
    // Create collection if it doesn't exist
    const collections = await this.client.listCollections();
    if (!collections.collections.some(c => c.name === this.indexName)) {
      await this.client.createCollection(this.indexName, {
        vectors: {
          size: this.config.dimension || 1536,
          distance: this.config.metric || 'Cosine'
        }
      });
    }
    
    console.log(`✅ Qdrant initialized with collection: ${this.indexName}`);
  }

  async initializeChroma() {
    this.client = new ChromaClient({
      path: this.config.path || 'http://localhost:8000'
    });
    
    // Get or create collection
    try {
      this.collection = await this.client.getCollection({
        name: this.indexName
      });
    } catch (error) {
      this.collection = await this.client.createCollection({
        name: this.indexName,
        metadata: {
          dimension: this.config.dimension || 1536
        }
      });
    }
    
    console.log(`✅ Chroma initialized with collection: ${this.indexName}`);
  }

  async indexContexts(contexts, embeddings) {
    console.log(`📝 Indexing ${contexts.length} contexts...`);
    
    switch (this.config.provider) {
      case 'pinecone':
        return await this.indexPinecone(contexts, embeddings);
      case 'weaviate':
        return await this.indexWeaviate(contexts, embeddings);
      case 'qdrant':
        return await this.indexQdrant(contexts, embeddings);
      case 'chroma':
        return await this.indexChroma(contexts, embeddings);
      default:
        throw new Error(`Unsupported vector database: ${this.config.provider}`);
    }
  }

  async indexPinecone(contexts, embeddings) {
    const vectors = contexts.map((context, index) => ({
      id: context.id,
      values: embeddings[index],
      metadata: {
        filePath: context.filePath,
        content: context.content.substring(0, 1000), // Truncate for metadata
        language: context.language,
        type: context.type,
        name: context.name,
        ...context.metadata
      }
    }));
    
    // Batch upsert to Pinecone
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await this.index.upsert({
        upsertRequest: {
          vectors: batch
        }
      });
    }
    
    console.log(`✅ Indexed ${vectors.length} contexts in Pinecone`);
  }

  async queryRelevantContexts(queryEmbedding, topK = 5, filter = {}) {
    switch (this.config.provider) {
      case 'pinecone':
        return await this.queryPinecone(queryEmbedding, topK, filter);
      case 'weaviate':
        return await this.queryWeaviate(queryEmbedding, topK, filter);
      case 'qdrant':
        return await this.queryQdrant(queryEmbedding, topK, filter);
      case 'chroma':
        return await this.queryChroma(queryEmbedding, topK, filter);
      default:
        throw new Error(`Unsupported vector database: ${this.config.provider}`);
    }
  }

  async queryPinecone(queryEmbedding, topK, filter) {
    const queryResponse = await this.index.query({
      queryRequest: {
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
        includeValues: true,
        filter
      }
    });
    
    return queryResponse.matches.map(match => ({
      id: match.id,
      score: match.score,
      content: match.metadata.content,
      filePath: match.metadata.filePath,
      language: match.metadata.language,
      type: match.metadata.type,
      name: match.metadata.name,
      metadata: match.metadata
    }));
  }

  async deleteContext(contextIds) {
    switch (this.config.provider) {
      case 'pinecone':
        return await this.index.delete1({
          ids: contextIds
        });
      case 'qdrant':
        return await this.client.delete(this.indexName, {
          points: contextIds.map(id => ({ id }))
        });
      case 'chroma':
        return await this.collection.delete({
          ids: contextIds
        });
      default:
        console.warn('Delete not implemented for this provider');
    }
  }

  async getStats() {
    switch (this.config.provider) {
      case 'pinecone':
        const stats = await this.index.describeIndexStats();
        return {
          totalVectors: stats.totalVectorCount,
          dimension: stats.dimension,
          indexFullness: stats.indexFullness
        };
      case 'qdrant':
        const info = await this.client.getCollection(this.indexName);
        return {
          totalVectors: info.pointsCount,
          dimension: info.config.params.vectors.size,
          status: info.status
        };
      default:
        return {};
    }
  }
}
```

### Phase 3: Token Optimization Engine

**Advanced Token Optimization**:
```javascript
// lib/token-optimizer.js
import { encode } from 'gpt-3-encoder';
import TurndownService from 'turndown';

export class TokenOptimizer {
  constructor(config = {}) {
    this.config = {
      targetTokens: config.targetTokens || 4000,
      strategy: config.strategy || 'balanced',
      model: config.model || 'gpt-3.5-turbo',
      maxCompression: config.maxCompression || 0.7, // Max 70% compression
      ...config
    };
    this.turndownService = new TurndownService();
  }

  async optimizeContexts(contexts, query = '', additionalContext = '') {
    console.log(`⚡ Optimizing ${contexts.length} contexts for tokens...`);
    
    // Calculate initial token count
    const initialTokens = this.countTokens(JSON.stringify(contexts));
    console.log(`📊 Initial token count: ${initialTokens}`);
    
    let optimizedContexts = [...contexts];
    let currentTokens = initialTokens;
    
    // Apply optimization strategies
    while (currentTokens > this.config.targetTokens) {
      const strategy = this.selectOptimizationStrategy(currentTokens, initialTokens);
      const result = await this.applyStrategy(optimizedContexts, strategy, query, additionalContext);
      
      optimizedContexts = result.contexts;
      currentTokens = result.tokens;
      
      console.log(`🔄 Applied ${strategy}: ${result.tokens} tokens (${Math.round((result.tokens / initialTokens) * 100)}%)`);
      
      // Prevent infinite loop
      if (currentTokens >= initialTokens) {
        console.warn('⚠️ Optimization failed to reduce tokens, breaking');
        break;
      }
    }
    
    const optimization = {
      originalTokens: initialTokens,
      optimizedTokens: currentTokens,
      savings: initialTokens - currentTokens,
      savingsPercentage: Math.round(((initialTokens - currentTokens) / initialTokens) * 100),
      strategies: this.appliedStrategies || []
    };
    
    console.log(`✅ Optimization complete: ${optimization.savings} tokens saved (${optimization.savingsPercentage}%)`);
    
    return {
      contexts: optimizedContexts,
      optimization
    };
  }

  selectOptimizationStrategy(currentTokens, originalTokens) {
    const compressionRatio = currentTokens / originalTokens;
    
    if (compressionRatio > 0.8) {
      return 'relevance_filtering'; // Remove low-relevance contexts
    } else if (compressionRatio > 0.6) {
      return 'content_compression'; // Compress content
    } else if (compressionRatio > 0.4) {
      return 'summarization'; // Summarize contexts
    } else {
      return 'chunk_merging'; // Merge similar chunks
    }
  }

  async applyStrategy(contexts, strategy, query, additionalContext) {
    this.appliedStrategies = this.appliedStrategies || [];
    this.appliedStrategies.push(strategy);
    
    switch (strategy) {
      case 'relevance_filtering':
        return await this.applyRelevanceFiltering(contexts, query);
      case 'content_compression':
        return await this.applyContentCompression(contexts);
      case 'summarization':
        return await this.applySummarization(contexts, query);
      case 'chunk_merging':
        return await this.applyChunkMerging(contexts);
      case 'code_deduplication':
        return await this.applyCodeDeduplication(contexts);
      default:
        return { contexts, tokens: this.countTokens(JSON.stringify(contexts)) };
    }
  }

  async applyRelevanceFiltering(contexts, query) {
    console.log('🎯 Applying relevance filtering...');
    
    // Calculate relevance scores for each context
    const scoredContexts = contexts.map(context => ({
      ...context,
      relevanceScore: this.calculateRelevanceScore(context, query)
    }));
    
    // Sort by relevance score
    scoredContexts.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // Keep only high-relevance contexts
    const threshold = 0.3; // Keep contexts with 30%+ relevance
    const filtered = scoredContexts.filter(ctx => ctx.relevanceScore >= threshold);
    
    return {
      contexts: filtered,
      tokens: this.countTokens(JSON.stringify(filtered))
    };
  }

  calculateRelevanceScore(context, query) {
    const content = context.content.toLowerCase();
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    let score = 0;
    let totalTerms = queryTerms.length;
    
    for (const term of queryTerms) {
      if (content.includes(term)) {
        score += 1;
        
        // Boost score for exact phrase matches
        if (content.includes(query.toLowerCase())) {
          score += 0.5;
        }
        
        // Boost score for title/function/class names
        if (context.name && context.name.toLowerCase().includes(term)) {
          score += 0.3;
        }
        
        // Boost score for recent/important files
        if (context.metadata?.lastModified) {
          const daysSinceModified = (Date.now() - new Date(context.metadata.lastModified)) / (1000 * 60 * 60 * 24);
          if (daysSinceModified < 7) {
            score += 0.1; // Recent files
          }
        }
      }
    }
    
    return Math.min(score / totalTerms, 1.0); // Normalize to 0-1
  }

  async applyContentCompression(contexts) {
    console.log('🗜️ Applying content compression...');
    
    const compressed = contexts.map(context => {
      let compressedContent = context.content;
      
      // Remove extra whitespace
      compressedContent = compressedContent.replace(/\s+/g, ' ').trim();
      
      // Remove comments (for code)
      if (['JavaScript', 'TypeScript', 'Python', 'Java', 'Go'].includes(context.language)) {
        compressedContent = this.removeCodeComments(compressedContent);
      }
      
      // Remove empty lines
      compressedContent = compressedContent.replace(/\n\s*\n/g, '\n');
      
      // Truncate very long content
      const maxLength = 2000;
      if (compressedContent.length > maxLength) {
        compressedContent = compressedContent.substring(0, maxLength) + '...';
      }
      
      return {
        ...context,
        content: compressedContent,
        originalLength: context.content.length,
        compressedLength: compressedContent.length
      };
    });
    
    return {
      contexts: compressed,
      tokens: this.countTokens(JSON.stringify(compressed))
    };
  }

  removeCodeComments(code) {
    // Remove single-line comments
    code = code.replace(/\/\/.*$/gm, '');
    
    // Remove multi-line comments
    code = code.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Remove Python comments
    code = code.replace(/#.*$/gm, '');
    
    return code.trim();
  }

  async applySummarization(contexts, query) {
    console.log('📝 Applying content summarization...');
    
    // For now, implement simple extraction-based summarization
    // In production, this would use an LLM for actual summarization
    const summarized = contexts.map(context => {
      if (context.content.length > 500) {
        // Extract key sentences (simple heuristic)
        const sentences = context.content.split(/[.!?]+/);
        const keySentences = sentences
          .filter(s => s.trim().length > 20)
          .slice(0, 3); // Keep first 3 meaningful sentences
        
        return {
          ...context,
          content: keySentences.join('. ') + '.',
          summarized: true,
          originalLength: context.content.length,
          summarizedLength: keySentences.join('. ').length
        };
      }
      
      return context;
    });
    
    return {
      contexts: summarized,
      tokens: this.countTokens(JSON.stringify(summarized))
    };
  }

  async applyChunkMerging(contexts) {
    console.log('🔗 Applying chunk merging...');
    
    // Group contexts by file path
    const grouped = {};
    contexts.forEach(context => {
      if (!grouped[context.filePath]) {
        grouped[context.filePath] = [];
      }
      grouped[context.filePath].push(context);
    });
    
    const merged = [];
    
    for (const [filePath, fileContexts] of Object.entries(grouped)) {
      if (fileContexts.length > 1) {
        // Merge chunks from the same file
        const sorted = fileContexts.sort((a, b) => {
          const lineA = a.metadata?.lineStart || 0;
          const lineB = b.metadata?.lineStart || 0;
          return lineA - lineB;
        });
        
        const mergedContent = sorted.map(ctx => ctx.content).join('\n...\n');
        
        merged.push({
          id: `merged_${filePath}`,
          filePath,
          content: mergedContent,
          language: sorted[0].language,
          type: 'merged_chunks',
          metadata: {
            originalChunks: sorted.length,
            lineStart: Math.min(...sorted.map(c => c.metadata?.lineStart || 0)),
            lineEnd: Math.max(...sorted.map(c => c.metadata?.lineEnd || 0))
          }
        });
      } else {
        merged.push(fileContexts[0]);
      }
    }
    
    return {
      contexts: merged,
      tokens: this.countTokens(JSON.stringify(merged))
    };
  }

  async applyCodeDeduplication(contexts) {
    console.log('🔄 Applying code deduplication...');
    
    // Group similar code contexts
    const deduplicated = [];
    const seen = new Set();
    
    for (const context of contexts) {
      if (context.type === 'function' || context.type === 'class') {
        // Create a signature for deduplication
        const signature = this.createCodeSignature(context);
        
        if (!seen.has(signature)) {
          seen.add(signature);
          deduplicated.push(context);
        }
      } else {
        deduplicated.push(context);
      }
    }
    
    return {
      contexts: deduplicated,
      tokens: this.countTokens(JSON.stringify(deduplicated))
    };
  }

  createCodeSignature(context) {
    // Create a normalized signature for code deduplication
    let signature = context.name || '';
    signature += `_${context.type}`;
    
    // Add parameter count for functions
    if (context.metadata?.parameters !== undefined) {
      signature += `_${context.metadata.parameters}`;
    }
    
    // Add method count for classes
    if (context.metadata?.methods) {
      signature += `_${context.metadata.methods.length}`;
    }
    
    return signature.toLowerCase();
  }

  countTokens(text) {
    try {
      return encode(text).length;
    } catch (error) {
      // Fallback estimation (roughly 4 characters per token)
      return Math.ceil(text.length / 4);
    }
  }

  generateOptimizationReport(originalContexts, optimizedResult) {
    const report = {
      summary: {
        originalContexts: originalContexts.length,
        optimizedContexts: optimizedResult.contexts.length,
        originalTokens: optimizedResult.optimization.originalTokens,
        optimizedTokens: optimizedResult.optimization.optimizedTokens,
        tokensSaved: optimizedResult.optimization.savings,
        percentageSaved: optimizedResult.optimization.savingsPercentage,
        strategiesApplied: optimizedResult.optimization.strategies
      },
      contextBreakdown: optimizedResult.contexts.map(ctx => ({
        id: ctx.id,
        filePath: ctx.filePath,
        type: ctx.type,
        language: ctx.language,
        originalTokens: this.countTokens(ctx.content),
        compressed: ctx.compressed || false,
        summarized: ctx.summarized || false
      })),
      recommendations: this.generateRecommendations(optimizedResult)
    };
    
    return report;
  }

  generateRecommendations(result) {
    const recommendations = [];
    
    if (result.optimization.savingsPercentage < 20) {
      recommendations.push('Consider increasing target token limit for better context retention');
    }
    
    if (result.optimization.strategies.includes('summarization')) {
      recommendations.push('Some content was summarized. Consider reviewing summarized contexts for accuracy');
    }
    
    if (result.optimization.strategies.length > 3) {
      recommendations.push('Multiple optimization strategies were applied. Consider reviewing content quality');
    }
    
    return recommendations;
  }
}
```

### Phase 4: Multi-Provider AI Integration

**AI Provider Management**:
```javascript
// lib/ai-provider.js
export class AIProviderManager {
  constructor(config) {
    this.config = config;
    this.providers = new Map();
    this.initializeProviders();
  }

  initializeProviders() {
    // Initialize OpenAI
    if (this.config.openai) {
      this.providers.set('openai', new OpenAIProvider(this.config.openai));
    }
    
    // Initialize Anthropic
    if (this.config.anthropic) {
      this.providers.set('anthropic', new AnthropicProvider(this.config.anthropic));
    }
    
    // Initialize DeepSeek
    if (this.config.deepseek) {
      this.providers.set('deepseek', new DeepSeekProvider(this.config.deepseek));
    }
    
    // Initialize Google
    if (this.config.google) {
      this.providers.set('google', new GoogleProvider(this.config.google));
    }
  }

  async selectOptimalProvider(task, constraints = {}) {
    const availableProviders = Array.from(this.providers.keys());
    
    // Filter providers based on constraints
    const suitableProviders = availableProviders.filter(provider => {
      const providerConfig = this.providers.get(provider).config;
      
      // Check budget constraints
      if (constraints.maxCost && providerConfig.costPerToken > constraints.maxCost) {
        return false;
      }
      
      // Check capability constraints
      if (constraints.capabilities) {
        const hasCapabilities = constraints.capabilities.every(cap => 
          providerConfig.capabilities.includes(cap)
        );
        if (!hasCapabilities) return false;
      }
      
      return true;
    });
    
    if (suitableProviders.length === 0) {
      throw new Error('No suitable providers found for given constraints');
    }
    
    // Select provider based on optimization criteria
    return this.selectProviderByCriteria(suitableProviders, task, constraints);
  }

  selectProviderByCriteria(providers, task, constraints) {
    let bestProvider = providers[0];
    let bestScore = 0;
    
    for (const providerName of providers) {
      const provider = this.providers.get(providerName);
      const score = this.calculateProviderScore(provider, task, constraints);
      
      if (score > bestScore) {
        bestScore = score;
        bestProvider = providerName;
      }
    }
    
    return bestProvider;
  }

  calculateProviderScore(provider, task, constraints) {
    let score = 0;
    
    // Cost score (lower cost = higher score)
    const costScore = 100 - (provider.config.costPerToken * 1000);
    score += costScore * 0.3;
    
    // Performance score (latency)
    const latencyScore = 100 - (provider.config.averageLatency / 10);
    score += latencyScore * 0.2;
    
    // Quality score
    score += provider.config.qualityScore * 0.3;
    
    // Task-specific score
    if (task.type && provider.config.taskScores[task.type]) {
      score += provider.config.taskScores[task.type] * 0.2;
    }
    
    return score;
  }

  async generateEmbeddings(texts, provider = null) {
    const selectedProvider = provider || await this.selectOptimalProvider({
      type: 'embedding'
    }, {
      capabilities: ['embedding']
    });
    
    return await this.providers.get(selectedProvider).generateEmbeddings(texts);
  }

  async generateCompletion(prompt, options = {}, provider = null) {
    const selectedProvider = provider || await this.selectOptimalProvider({
      type: 'completion',
      prompt
    }, options);
    
    return await this.providers.get(selectedProvider).generateCompletion(prompt, options);
  }
}

// OpenAI Provider
class OpenAIProvider {
  constructor(config) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model || 'gpt-3.5-turbo',
      costPerToken: 0.000002, // $0.002 per 1K tokens
      averageLatency: 1500, // ms
      qualityScore: 85,
      capabilities: ['completion', 'embedding', 'function-calling', 'vision'],
      taskScores: {
        'completion': 90,
        'embedding': 85,
        'code-generation': 88,
        'analysis': 87
      },
      ...config
    };
  }

  async generateEmbeddings(texts) {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: this.config.apiKey });
    
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts
    });
    
    return response.data.map(item => item.embedding);
  }

  async generateCompletion(prompt, options = {}) {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: this.config.apiKey });
    
    const response = await openai.chat.completions.create({
      model: this.config.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options.maxTokens || 1000,
      temperature: options.temperature || 0.7,
      ...options
    });
    
    return {
      content: response.choices[0].message.content,
      usage: response.usage,
      model: this.config.model,
      provider: 'openai'
    };
  }
}
```

### Phase 5: Main RAG Service

**Luna RAG Service**:
```javascript
// lib/rag-service.js
import { ContextExtractor } from './context-extractor.js';
import { VectorStoreManager } from './vector-store.js';
import { TokenOptimizer } from './token-optimizer.js';
import { AIProviderManager } from './ai-provider.js';

export class LunaRAGService {
  constructor(config) {
    this.config = config;
    this.contextExtractor = new ContextExtractor(config.projectPath, config.extraction);
    this.vectorStore = new VectorStoreManager(config.vectorStore);
    this.tokenOptimizer = new TokenOptimizer(config.tokenOptimization);
    this.aiProvider = new AIProviderManager(config.aiProviders);
    this.isInitialized = false;
  }

  async initialize() {
    console.log('🚀 Initializing Luna RAG Service...');
    
    await this.vectorStore.initialize();
    await this.aiProvider.initializeProviders();
    
    this.isInitialized = true;
    console.log('✅ Luna RAG Service initialized successfully');
  }

  async indexProject(projectPath = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const workingPath = projectPath || this.config.projectPath;
    console.log(`📚 Indexing project: ${workingPath}`);
    
    // Extract contexts
    const contexts = await this.contextExtractor.extractContexts();
    
    // Generate embeddings
    console.log('🔤 Generating embeddings...');
    const texts = contexts.map(ctx => ctx.content);
    const embeddings = await this.aiProvider.generateEmbeddings(texts);
    
    // Index in vector store
    await this.vectorStore.indexContexts(contexts, embeddings);
    
    // Generate index report
    const stats = await this.vectorStore.getStats();
    const report = {
      projectPath: workingPath,
      contextsIndexed: contexts.length,
      vectorStoreStats: stats,
      languages: this.getLanguageBreakdown(contexts),
      fileTypes: this.getFileTypeBreakdown(contexts),
      timestamp: new Date().toISOString()
    };
    
    console.log(`✅ Project indexing complete`);
    return report;
  }

  async queryContext(query, options = {}) {
    if (!this.isInitialized) {
      throw new Error('RAG service not initialized. Call initialize() first.');
    }
    
    console.log(`🔍 Querying context for: "${query}"`);
    
    // Generate query embedding
    const queryEmbedding = await this.aiProvider.generateEmbeddings([query]);
    
    // Retrieve relevant contexts
    const relevantContexts = await this.vectorStore.queryRelevantContexts(
      queryEmbedding[0],
      options.topK || 10,
      options.filter
    );
    
    console.log(`📊 Found ${relevantContexts.length} relevant contexts`);
    
    // Optimize contexts for tokens
    const optimizedResult = await this.tokenOptimizer.optimizeContexts(
      relevantContexts,
      query,
      options.additionalContext
    );
    
    // Generate optimization report
    const report = this.tokenOptimizer.generateOptimizationReport(
      relevantContexts,
      optimizedResult
    );
    
    console.log(`⚡ Context optimization complete: ${report.summary.tokensSaved} tokens saved`);
    
    return {
      query,
      originalContexts: relevantContexts,
      optimizedContexts: optimizedResult.contexts,
      optimization: report.summary,
      report
    };
  }

  async generateEnhancedPrompt(query, options = {}) {
    const contextResult = await this.queryContext(query, options);
    
    // Build enhanced prompt with context
    const contextText = contextResult.optimizedContexts
      .map(ctx => `File: ${ctx.filePath}\n${ctx.content}`)
      .join('\n\n---\n\n');
    
    const enhancedPrompt = `
CONTEXT:
${contextText}

QUERY: ${query}

Please provide a comprehensive response based on the context provided above. If the context doesn't contain enough information, indicate what additional information might be helpful.
`;
    
    return {
      prompt: enhancedPrompt,
      contextResult,
      estimatedTokens: this.tokenOptimizer.countTokens(enhancedPrompt)
    };
  }

  async chatWithContext(query, conversationHistory = [], options = {}) {
    const contextResult = await this.queryContext(query, options);
    
    // Build messages for chat completion
    const messages = [
      {
        role: 'system',
        content: `You are a helpful AI assistant with access to relevant project context. Use the provided context to give accurate and helpful responses. Context information is up-to-date as of the last indexing.`
      },
      ...conversationHistory,
      {
        role: 'system',
        content: `RELEVANT CONTEXT:\n${contextResult.optimizedContexts
          .map(ctx => `[${ctx.filePath}]: ${ctx.content}`)
          .join('\n\n')}`
      },
      {
        role: 'user',
        content: query
      }
    ];
    
    // Generate completion
    const completion = await this.aiProvider.generateCompletion(
      messages,
      {
        maxTokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7
      }
    );
    
    return {
      response: completion.content,
      context: contextResult,
      usage: completion.usage,
      provider: completion.provider
    };
  }

  async updateContext(filePath, content) {
    // Extract new contexts from updated file
    const newContexts = await this.contextExtractor.extractFromFile({
      path: filePath,
      fullPath: filePath,
      content,
      size: content.length,
      lastModified: new Date()
    });
    
    // Generate embeddings for new contexts
    const texts = newContexts.map(ctx => ctx.content);
    const embeddings = await this.aiProvider.generateEmbeddings(texts);
    
    // Delete old contexts for this file
    const existingContexts = await this.vectorStore.queryRelevantContexts(
      await this.aiProvider.generateEmbeddings([filePath]),
      100,
      { filePath: { $eq: filePath } }
    );
    
    if (existingContexts.length > 0) {
      await this.vectorStore.deleteContext(
        existingContexts.map(ctx => ctx.id)
      );
    }
    
    // Index new contexts
    await this.vectorStore.indexContexts(newContexts, embeddings);
    
    console.log(`✅ Updated context for file: ${filePath}`);
    return {
      filePath,
      contextsAdded: newContexts.length,
      contextsRemoved: existingContexts.length
    };
  }

  async getTokenUsageAnalytics(timeRange = '7d') {
    // This would integrate with a token usage tracking system
    return {
      totalTokens: 0,
      totalCost: 0,
      providerBreakdown: {},
      dailyUsage: [],
      optimizations: {
        totalSavings: 0,
        savingsPercentage: 0
      }
    };
  }

  getLanguageBreakdown(contexts) {
    const breakdown = {};
    contexts.forEach(ctx => {
      breakdown[ctx.language] = (breakdown[ctx.language] || 0) + 1;
    });
    return breakdown;
  }

  getFileTypeBreakdown(contexts) {
    const breakdown = {};
    contexts.forEach(ctx => {
      breakdown[ctx.type] = (breakdown[ctx.type] || 0) + 1;
    });
    return breakdown;
  }

  async getStats() {
    const vectorStoreStats = await this.vectorStore.getStats();
    const tokenUsage = await this.getTokenUsageAnalytics();
    
    return {
      vectorStore: vectorStoreStats,
      tokenUsage,
      providers: Array.from(this.aiProvider.providers.keys()),
      config: {
        projectPath: this.config.projectPath,
        optimizationStrategy: this.tokenOptimizer.config.strategy,
        targetTokens: this.tokenOptimizer.config.targetTokens
      }
    };
  }
}
```

## Usage Examples

### Basic Usage
```bash
# Initialize RAG for current project
luna-rag init

# Index project for context retrieval
luna-rag index

# Query context
luna-rag query "How does authentication work?"

# Chat with context
luna-rag chat "What files need to be modified for the new feature?"

# Update context for specific file
luna-rag update src/auth/login.ts

# Get usage analytics
luna-rag stats
```

### Advanced Configuration
```javascript
// luna-rag.config.js
export default {
  projectPath: './',
  vectorStore: {
    provider: 'pinecone',
    apiKey: process.env.PINECONE_API_KEY,
    environment: 'us-west1-gcp-free',
    indexName: 'my-project-rag',
    dimension: 1536
  },
  tokenOptimization: {
    targetTokens: 4000,
    strategy: 'balanced',
    maxCompression: 0.7
  },
  aiProviders: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4'
    },
    anthropropic: {
      apiKey: process.env.ANTHROPIC_API_KEY
    }
  },
  extraction: {
    includePatterns: ['**/*.{js,ts,jsx,tsx,py,md}'],
    excludePatterns: ['node_modules/**', 'dist/**'],
    maxFileSize: 1024 * 1024
  }
};
```

## Output Files

```
.luna/{project}/rag/
├── contexts/
│   ├── index.json
│   ├── embeddings.json
│   └── metadata.json
├── reports/
│   ├── indexing-report.json
│   ├── optimization-report.json
│   └── usage-analytics.json
├── cache/
│   ├── query-cache.json
│   └── embedding-cache.json
└── luna-rag.config.js
```

## Integration with Luna Ecosystem

Seamlessly integrates with:
- **`luna-openai-app`** - Generate context-aware OpenAI apps
- **`luna-cloudflare`** - Deploy RAG to edge computing
- **`luna-task-executor`** - Execute tasks with enhanced context
- **`luna-code-review`** - Code review with project context
- **All Luna agents** - Enhanced with RAG-powered intelligence

## Quality Checklist

- [ ] Project successfully indexed
- [ ] Vector database properly configured
- [ ] Contexts accurately extracted and categorized
- [ ] Token optimization working effectively
- [ ] Query responses are relevant and accurate
- [ ] Multi-provider AI integration functional
- [ ] Cost optimization strategies applied
- [ ] Usage analytics and monitoring active
- [ ] Context updates working correctly
- [ ] Integration with other Luna agents working

## Instructions for Execution

1. **Configure vector database** (Pinecone, Weaviate, Qdrant, or Chroma)
2. **Set up AI providers** (OpenAI, Anthropic, DeepSeek, Google)
3. **Initialize RAG service** with project configuration
4. **Extract and index project contexts** with intelligent analysis
5. **Configure token optimization** strategies and budgets
6. **Test context retrieval** with sample queries
7. **Monitor performance** and optimization effectiveness
8. **Integrate with other Luna agents** for enhanced capabilities

Transform your AI agents with context-aware intelligence! 🧠✨

---

## MCP Tool Integration

When called as an MCP tool, Luna RAG provides these capabilities:

### `setup_rag_system`
- **Description**: Initialize complete RAG system for a project
- **Parameters**:
  ```json
  {
    "projectPath": "./",
    "vectorStore": {
      "provider": "pinecone|weaviate|qdrant|chroma",
      "config": { ... }
    },
    "tokenOptimization": {
      "targetTokens": 4000,
      "strategy": "balanced|maximum|quality"
    }
  }
  ```
- **Returns**: RAG system configuration and indexing report

### `query_context`
- **Description**: Retrieve relevant context for queries
- **Parameters**:
  ```json
  {
    "query": "How does authentication work?",
    "topK": 10,
    "optimizeTokens": true,
    "additionalContext": "User is working on login feature"
  }
  ```
- **Returns**: Optimized contexts with relevance scores

### `chat_with_context`
- **Description**: AI chat with project context
- **Parameters**:
  ```json
  {
    "query": "What files need to be modified?",
    "conversationHistory": [...],
    "contextFilter": { "fileType": "function" }
  }
  ```
- **Returns**: AI response with context sources and usage analytics

### `update_rag_index`
- **Description**: Update RAG index for changed files
- **Parameters**:
  ```json
  {
    "files": ["src/auth/login.ts", "README.md"],
    "incremental": true
  }
  ```
- **Returns**: Update confirmation and new context count

Enhance your AI agents with intelligent context retrieval! 🚀