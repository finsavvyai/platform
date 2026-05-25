/**
 * Unified Query Engine for Financial Regulatory RAG System
 *
 * Combines vector similarity search, knowledge graph traversal, and hybrid retrieval
 * to provide comprehensive compliance intelligence and regulatory insights.
 */

import { QueryRequest, QueryResult, QueryType, QueryContext } from '../types/query-types';
import type { VectorSearchResult } from '../../vectorize/types';
import type { KnowledgeGraphEntity, KnowledgeGraphRelationship, GraphPath } from '../../knowledge-graph/types/graph-types';

export interface QueryEngineDependencies {
  vectorService: any;        // VectorizeService
  graphService: any;         // KnowledgeGraphBuilder
  aiService: any;            // Workers AI
  cache: any;                // QueryCache
  logger: any;
}

export interface QueryConfig {
  search: {
    defaultMaxResults: number;
    vectorThreshold: number;
    graphMaxDepth: number;
    hybridWeights: {
      vector: number;
      graph: number;
      keyword: number;
    };
  };
  performance: {
    cacheTTL: number;
    timeoutMs: number;
    enableParallel: boolean;
  };
  explanation: {
    enableExplanations: boolean;
    detailLevel: 'basic' | 'detailed';
  };
}

export class UnifiedQueryEngine {
  private config: QueryConfig;

  constructor(
    private deps: QueryEngineDependencies,
    config: QueryConfig = UnifiedQueryEngine.defaultConfig()
  ) {
    this.config = config;
  }

  /**
   * Main query processing method
   */
  async query(request: QueryRequest): Promise<QueryResult> {
    const startTime = Date.now();

    this.deps.logger?.info("Processing query", {
      queryId: request.id,
      type: request.type,
      userId: request.userId
    });

    try {
      // Check cache first
      if (this.shouldCache(request)) {
        const cached = await this.deps.cache.get(this.getCacheKey(request));
        if (cached) {
          this.deps.logger?.info("Cache hit for query", { queryId: request.id });
          return cached;
        }
      }

      // Process query based on type
      let result: QueryResult;

      switch (request.type) {
        case 'semantic':
          result = await this.processSemanticQuery(request);
          break;
        case 'graph':
          result = await this.processGraphQuery(request);
          break;
        case 'hybrid':
          result = await this.processHybridQuery(request);
          break;
        case 'question':
          result = await this.processQuestionQuery(request);
          break;
        case 'compliance':
          result = await this.processComplianceQuery(request);
          break;
        case 'risk_assessment':
          result = await this.processRiskQuery(request);
          break;
        default:
          result = await this.processDefaultQuery(request);
      }

      // Apply post-processing
      result = await this.postProcessResult(request, result);

      // Cache result if appropriate
      if (this.shouldCache(request)) {
        await this.deps.cache.set(
          this.getCacheKey(request),
          result,
          this.config.performance.cacheTTL
        );
      }

      const executionTime = Date.now() - startTime;
      result.executionStats.totalTime = executionTime;

      this.deps.logger?.info("Query completed", {
        queryId: request.id,
        executionTime,
        resultCount: result.metadata.totalResults
      });

      return result;

    } catch (error) {
      this.deps.logger?.error("Query processing failed", {
        queryId: request.id,
        error: error.message,
        stack: error.stack
      });

      return this.createErrorResult(request, error);
    }
  }

  /**
   * Process semantic (vector) queries
   */
  private async processSemanticQuery(request: QueryRequest): Promise<QueryResult> {
    const query = request.query as any; // QueryVector

    // Generate embedding for query
    const queryVector = query.vector ||
      await this.generateQueryEmbedding(query.text);

    // Perform vector search
    const vectorResults = await this.deps.vectorService.query(queryVector, {
      topK: request.options?.maxResults || this.config.search.defaultMaxResults,
      filter: this.buildVectorFilter(request.filters),
      includeMetadata: true
    });

    // Convert to search results
    const searchResults = vectorResults.map((match: VectorSearchResult) => ({
      id: match.id,
      type: 'document' as const,
      content: match.metadata?.text || '',
      title: match.metadata?.title || '',
      source: {
        documentId: match.metadata?.documentId || '',
        documentTitle: match.metadata?.documentTitle || '',
        sectionId: match.metadata?.sectionId,
        jurisdiction: match.metadata?.jurisdiction || '',
        documentType: match.metadata?.documentType || '',
        url: match.metadata?.url
      },
      relevanceScore: match.score,
      confidence: match.metadata?.confidence || 0.8,
      metadata: match.metadata || {},
      vectorSimilarity: match.score,
      hybridScore: match.score
    }));

    return {
      id: `result_${request.id}`,
      queryId: request.id,
      type: 'document_chunks',
      results: searchResults,
      metadata: {
        totalResults: searchResults.length,
        returnedResults: searchResults.length,
        hasMore: false,
        queryTime: Date.now(),
        indexTime: 0,
        processingMethod: 'vector',
        resultQuality: {
          averageConfidence: this.calculateAverageConfidence(searchResults),
          relevanceDistribution: this.calculateRelevanceDistribution(searchResults),
          coverageScore: this.calculateCoverageScore(searchResults)
        }
      },
      executionStats: {
        totalTime: 0,
        components: {
          queryParsing: 0,
          vectorSearch: Date.now(),
          resultMerging: 0,
          reranking: 0,
          explanation: 0
        },
        resources: {
          vectorQueries: 1,
          graphNodes: 0,
          graphEdges: 0,
          documentsProcessed: searchResults.length
        },
        performance: {
          throughput: searchResults.length / 1000, // per second
          latencyP95: 0,
          cacheHitRate: 0
        }
      }
    };
  }

