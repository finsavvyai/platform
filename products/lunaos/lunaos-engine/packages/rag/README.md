# RAG (Retrieval-Augmented Generation) Package

A comprehensive, production-ready RAG system for the Claude Agent Platform that provides advanced document processing, semantic search, and context-aware response generation.

## Features

### 🚀 Core Capabilities
- **Advanced Document Processing**: Multiple chunking strategies (fixed, semantic, recursive, sliding, hybrid)
- **Vector Database Integration**: Support for Pinecone, Weaviate, and extensible providers
- **Embedding Services**: OpenAI, HuggingFace with caching and rate limiting
- **Semantic Search**: Hybrid search, multi-query search, contextual search with conversation history
- **Context Building**: Intelligent context window management with compression and optimization
- **Response Generation**: LLM-agnostic response generation with citations and follow-up questions

### 🎯 Advanced Features
- **Multiple Search Strategies**: Semantic, BM25, TF-IDF, learning-to-rank
- **Context Compression**: Summarization, keyword extraction, redundancy removal
- **Temporal Awareness**: Time-decay relevance and temporal context building
- **Hierarchical Context**: Section-based context organization
- **Real-time Streaming**: Streaming search and response generation
- **Quality Metrics**: Performance evaluation and quality scoring

## Quick Start

### Installation

```bash
npm install @claude-agent/rag
```

### Basic Setup

```typescript
import { QuickRAG, ProcessedDocument } from '@claude-agent/rag';

// Quick setup with OpenAI + Pinecone
const ragEngine = await QuickRAG.openaiPinecone({
  openaiApiKey: process.env.OPENAI_API_KEY,
  pineconeApiKey: process.env.PINECONE_API_KEY,
  pineconeEnvironment: 'us-west1-gcp',
  pineconeIndex: 'my-rag-index'
});

// Add documents
const documents: ProcessedDocument[] = [
  // Your processed documents
];

await ragEngine.addDocuments(documents);

// Query the RAG system
const response = await ragEngine.query({
  text: 'What are the key benefits of microservices architecture?'
});

console.log(response.response);
console.log('Sources:', response.sources);
console.log('Confidence:', response.confidence);
```

### Advanced Setup

```typescript
import { RAGFactory, RAGEngineConfig } from '@claude-agent/rag';

const config: RAGEngineConfig = {
  embeddingService: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'text-embedding-ada-002',
    cacheSettings: {
      enabled: true,
      maxSize: 1000,
      ttl: 3600000 // 1 hour
    }
  },
  vectorDatabase: {
    provider: 'pinecone',
    apiKey: process.env.PINECONE_API_KEY,
    environment: 'us-west1-gcp',
    indexName: 'advanced-rag-index',
    dimensions: 1536,
    metric: 'cosine'
  },
  documentProcessing: {
    chunkSize: 1000,
    chunkOverlap: 200,
    minChunkSize: 200,
    maxChunkSize: 2000,
    supportedLanguages: ['en', 'es', 'fr', 'de']
  },
  maxRetrievedDocuments: 15,
  maxContextLength: 4000,
  defaultRankingAlgorithm: 'semantic',
  llmConfig: {
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 1000
  }
};

const ragEngine = await RAGFactory.createRAGEngine(config);
```

## Usage Examples

### Document Processing

```typescript
import { DocumentProcessorService } from '@claude-agent/rag';

const processor = new DocumentProcessorService({
  chunkSize: 1000,
  chunkOverlap: 200,
  supportedLanguages: ['en', 'es', 'fr']
});

// Process a single document
const processed = await processor.processDocument(
  documentContent,
  {
    documentId: 'doc-1',
    title: 'Microservices Architecture',
    source: 'technical-blog',
    chunkingStrategy: 'semantic'
  }
);

// Process multiple documents
const batchResults = await processor.processBatch([
  { content: doc1, documentId: 'doc-1' },
  { content: doc2, documentId: 'doc-2' },
  { content: doc3, documentId: 'doc-3' }
], {
  concurrency: 3,
  onProgress: (completed, total) => {
    console.log(`Processed ${completed}/${total} documents`);
  }
});
```

### Semantic Search

```typescript
import { SemanticSearchService } from '@claude-agent/rag';

const searchEngine = new SemanticSearchService(
  embeddingService,
  vectorDatabase,
  config
);

// Basic semantic search
const results = await searchEngine.search({
  text: 'microservices benefits',
  filters: {
    documentTypes: ['technical', 'blog'],
    dateRange: {
      start: new Date('2023-01-01'),
      end: new Date('2023-12-31')
    }
  }
}, {
  maxResults: 10,
  rankingAlgorithm: 'semantic',
  diversifyResults: true
});

// Hybrid search (semantic + keyword)
const hybridResults = await searchEngine.hybridSearch({
  text: 'scalable architecture patterns'
}, {
  semanticWeight: 0.7,
  keywordWeight: 0.3,
  maxResults: 10
});

// Contextual search with conversation history
const contextualResults = await searchEngine.contextualSearch(
  { text: 'How do they handle data consistency?' },
  ['What are microservices?', 'Tell me about their architecture']
);

// Multi-query search for complex queries
const multiResults = await searchEngine.multiQuerySearch([
  { text: 'microservices challenges' },
  { text: 'distributed systems problems' },
  { text: 'service mesh benefits' }
], {
  fusionMethod: 'rrf' // Reciprocal rank fusion
});

// Streaming search results
for await (const batch of searchEngine.streamSearch(
  { text: 'cloud native applications' },
  { batchSize: 5, maxResults: 20 }
)) {
  console.log('Search batch:', batch);
}
```

