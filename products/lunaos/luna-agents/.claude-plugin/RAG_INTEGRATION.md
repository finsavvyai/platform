# Enhanced RAG Integration for Luna Agents

## Overview

The Luna Agents plugin now includes comprehensive RAG (Retrieval-Augmented Generation) capabilities that transform how you interact with your codebase. This enhanced system provides intelligent code understanding, semantic search, and context-aware AI assistance.

## 🚀 Key Features

### **Comprehensive Repository Processing**
- **Multi-language Support**: 25+ programming languages and file types
- **Smart File Detection**: Automatic project type recognition and configuration
- **Metadata Extraction**: Functions, imports, comments, Git history, and author tracking
- **Flexible Chunking**: 5 strategies including semantic, recursive, sliding, and hybrid

### **Enhanced Search & Discovery**
- **Semantic Search**: Find code by meaning, not just keywords
- **Context-Aware Queries**: Intelligent understanding of development context
- **Real-time Indexing**: Automatic updates as your codebase evolves
- **Conversation History**: Maintain context across multiple queries

### **Developer-Friendly Tools**
- **Interactive Indexing**: Guided repository scanning with user confirmation
- **Project Analysis**: Automatic detection of frameworks, languages, and patterns
- **Smart Filtering**: Configurable include/exclude patterns for optimal results

## 📋 Quick Start

### 1. Initialize Your Project

```javascript
// Access RAG capabilities through the Luna plugin
const luna = await initializeLunaPlugin();

// Interactive repository indexing
await luna.capabilities.interactiveIndexing();
```

### 2. Search Your Codebase

```javascript
// Semantic search with context
const results = await luna.capabilities.searchWithEnhancement(
  "How is authentication implemented in this project?"
);

// Contextual queries for common development tasks
const architecture = await luna.capabilities.contextualQuery('architecture');
const apis = await luna.capabilities.contextualQuery('apis');
```

### 3. Get System Status

```javascript
// Check RAG system health and statistics
const status = await luna.capabilities.getSystemStatus();
console.log(`Indexed ${status.status.statistics.totalDocuments} documents`);
```

## 🔧 Advanced Usage

### Repository Indexing

```javascript
// Index current project with custom options
await luna.capabilities.indexCurrentProject({
  filePatterns: [
    '**/*.ts',
    '**/*.tsx', 
    '**/*.js',
    '**/*.jsx',
    '**/*.py',
    '**/*.md'
  ],
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/*.test.*'
  ],
  metadata: {
    environment: 'development',
    version: '2.0.0'
  }
});
```

### Individual File Indexing

```javascript
// Index specific files
await luna.capabilities.indexFile(
  'src/components/Button.tsx',
  fileContent,
  {
    type: 'react-component',
    category: 'ui'
  }
);
```

### Enhanced Search Options

```javascript
// Advanced search with filtering
const searchResults = await luna.capabilities.queryRAG(
  "Redux store configuration",
  {
    maxResults: 10,
    temperature: 0.5,
    filters: {
      language: 'typescript',
      framework: 'react'
    }
  }
);
```

## 🎯 Contextual Queries

The RAG system provides predefined contextual queries for common development needs:

### Available Contexts

- `'overview'` - Project overview and main components
- `'architecture'` - Architecture and design patterns
- `'apis'` - API endpoints and their purposes  
- `'database'` - Database schema and data models
- `'testing'` - Testing strategies and frameworks
- `'deployment'` - Deployment configurations
- `'security'` - Security measures and authentication
- `'performance'` - Performance optimizations
- `'recent-changes'` - Latest codebase updates

```javascript
// Example usage
const testingApproach = await luna.capabilities.contextualQuery('testing');
const securityMeasures = await luna.capabilities.contextualQuery('security');
```

## 📊 Supported File Types

### Programming Languages
- **Web**: TypeScript, JavaScript, JSX, TSX
- **Backend**: Python, Java, Go, Rust, C++, C#, PHP, Ruby
- **Mobile**: Swift, Kotlin
- **Data**: SQL, JSON, XML, YAML
- **Config**: Dockerfile, TOML, INI
- **Scripts**: Shell, Bash, Zsh

### Documentation
- **Markdown**: .md files
- **Text**: .txt, .rst
- **Configuration**: README, CHANGELOG, LICENSE

## 🛠 Configuration Options

### Indexing Configuration

```javascript
const indexingOptions = {
  // File patterns to include
  filePatterns: [
    '**/*.ts',
    '**/*.tsx',
    '**/*.js',
    '**/*.jsx'
  ],
  
  // Patterns to exclude
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.git/**'
  ],
  
  // Processing options
  extractGitMetadata: true,
  followSymlinks: false,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  
  // Custom metadata
  metadata: {
    projectType: 'react-typescript',
    environment: 'development',
    team: 'frontend'
  }
};
```