  /**
   * Process graph traversal queries
   */
  private async processGraphQuery(request: QueryRequest): Promise<QueryResult> {
    const graphQuery = request.query as any; // QueryGraph

    // Find start and end entities
    const startEntity = await this.findEntity(graphQuery.startEntity);
    const endEntity = await this.findEntity(graphQuery.endEntity);

    if (!startEntity) {
      throw new Error(`Start entity not found: ${graphQuery.startEntity}`);
    }

    // Perform graph traversal
    const paths = await this.findGraphPaths(startEntity, endEntity, {
      maxDepth: graphQuery.maxDepth || this.config.search.graphMaxDepth,
      pathType: graphQuery.pathType || 'shortest',
      entityFilters: graphQuery.entityFilters || [],
      relationshipFilters: graphQuery.relationshipFilters || [],
      constraints: graphQuery.pathConstraints || {}
    });

    // Convert paths to search results
    const searchResults = paths.map((path: GraphPath, index: number) => ({
      id: `path_${request.id}_${index}`,
      type: 'path' as const,
      content: this.pathToDescription(path),
      title: `Regulatory Path: ${path.entities[0]?.name} → ${path.entities[path.entities.length - 1]?.name}`,
      source: {
        documentId: path.relationships[0]?.evidence[0]?.documentId || '',
        documentTitle: 'Knowledge Graph',
        jurisdiction: path.entities[0]?.jurisdiction || '',
        documentType: 'knowledge_graph'
      },
      relevanceScore: path.strength,
      confidence: this.calculatePathConfidence(path),
      metadata: {
        pathLength: path.length,
        entities: path.entities.map(e => e.name),
        relationships: path.relationships.map(r => r.type)
      },
      graphPaths: [path],
      graphScore: path.strength,
      hybridScore: path.strength
    }));

    return {
      id: `result_${request.id}`,
      queryId: request.id,
      type: 'graph_paths',
      results: searchResults,
      metadata: {
        totalResults: searchResults.length,
        returnedResults: searchResults.length,
        hasMore: false,
        queryTime: Date.now(),
        indexTime: 0,
        processingMethod: 'graph',
        resultQuality: {
          averageConfidence: this.calculateAverageConfidence(searchResults),
          relevanceDistribution: this.calculateRelevanceDistribution(searchResults),
          coverageScore: this.calculateCoverageScore(searchResults)
        }
      },
      executionStats: {
        totalTime: 0,
        components: {
          queryParsing: 0,
          vectorSearch: 0,
          graphTraversal: Date.now(),
          resultMerging: 0,
          reranking: 0,
          explanation: 0
        },
        resources: {
          vectorQueries: 0,
          graphNodes: this.countNodes(paths),
          graphEdges: this.countEdges(paths),
          documentsProcessed: 0
        },
        performance: {
          throughput: searchResults.length / 1000,
          latencyP95: 0,
          cacheHitRate: 0
        }
      }
    };
  }