### Context Building

```typescript
import { ContextBuilderService } from '@claude-agent/rag';

const contextBuilder = new ContextBuilderService({
  maxTokens: 4000,
  defaultStrategy: 'semantic',
  defaultCompression: 'none'
});

// Build basic context
const context = await contextBuilder.buildContext(retrievedDocs, {
  query: 'microservices architecture',
  maxTokens: 3000,
  prioritizeRecency: true,
  includeMetadata: true
});

// Build hierarchical context
const hierarchicalContext = await contextBuilder.buildHierarchicalContext(
  retrievedDocs,
  [
    { title: 'Introduction', maxTokens: 500, priority: 1 },
    { title: 'Architecture', maxTokens: 1000, priority: 2 },
    { title: 'Implementation', maxTokens: 1000, priority: 2 },
    { title: 'Benefits', maxTokens: 500, priority: 3 }
  ]
);

// Build temporal context
const temporalContext = await contextBuilder.buildTemporalContext(
  retrievedDocs,
  {
    query: 'recent developments',
    timeWeight: 0.4,
    timeDecayFunction: 'exponential',
    referenceDate: new Date()
  }
);
```

### Response Generation

```typescript
import { ResponseGeneratorService } from '@claude-agent/rag';

const responseGenerator = new ResponseGeneratorService(llmProvider, {
  defaultModel: 'gpt-4',
  defaultTemperature: 0.7,
  defaultMaxTokens: 1000
});

// Generate response with citations
const response = await responseGenerator.generateResponse({
  query: 'What are the main benefits of microservices?',
  context: retrievedChunks.map(chunk => chunk.content),
  conversationHistory: [
    { role: 'user', content: 'Tell me about software architecture' },
    { role: 'assistant', content: 'Software architecture...' }
  ],
  options: {
    includeCitations: true,
    includeFollowUpQuestions: true,
    responseFormat: 'markdown'
  }
});

console.log('Answer:', response.answer);
console.log('Confidence:', response.confidence);
console.log('Citations:', response.citations);
console.log('Follow-up Questions:', response.followUpQuestions);

// Generate streaming response
for await (const chunk of responseGenerator.generateStreamingResponse({
  query: 'Explain service mesh',
  context: retrievedChunks.map(chunk => chunk.content),
  options: { includeCitations: true }
})) {
  console.log('Streaming response:', chunk.content);
  if (chunk.done) {
    console.log('Final citations:', chunk.citations);
  }
}
```

## Configuration

### RAG Engine Configuration

```typescript
interface RAGEngineConfig {
  // Embedding service configuration
  embeddingService: {
    provider: 'openai' | 'huggingface' | 'local';
    apiKey?: string;
    model?: string;
    dimensions?: number;
    batchSize?: number;
    cacheSettings?: {
      enabled: boolean;
      maxSize: number;
      ttl: number;
    };
  };

  // Vector database configuration
  vectorDatabase: {
    provider: 'pinecone' | 'weaviate' | 'chroma' | 'local';
    apiKey?: string;
    environment?: string;
    indexName?: string;
    namespace?: string;
    dimensions?: number;
    metric?: 'cosine' | 'euclidean' | 'dotproduct';
  };

  // Document processing configuration
  documentProcessing?: {
    chunkSize?: number;
    chunkOverlap?: number;
    minChunkSize?: number;
    maxChunkSize?: number;
    supportedLanguages?: string[];
  };

  // RAG engine settings
  maxRetrievedDocuments?: number;
  maxContextLength?: number;
  maxConversationHistory?: number;
  defaultRankingAlgorithm?: string;

  // LLM configuration
  llmConfig?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}
```

### Chunking Strategies

```typescript
enum ChunkingStrategy {
  FIXED = 'fixed',           // Fixed-size chunks
  SEMANTIC = 'semantic',     // Content-aware chunks
  RECURSIVE = 'recursive',   // Multiple separator-based
  SLIDING = 'sliding',       // Overlapping windows
  HYBRID = 'hybrid'          // Combination of strategies
}

// Usage example
const processed = await processor.processDocument(content, {
  chunkingStrategy: ChunkingStrategy.SEMANTIC
});
```

### Search Algorithms