### Search Configuration

```javascript
const searchOptions = {
  maxResults: 5,           // Maximum results to return
  temperature: 0.7,        // Response creativity (0-1)
  includeContext: true,    // Include surrounding context
  includeSources: true,    // Include source references
  
  filters: {
    language: 'typescript',
    framework: 'react',
    filePattern: '**/*.tsx'
  }
};
```

## 📈 Performance Features

### Smart Caching
- **API Response Caching**: 5-minute cache for repeated queries
- **Incremental Indexing**: Only process changed files
- **Batch Processing**: Efficient handling of large repositories

### Memory Management
- **Chunking Strategies**: Optimize memory usage with intelligent chunking
- **Streaming Processing**: Handle large files without memory overload
- **Background Processing**: Non-blocking indexing operations

## 🔍 Example Workflows

### 1. New Project Onboarding

```javascript
// 1. Automatically analyze and index new project
await luna.capabilities.interactiveIndexing();

// 2. Get project overview
const overview = await luna.capabilities.contextualQuery('overview');

// 3. Understand architecture
const architecture = await luna.capabilities.contextualQuery('architecture');

// 4. Review API structure
const apis = await luna.capabilities.contextualQuery('apis');
```

### 2. Feature Development

```javascript
// 1. Search for similar functionality
const existingFeatures = await luna.capabilities.searchWithEnhancement(
  "User authentication flow implementation"
);

// 2. Understand testing patterns
const testingPatterns = await luna.capabilities.contextualQuery('testing');

// 3. Find relevant components
const components = await luna.capabilities.queryRAG(
  "User profile form components",
  {
    filters: {
      type: 'component',
      category: 'user-interface'
    }
  }
);
```

### 3. Code Review

```javascript
// 1. Get recent changes
const recentChanges = await luna.capabilities.contextualQuery('recent-changes');

// 2. Search for related code
const relatedCode = await luna.capabilities.searchWithEnhancement(
  "Payment processing logic"
);

// 3. Review security considerations
const securityReview = await luna.capabilities.contextualQuery('security');
```

## 🐛 Troubleshooting

### Common Issues

1. **Indexing Timeout**
   - Reduce file patterns or exclude large directories
   - Use smaller `maxFileSize` limit
   - Enable incremental indexing

2. **Poor Search Results**
   - Check file patterns include relevant code
   - Verify language detection is working
   - Try different temperature settings

3. **Memory Issues**
   - Use smaller chunk sizes
   - Enable streaming processing
   - Limit concurrent operations

### Debug Information

```javascript
// Get detailed system status
const status = await luna.capabilities.getSystemStatus();
console.log('RAG Status:', status);

// Check conversation history
const history = await luna.capabilities.getConversationHistory(5);
console.log('Recent Queries:', history);

// Get token usage statistics
const usage = await luna.capabilities.getTokenUsage();
console.log('Token Usage:', usage);
```

## 🚦 Best Practices

### Indexing
- Start with specific file patterns, expand as needed
- Exclude generated files and dependencies
- Use descriptive metadata for better organization
- Index after major code changes

### Searching
- Use specific, descriptive queries
- Leverage contextual queries for common tasks
- Combine semantic search with filters for precision
- Review conversation history for context

### Performance
- Use caching for repeated queries
- Monitor token usage for cost management
- Clean up conversation history periodically
- Use appropriate temperature settings

## 📚 API Reference

### Core Methods

- `indexCurrentProject(options)` - Index current repository
- `interactiveIndexing()` - Guided indexing with confirmation
- `searchWithEnhancement(query, options)` - Enhanced semantic search
- `contextualQuery(intent, options)` - Predefined contextual queries
- `getSystemStatus()` - System health and statistics

### Advanced Methods

- `indexRepository(path, options)` - Index specific repository
- `indexFile(path, content, metadata)` - Index individual files
- `searchDocuments(query, options)` - Document-only search
- `deleteDocuments(ids)` - Remove indexed documents
- `getConversationHistory(limit)` - Query conversation history

## 🔗 Integration with Claude Code

The enhanced RAG system seamlessly integrates with Claude Code, providing:

- **Intelligent Code Context**: Automatic understanding of your project structure
- **Enhanced Suggestions**: Context-aware code recommendations
- **Semantic Navigation**: Find code by meaning and purpose
- **Historical Context**: Maintain context across development sessions

## 🎉 Next Steps

1. **Try Interactive Indexing**: `await luna.capabilities.interactiveIndexing()`
2. **Explore Contextual Queries**: Test different predefined contexts
3. **Customize Configuration**: Adapt file patterns and filters
4. **Monitor Performance**: Track token usage and response times
5. **Extend Functionality**: Add custom metadata and analysis

---

*The enhanced RAG system transforms your Luna Agents plugin into an intelligent coding companion that truly understands your project.*