  /**
   * Process hybrid queries combining vector and graph search
   */
  private async processHybridQuery(request: QueryRequest): Promise<QueryResult> {
    const hybridQuery = request.query as any; // QueryHybrid
    const vectorWeight = hybridQuery.vectorWeight || this.config.search.hybridWeights.vector;
    const graphWeight = hybridQuery.graphWeight || this.config.search.hybridWeights.graph;

    // Execute vector and graph searches in parallel
    const [vectorResult, graphResult] = await Promise.all([
      this.processSemanticQuery({
        ...request,
        type: 'semantic',
        query: { text: hybridQuery.textQuery }
      }),
      hybridQuery.graphQuery ?
        this.processGraphQuery({
          ...request,
          type: 'graph',
          query: hybridQuery.graphQuery
        }) :
        Promise.resolve(null)
    ]);

    // Combine and re-rank results
    const combinedResults = this.combineResults(
      vectorResult.results,
      graphResult?.results || [],
      { vectorWeight, graphWeight }
    );

    // Apply reranking if specified
    const finalResults = hybridQuery.rerankOptions ?
      await this.rerankResults(combinedResults, hybridQuery.rerankOptions) :
      combinedResults;

    return {
      id: `result_${request.id}`,
      queryId: request.id,
      type: 'mixed_results',
      results: finalResults.slice(0, request.options?.maxResults || this.config.search.defaultMaxResults),
      metadata: {
        totalResults: finalResults.length,
        returnedResults: finalResults.length,
        hasMore: finalResults.length > (request.options?.maxResults || this.config.search.defaultMaxResults),
        queryTime: Date.now(),
        indexTime: 0,
        processingMethod: 'hybrid',
        resultQuality: {
          averageConfidence: this.calculateAverageConfidence(finalResults),
          relevanceDistribution: this.calculateRelevanceDistribution(finalResults),
          coverageScore: this.calculateCoverageScore(finalResults)
        },
        jurisdictionBreakdown: this.calculateJurisdictionBreakdown(finalResults),
        entityTypeBreakdown: this.calculateEntityTypeBreakdown(finalResults)
      },
      executionStats: {
        totalTime: 0,
        components: {
          queryParsing: 0,
          vectorSearch: vectorResult.executionStats.components.vectorSearch,
          graphTraversal: graphResult?.executionStats.components.graphTraversal || 0,
          resultMerging: Date.now(),
          reranking: hybridQuery.rerankOptions ? Date.now() : 0,
          explanation: 0
        },
        resources: {
          vectorQueries: 1,
          graphNodes: graphResult?.executionStats.resources.graphNodes || 0,
          graphEdges: graphResult?.executionStats.resources.graphEdges || 0,
          documentsProcessed: finalResults.length
        },
        performance: {
          throughput: finalResults.length / 1000,
          latencyP95: 0,
          cacheHitRate: 0
        }
      }
    };
  }

  /**
   * Process natural language questions with LLM assistance
   */
  private async processQuestionQuery(request: QueryRequest): Promise<QueryResult> {
    const question = request.query as string;

    // Use AI to classify and rewrite the question
    const classification = await this.classifyQuestion(question);

    // Rewrite as appropriate query type
    switch (classification.type) {
      case 'entity_search':
        return this.processEntityQuestion(request, question);
      case 'compliance_check':
        return this.processComplianceQuery(request);
      case 'relationship_query':
        return this.processRelationshipQuestion(request, question);
      default:
        // Fallback to semantic search
        return this.processSemanticQuery({
          ...request,
          type: 'semantic',
          query: { text: question }
        });
    }
  }

  /**
   * Process compliance-specific queries
   */
  private async processComplianceQuery(request: QueryRequest): Promise<QueryResult> {
    // Focus on compliance requirements, regulations, and obligations
    const complianceFilters = {
      ...request.filters,
      documentTypes: ['regulation', 'requirement', 'guideline', 'standard'],
      entityTypes: ['regulatory_body', 'compliance_program', 'requirement']
    };

    return this.processSemanticQuery({
      ...request,
      type: 'semantic',
      query: request.query,
      filters: complianceFilters
    });
  }

  /**
   * Process risk assessment queries
   */
  private async processRiskQuery(request: QueryRequest): Promise<QueryResult> {
    const riskFilters = {
      ...request.filters,
      entityTypes: ['risk_factor', 'threat_actor', 'vulnerability', 'control_measure']
    };

    const hybridQuery = {
      textQuery: request.query as string,
      graphQuery: {
        entityFilters: ['risk_factor', 'threat_actor', 'vulnerability'],
        relationshipFilters: ['poses_risk_to', 'vulnerable_to', 'mitigates']
      }
    };

    return this.processHybridQuery({
      ...request,
      type: 'hybrid',
      query: hybridQuery,
      filters: riskFilters
    });
  }

