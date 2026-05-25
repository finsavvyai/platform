/**
 * Query Interface for Financial Regulatory RAG System
 * Simple, focused implementation that combines vector and knowledge graph search
 */

export interface SimpleQueryRequest {
  query: string;
  type: 'semantic' | 'compliance' | 'risk' | 'entity';
  jurisdiction?: string;
  maxResults?: number;
  includeExcerpts?: boolean;
}

export interface SimpleQueryResult {
  results: QueryResultItem[];
  totalResults: number;
  queryTime: number;
  suggestions: string[];
}

export interface QueryResultItem {
  id: string;
  title: string;
  content: string;
  source: {
    documentId: string;
    documentTitle: string;
    sectionId?: string;
    jurisdiction: string;
    documentType: string;
  };
  relevanceScore: number;
  confidence: number;
  excerpt?: string;
  relatedEntities?: string[];
}

export class SimpleQueryEngine {
  constructor(
    private vectorService: any,
    private graphService: any,
    private aiService: any,
    private logger: any
  ) {}

  async search(request: SimpleQueryRequest): Promise<SimpleQueryResult> {
    const startTime = Date.now();

    try {
      // Generate embedding for query
      const queryVector = await this.generateEmbedding(request.query);

      // Perform vector search
      const vectorResults = await this.vectorService.query(queryVector, {
        topK: request.maxResults || 20,
        includeMetadata: true
      });

      // Convert to our result format
      const results: QueryResultItem[] = vectorResults.map((match: any) => ({
        id: match.id,
        title: match.metadata?.title || 'Untitled Section',
        content: match.metadata?.text || '',
        source: {
          documentId: match.metadata?.documentId || '',
          documentTitle: match.metadata?.documentTitle || 'Unknown Document',
          sectionId: match.metadata?.sectionId,
          jurisdiction: match.metadata?.jurisdiction || 'US',
          documentType: match.metadata?.documentType || 'regulation'
        },
        relevanceScore: match.score,
        confidence: match.metadata?.confidence || 0.8,
        excerpt: this.createExcerpt(match.metadata?.text || '', request.query),
        relatedEntities: match.metadata?.entities || []
      }));

      // Apply type-specific filtering and processing
      const filteredResults = this.applyTypeFilters(results, request);

      // Generate suggestions
      const suggestions = this.generateSuggestions(request.query, request.type);

      return {
        results: filteredResults,
        totalResults: filteredResults.length,
        queryTime: Date.now() - startTime,
        suggestions
      };

    } catch (error) {
      this.logger?.error('Search failed', { error: error.message });

      return {
        results: [],
        totalResults: 0,
        queryTime: Date.now() - startTime,
        suggestions: []
      };
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.aiService.run('@cf/baai/bge-base-en-v1.5', {
      text: [text]
    });
    return response.data[0].embedding;
  }

  private createExcerpt(content: string, query: string, maxLength: number = 200): string {
    if (!content) return '';

    // Find query terms in content
    const queryTerms = query.toLowerCase().split(' ');
    const contentLower = content.toLowerCase();

    let bestStart = 0;
    let bestScore = 0;

    // Find best excerpt location
    for (let i = 0; i < content.length - maxLength; i += 50) {
      const excerpt = content.slice(i, i + maxLength);
      const excerptLower = excerpt.toLowerCase();

      let score = 0;
      for (const term of queryTerms) {
        if (excerptLower.includes(term)) {
          score += 1;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestStart = i;
      }
    }

    let excerpt = content.slice(bestStart, bestStart + maxLength);

    // Add ellipsis if truncated
    if (bestStart > 0) excerpt = '...' + excerpt;
    if (bestStart + maxLength < content.length) excerpt = excerpt + '...';

    return excerpt;
  }

  private applyTypeFilters(results: QueryResultItem[], request: SimpleQueryRequest): QueryResultItem[] {
    let filtered = results;

    switch (request.type) {
      case 'compliance':
        filtered = results.filter(r =>
          r.source.documentType === 'regulation' ||
          r.source.documentType === 'requirement' ||
          r.title.toLowerCase().includes('requirement') ||
          r.title.toLowerCase().includes('compliance')
        );
        break;

      case 'risk':
        filtered = results.filter(r =>
          r.content.toLowerCase().includes('risk') ||
          r.content.toLowerCase().includes('threat') ||
          r.content.toLowerCase().includes('vulnerability') ||
          r.relatedEntities?.some(e => e.toLowerCase().includes('risk'))
        );
        break;

      case 'entity':
        // Focus on results with identified entities
        filtered = results.filter(r => r.relatedEntities && r.relatedEntities.length > 0);
        break;
    }

    // Apply jurisdiction filter if specified
    if (request.jurisdiction) {
      filtered = filtered.filter(r => r.source.jurisdiction === request.jurisdiction);
    }

    return filtered;
  }

  private generateSuggestions(query: string, type: string): string[] {
    const suggestions: string[] = [];
    const queryLower = query.toLowerCase();

    if (type === 'compliance') {
      if (queryLower.includes('customer')) {
        suggestions.push('Customer Identification Program requirements');
        suggestions.push('Customer Due Diligence obligations');
        suggestions.push('Beneficial owner verification requirements');
      }
      if (queryLower.includes('transaction')) {
        suggestions.push('Suspicious Activity Report filing requirements');
        suggestions.push('Large transaction reporting thresholds');
        suggestions.push('Transaction monitoring requirements');
      }
    }

    if (type === 'risk') {
      suggestions.push('Money laundering risk factors');
      suggestions.push('Terrorist financing risk assessment');
      suggestions.push('Risk-based approach to AML compliance');
    }

    if (type === 'entity') {
      suggestions.push('Financial institutions and their obligations');
      suggestions.push('Regulatory bodies and enforcement powers');
      suggestions.push('Compliance program requirements');
    }

    // Add general suggestions
    if (queryLower.includes('bsa') || queryLower.includes('bank secrecy')) {
      suggestions.push('Bank Secrecy Act requirements overview');
      suggestions.push('BSA compliance program elements');
    }

    if (queryLower.includes('aml') || queryLower.includes('anti-money')) {
      suggestions.push('Anti-Money Laundering program requirements');
      suggestions.push('AML risk assessment framework');
    }

    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }

  /**
   * Get detailed information about a specific result
   */
  async getDetails(resultId: string): Promise<any> {
    try {
      // This would retrieve full document/section details
      // For now, return placeholder
      return {
        id: resultId,
        fullContent: 'Full content would be retrieved here',
        relatedDocuments: [],
        applicableRegulations: [],
        implementationGuidance: []
      };
    } catch (error) {
      this.logger?.error('Failed to get details', { resultId, error: error.message });
      return null;
    }
  }

  /**
   * Export results for compliance reporting
   */
  async exportResults(results: QueryResultItem[], format: 'json' | 'csv' | 'pdf' = 'json'): Promise<any> {
    switch (format) {
      case 'json':
        return {
          exportDate: new Date().toISOString(),
          totalResults: results.length,
          results: results.map(r => ({
            title: r.title,
            source: r.source.documentTitle,
            jurisdiction: r.source.jurisdiction,
            relevanceScore: r.relevanceScore,
            excerpt: r.excerpt
          }))
        };

      case 'csv':
        // Return CSV format
        const headers = ['Title', 'Document', 'Jurisdiction', 'Score', 'Excerpt'];
        const rows = results.map(r => [
          r.title,
          r.source.documentTitle,
          r.source.jurisdiction,
          r.relevanceScore.toString(),
          r.excerpt || ''
        ]);
        return { headers, rows };

      default:
        return { error: 'Unsupported export format' };
    }
  }
}