```typescript
enum SearchRankingAlgorithm {
  SEMANTIC = 'semantic',           // Pure semantic similarity
  BM25 = 'bm25',                   // BM25 ranking
  TF_IDF = 'tfidf',               // TF-IDF ranking
  LEARNING_TO_RANK = 'ltr'        // Machine learning ranking
}

// Usage example
const results = await searchEngine.search(query, {
  rankingAlgorithm: SearchRankingAlgorithm.BM25
});
```

## Advanced Features

### Custom Embedding Service

```typescript
import { EmbeddingService } from '@claude-agent/rag';

class CustomEmbeddingService implements EmbeddingService {
  async generateEmbedding(text: string): Promise<number[]> {
    // Your custom embedding logic
    return await this.customEmbeddingModel(text);
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    // Batch processing logic
    return Promise.all(texts.map(text => this.generateEmbedding(text)));
  }
}

// Use with RAG engine
const ragEngine = await RAGFactory.createRAGEngine({
  embeddingService: {
    provider: 'custom',
    // Custom configuration
  }
  // ... other config
});
```

### Custom Vector Database

```typescript
import { VectorDatabase } from '@claude-agent/rag';

class CustomVectorDatabase implements VectorDatabase {
  async connect(): Promise<void> {
    // Your connection logic
  }

  async insert(vector: { id: string; values: number[]; metadata?: any }): Promise<void> {
    // Your insertion logic
  }

  async search(queryVector: number[], options?: any): Promise<any[]> {
    // Your search logic
    return [];
  }

  // Implement other required methods...
}
```

### Evaluation and Metrics

```typescript
// Evaluate RAG performance
const metrics = await ragEngine.evaluatePerformance([
  {
    query: 'What are microservices?',
    expectedAnswer: 'Microservices are...',
    relevantDocuments: ['doc-1', 'doc-2']
  },
  {
    query: 'How do they scale?',
    expectedAnswer: 'They scale by...',
    relevantDocuments: ['doc-3', 'doc-4']
  }
]);

console.log('Average confidence:', metrics.averageConfidence);
console.log('Average response time:', metrics.averageResponseTime);
console.log('Success rate:', metrics.successRate);
console.log('Hallucination rate:', metrics.hallucinationRate);
```

## Error Handling

```typescript
try {
  const response = await ragEngine.query({
    text: 'Your question here'
  });
  
  console.log(response.response);
} catch (error) {
  if (error.message.includes('rate limit')) {
    // Handle rate limiting
    console.log('Rate limit exceeded, please try again later');
  } else if (error.message.includes('connection')) {
    // Handle connection issues
    console.log('Connection error, checking network...');
  } else {
    // Handle other errors
    console.error('RAG error:', error.message);
  }
}
```

## Performance Optimization

### Caching

```typescript
const config: RAGEngineConfig = {
  embeddingService: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    cacheSettings: {
      enabled: true,
      maxSize: 1000,
      ttl: 3600000 // 1 hour
    }
  }
};
```

### Batch Processing

```typescript
// Process documents in batches
const results = await processor.processBatch(largeDocumentSet, {
  concurrency: 5, // Process 5 documents simultaneously
  onProgress: (completed, total) => {
    console.log(`Progress: ${completed}/${total}`);
  }
});
```

### Streaming

```typescript
// Stream search results
for await (const batch of searchEngine.streamSearch(query)) {
  // Process each batch as it arrives
  console.log('Received batch:', batch.length);
}

// Stream response generation
for await (const chunk of responseGenerator.generateStreamingResponse(request)) {
  // Display streaming response to user
  process.stdout.write(chunk.content);
}
```

## Best Practices

### 1. Document Preparation
- Use clean, well-structured documents
- Remove redundant information
- Ensure proper formatting (headings, lists, etc.)

### 2. Chunking Strategy Selection
- **Fixed**: Best for consistent document structures
- **Semantic**: Best for narrative or explanatory content
- **Recursive**: Best for mixed content types
- **Hybrid**: Best for complex documents

### 3. Search Optimization
- Use appropriate filters for better precision
- Leverage conversation history for contextual search
- Combine multiple search strategies for best results

### 4. Context Management
- Monitor token usage to stay within limits
- Use context compression for large document sets
- Prioritize recent and relevant content

### 5. Performance Monitoring
- Track query latency and success rates
- Monitor embedding cache hit rates
- Evaluate response quality regularly

## API Reference

### Main Classes

- **RAGEngine**: Main orchestrator for RAG functionality
- **DocumentProcessor**: Advanced document processing and chunking
- **SemanticSearchEngine**: Advanced semantic search capabilities
- **ContextBuilder**: Intelligent context window management
- **ResponseGenerator**: LLM-agnostic response generation

### Utility Classes

- **RAGFactory**: Factory for creating RAG components
- **QuickRAG**: Quick setup methods for common configurations

### Interfaces

The package provides comprehensive TypeScript interfaces for all components, ensuring type safety and better development experience.

## Contributing

1. Follow the existing code style and patterns
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Ensure error handling is robust
5. Consider performance implications

## License

MIT License - see LICENSE file for details.