  /**
   * Process default/fallback queries
   */
  private async processDefaultQuery(request: QueryRequest): Promise<QueryResult> {
    // Default to semantic search
    return this.processSemanticQuery({
      ...request,
      type: 'semantic',
      query: typeof request.query === 'string' ? { text: request.query } : request.query
    });
  }

  // Helper methods

  private async generateQueryEmbedding(text: string): Promise<number[]> {
    const response = await this.deps.aiService.run('@cf/baai/bge-base-en-v1.5', {
      text: [text]
    });
    return response.data[0].embedding;
  }

  private buildVectorFilter(filters?: any): any {
    if (!filters) return {};

    const vectorFilter: any = {};

    if (filters.jurisdictions) {
      vectorFilter.jurisdiction = { $in: filters.jurisdictions };
    }

    if (filters.confidence?.min) {
      vectorFilter.confidence = { $gte: filters.confidence.min };
    }

    if (filters.documentTypes) {
      vectorFilter.documentType = { $in: filters.documentTypes };
    }

    return vectorFilter;
  }

  private shouldCache(request: QueryRequest): boolean {
    // Cache semantic, graph, and compliance queries
    return ['semantic', 'graph', 'compliance', 'risk_assessment'].includes(request.type);
  }

  private getCacheKey(request: QueryRequest): string {
    return `query_${request.id}_${JSON.stringify({
      type: request.type,
      query: request.query,
      filters: request.filters,
      options: request.options
    })}`;
  }

  private createErrorResult(request: QueryRequest, error: Error): QueryResult {
    return {
      id: `error_${request.id}`,
      queryId: request.id,
      type: 'document_chunks',
      results: [],
      metadata: {
        totalResults: 0,
        returnedResults: 0,
        hasMore: false,
        queryTime: Date.now(),
        indexTime: 0,
        processingMethod: 'error',
        resultQuality: {
          averageConfidence: 0,
          relevanceDistribution: {},
          coverageScore: 0
        }
      },
      executionStats: {
        totalTime: Date.now(),
        components: {
          queryParsing: 0,
          vectorSearch: 0,
          graphTraversal: 0,
          resultMerging: 0,
          reranking: 0,
          explanation: 0
        },
        resources: {
          vectorQueries: 0,
          graphNodes: 0,
          graphEdges: 0,
          documentsProcessed: 0
        },
        performance: {
          throughput: 0,
          latencyP95: 0,
          cacheHitRate: 0
        }
      }
    };
  }

  private static defaultConfig(): QueryConfig {
    return {
      search: {
        defaultMaxResults: 20,
        vectorThreshold: 0.7,
        graphMaxDepth: 5,
        hybridWeights: {
          vector: 0.6,
          graph: 0.3,
          keyword: 0.1
        }
      },
      performance: {
        cacheTTL: 300000, // 5 minutes
        timeoutMs: 30000, // 30 seconds
        enableParallel: true
      },
      explanation: {
        enableExplanations: true,
        detailLevel: 'basic'
      }
    };
  }

  // Placeholder implementations for complex methods
  private async findEntity(spec: any): Promise<KnowledgeGraphEntity | null> { return null; }
  private async findGraphPaths(start: KnowledgeGraphEntity, end: KnowledgeGraphEntity | undefined, options: any): Promise<GraphPath[]> { return []; }
  private pathToDescription(path: GraphPath): string { return ''; }
  private calculatePathConfidence(path: GraphPath): number { return 0.8; }
  private combineResults(vectorResults: any[], graphResults: any[], weights: any): any[] { return [...vectorResults, ...graphResults]; }
  private async rerankResults(results: any[], options: any): Promise<any[]> { return results; }
  private calculateAverageConfidence(results: any[]): number { return 0.8; }
  private calculateRelevanceDistribution(results: any[]): Record<string, number> { return {}; }
  private calculateCoverageScore(results: any[]): number { return 0.8; }
  private countNodes(paths: GraphPath[]): number { return 0; }
  private countEdges(paths: GraphPath[]): number { return 0; }
  private calculateJurisdictionBreakdown(results: any[]): Record<string, number> { return {}; }
  private calculateEntityTypeBreakdown(results: any[]): Record<string, number> { return {}; }
  private async classifyQuestion(question: string): Promise<{ type: string }> { return { type: 'entity_search' }; }
  private async processEntityQuestion(request: QueryRequest, question: string): Promise<QueryResult> { return this.processDefaultQuery(request); }
  private async processRelationshipQuestion(request: QueryRequest, question: string): Promise<QueryResult> { return this.processDefaultQuery(request); }
  private async postProcessResult(request: QueryRequest, result: QueryResult): Promise<QueryResult> { return result; }
}
