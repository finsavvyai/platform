/**
 * Core Query Interface for Financial Regulatory RAG System
 *
 * Provides unified access to vector search, knowledge graph traversal,
 * and hybrid retrieval capabilities for compliance intelligence.
 */

import {
  QueryRequest,
  QueryResult,
  QueryType,
  QueryContext,
  QueryFilters,
  QueryOptions
} from '../types/query-types';

export interface QueryEngineConfig {
  search: {
    defaultMaxResults: number;
    vectorThreshold: number;
    graphMaxDepth: number;
  };
  performance: {
    cacheTTL: number;
    timeoutMs: number;
  };
}

export class QueryInterface {
  private config: QueryEngineConfig;

  constructor(
    private vectorService: any,
    private graphService: any,
    private aiService: any,
    private logger: any,
    config?: Partial<QueryEngineConfig>
  ) {
    this.config = {
      search: {
        defaultMaxResults: 20,
        vectorThreshold: 0.7,
        graphMaxDepth: 5
      },
      performance: {
        cacheTTL: 300000,
        timeoutMs: 30000
      },
      ...config
    };
  }

  /**
   * Main query entry point
   */
  async query(request: QueryRequest): Promise<QueryResult> {
    const startTime = Date.now();

    this.logger?.info("Processing query", {
      queryId: request.id,
      type: request.type,
      userId: request.userId
    });

    try {
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
        case 'compliance':
          result = await this.processComplianceQuery(request);
          break;
        case 'risk_assessment':
          result = await this.processRiskQuery(request);
          break;
        default:
          result = await this.processDefaultQuery(request);
      }

      result.executionStats.totalTime = Date.now() - startTime;
      return result;

    } catch (error) {
      this.logger?.error("Query processing failed", {
        queryId: request.id,
        error: error.message
      });

      return this.createErrorResult(request, error);
    }
  }

  /**
   * Process semantic (vector similarity) queries
   */
  private async processSemanticQuery(request: QueryRequest): Promise<QueryResult> {
    const query = request.query as any; // QueryVector

    // Generate embedding for query text if not provided
    let queryVector = query.vector;
    if (!queryVector && query.text) {
      queryVector = await this.generateQueryEmbedding(query.text);
    }

    if (!queryVector) {
      throw new Error("No query vector or text provided");
    }

    // Build filters
    const filters = this.buildFilters(request.filters);

    // Perform vector search
    const vectorResults = await this.vectorService.query(queryVector, {
      topK: request.options?.maxResults || this.config.search.defaultMaxResults,
      filter: filters,
      includeMetadata: true
    });

    // Convert to search results format
    const searchResults = vectorResults.map((match: any, index: number) => ({
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
          relevanceDistribution: {},
          coverageScore: 0.8
        }
      },
      executionStats: {
        totalTime: 0,
        components: {
          queryParsing: 0,
          vectorSearch: Date.now(),
          graphTraversal: 0,
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
          throughput: searchResults.length / 1000,
          latencyP95: 0,
          cacheHitRate: 0
        }
      }
    };
  }

  /**
   * Process knowledge graph traversal queries
   */
  private async processGraphQuery(request: QueryRequest): Promise<QueryResult> {
    const graphQuery = request.query as any; // QueryGraph

    // This would integrate with the knowledge graph service
    // For now, return placeholder result
    const searchResults = [{
      id: `graph_result_${request.id}`,
      type: 'path' as const,
      content: 'Graph traversal results - implementation pending',
      title: 'Knowledge Graph Path',
      source: {
        documentId: '',
        documentTitle: 'Knowledge Graph',
        jurisdiction: request.context?.userContext?.jurisdiction || 'US',
        documentType: 'knowledge_graph'
      },
      relevanceScore: 0.8,
      confidence: 0.7,
      metadata: {
        graphQuery: graphQuery,
        processingNotes: 'Graph traversal implementation pending'
      },
      graphScore: 0.8,
      hybridScore: 0.8
    }];

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
          averageConfidence: 0.7,
          relevanceDistribution: {},
          coverageScore: 0.6
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
          graphNodes: 0,
          graphEdges: 0,
          documentsProcessed: 0
        },
        performance: {
          throughput: 1,
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

    // Execute vector search component
    const vectorResult = await this.processSemanticQuery({
      ...request,
      type: 'semantic',
      query: { text: hybridQuery.textQuery }
    });

    // Execute graph search component if specified
    let graphResult: QueryResult | null = null;
    if (hybridQuery.graphQuery) {
      graphResult = await this.processGraphQuery({
        ...request,
        type: 'graph',
        query: hybridQuery.graphQuery
      });
    }

    // Combine results with weighted scoring
    const vectorWeight = hybridQuery.vectorWeight || 0.7;
    const graphWeight = hybridQuery.graphWeight || 0.3;

    const combinedResults = this.combineResults(
      vectorResult.results,
      graphResult?.results || [],
      { vectorWeight, graphWeight }
    );

    return {
      id: `result_${request.id}`,
      queryId: request.id,
      type: 'mixed_results',
      results: combinedResults.slice(0, request.options?.maxResults || this.config.search.defaultMaxResults),
      metadata: {
        totalResults: combinedResults.length,
        returnedResults: combinedResults.length,
        hasMore: false,
        queryTime: Date.now(),
        indexTime: 0,
        processingMethod: 'hybrid',
        resultQuality: {
          averageConfidence: this.calculateAverageConfidence(combinedResults),
          relevanceDistribution: {},
          coverageScore: 0.85
        }
      },
      executionStats: {
        totalTime: 0,
        components: {
          queryParsing: 0,
          vectorSearch: Date.now(),
          graphTraversal: graphResult?.executionStats.components.graphTraversal || 0,
          resultMerging: Date.now(),
          reranking: 0,
          explanation: 0
        },
        resources: {
          vectorQueries: 1,
          graphNodes: graphResult?.executionStats.resources.graphNodes || 0,
          graphEdges: graphResult?.executionStats.resources.graphEdges || 0,
          documentsProcessed: combinedResults.length
        },
        performance: {
          throughput: combinedResults.length / 1000,
          latencyP95: 0,
          cacheHitRate: 0
        }
      }
    };
  }

  /**
   * Process compliance-specific queries
   */
  private async processComplianceQuery(request: QueryRequest): Promise<QueryResult> {
    // Add compliance-specific filters
    const complianceFilters: QueryFilters = {
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
    // Add risk-specific filters
    const riskFilters: QueryFilters = {
      ...request.filters,
      entityTypes: ['risk_factor', 'threat_actor', 'vulnerability', 'control_measure']
    };

    return this.processSemanticQuery({
      ...request,
      type: 'semantic',
      query: request.query,
      filters: riskFilters
    });
  }

  /**
   * Process default/fallback queries
   */
  private async processDefaultQuery(request: QueryRequest): Promise<QueryResult> {
    // Convert string queries to semantic queries
    if (typeof request.query === 'string') {
      return this.processSemanticQuery({
        ...request,
        type: 'semantic',
        query: { text: request.query }
      });
    }

    // Fallback to semantic search
    return this.processSemanticQuery(request);
  }

  // Helper methods

  private async generateQueryEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.aiService.run('@cf/baai/bge-base-en-v1.5', {
        text: [text]
      });
      return response.data[0].embedding;
    } catch (error) {
      this.logger?.error("Failed to generate query embedding", { error: error.message });
      throw error;
    }
  }

  private buildFilters(filters?: QueryFilters): any {
    if (!filters) return {};

    const vectorFilter: any = {};

    if (filters.jurisdictions?.length) {
      vectorFilter.jurisdiction = { $in: filters.jurisdictions };
    }

    if (filters.confidence?.min) {
      vectorFilter.confidence = { $gte: filters.confidence.min };
    }

    if (filters.documentTypes?.length) {
      vectorFilter.documentType = { $in: filters.documentTypes };
    }

    if (filters.entityTypes?.length) {
      vectorFilter.entityType = { $in: filters.entityTypes };
    }

    if (filters.dateRange?.validFrom) {
      vectorFilter.validFrom = { $gte: filters.dateRange.validFrom };
    }

    if (filters.dateRange?.validTo) {
      vectorFilter.validTo = { $lte: filters.dateRange.validTo };
    }

    return vectorFilter;
  }

  private combineResults(
    vectorResults: any[],
    graphResults: any[],
    weights: { vectorWeight: number; graphWeight: number }
  ): any[] {
    const combined = [...vectorResults, ...graphResults];

    // Apply weighted scoring
    return combined.map(result => {
      if (result.vectorSimilarity && result.graphScore) {
        result.hybridScore = (result.vectorSimilarity * weights.vectorWeight) +
                            (result.graphScore * weights.graphWeight);
      } else if (result.vectorSimilarity) {
        result.hybridScore = result.vectorSimilarity * weights.vectorWeight;
      } else if (result.graphScore) {
        result.hybridScore = result.graphScore * weights.graphWeight;
      }

      return result;
    })
    .sort((a, b) => (b.hybridScore || 0) - (a.hybridScore || 0));
  }

  private calculateAverageConfidence(results: any[]): number {
    if (results.length === 0) return 0;
    const total = results.reduce((sum, result) => sum + (result.confidence || 0), 0);
    return total / results.length;
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

  /**
   * Generate query suggestions based on input and context
   */
  async generateSuggestions(
    input: string,
    context?: QueryContext
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // Basic suggestion logic based on input patterns
    if (input.toLowerCase().includes('compliance') || input.toLowerCase().includes('require')) {
      suggestions.push('What are the compliance requirements for AML programs?');
      suggestions.push('What customer due diligence measures are required?');
    }

    if (input.toLowerCase().includes('risk') || input.toLowerCase().includes('assessment')) {
      suggestions.push('What are the key risk factors in financial regulations?');
      suggestions.push('How to conduct a risk assessment for BSA compliance?');
    }

    if (input.toLowerCase().includes('transaction') || input.toLowerCase().includes('reporting')) {
      suggestions.push('What are the reporting requirements for large transactions?');
      suggestions.push('When must a Suspicious Activity Report be filed?');
    }

    if (input.toLowerCase().includes('customer') || input.toLowerCase().includes('due diligence')) {
      suggestions.push('What are the CIP requirements for customer identification?');
      suggestions.push('How to verify customer identity under BSA regulations?');
    }

    return suggestions;
  }

  /**
   * Get query statistics and analytics
   */
  async getQueryStats(timeRange?: { from: string; to: string }): Promise<any> {
    // Placeholder implementation
    return {
      totalQueries: 0,
      averageResponseTime: 0,
      popularQueries: [],
      queryTypes: {},
      jurisdictionBreakdown: {}
    };
  }
}
