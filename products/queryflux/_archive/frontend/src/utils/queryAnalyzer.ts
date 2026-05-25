export interface QueryAnalysis {
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'DROP' | 'ALTER' | 'UNKNOWN';
  complexity: 'low' | 'medium' | 'high';
  risks: string[];
  suggestions: string[];
  tables: string[];
  estimatedRows?: number;
  hasJoins: boolean;
  hasSubqueries: boolean;
  hasWildcard: boolean;
  score: number;
}

export class QueryAnalyzer {
  private readonly dangerousKeywords = ['DROP', 'TRUNCATE', 'DELETE', 'ALTER', 'GRANT', 'REVOKE'];
  private readonly performanceKeywords = ['SELECT *', 'NOT IN', 'OR', 'LIKE'];

  analyze(query: string): QueryAnalysis {
    const normalizedQuery = query.trim().toUpperCase();
    const type = this.detectQueryType(normalizedQuery);
    const tables = this.extractTables(query);
    const hasJoins = this.hasJoins(normalizedQuery);
    const hasSubqueries = this.hasSubqueries(normalizedQuery);
    const hasWildcard = normalizedQuery.includes('SELECT *');
    const risks = this.detectRisks(normalizedQuery);
    const suggestions = this.generateSuggestions(normalizedQuery, type, hasWildcard, hasJoins);
    const complexity = this.calculateComplexity(hasJoins, hasSubqueries, normalizedQuery);
    const score = this.calculateScore(risks, complexity, hasWildcard);

    return {
      type,
      complexity,
      risks,
      suggestions,
      tables,
      hasJoins,
      hasSubqueries,
      hasWildcard,
      score,
    };
  }

  private detectQueryType(query: string): QueryAnalysis['type'] {
    if (query.startsWith('SELECT')) return 'SELECT';
    if (query.startsWith('INSERT')) return 'INSERT';
    if (query.startsWith('UPDATE')) return 'UPDATE';
    if (query.startsWith('DELETE')) return 'DELETE';
    if (query.startsWith('CREATE')) return 'CREATE';
    if (query.startsWith('DROP')) return 'DROP';
    if (query.startsWith('ALTER')) return 'ALTER';
    return 'UNKNOWN';
  }

  private extractTables(query: string): string[] {
    const tables: string[] = [];
    const fromMatch = query.match(/FROM\s+([a-zA-Z0-9_]+)/gi);
    const joinMatch = query.match(/JOIN\s+([a-zA-Z0-9_]+)/gi);
    const intoMatch = query.match(/INTO\s+([a-zA-Z0-9_]+)/gi);
    const updateMatch = query.match(/UPDATE\s+([a-zA-Z0-9_]+)/gi);

    [fromMatch, joinMatch, intoMatch, updateMatch].forEach(matches => {
      if (matches) {
        matches.forEach(match => {
          const table = match.split(/\s+/)[1];
          if (table && !tables.includes(table)) {
            tables.push(table);
          }
        });
      }
    });

    return tables;
  }

  private hasJoins(query: string): boolean {
    return /\b(INNER|LEFT|RIGHT|FULL|CROSS)\s+JOIN\b/i.test(query);
  }

  private hasSubqueries(query: string): boolean {
    const selectCount = (query.match(/SELECT/g) || []).length;
    return selectCount > 1;
  }

  private detectRisks(query: string): string[] {
    const risks: string[] = [];

    if (this.dangerousKeywords.some(keyword => query.includes(keyword))) {
      risks.push('⚠️ Potentially destructive operation detected');
    }

    if (query.includes('DELETE') && !query.includes('WHERE')) {
      risks.push('🚨 DELETE without WHERE clause - will delete all rows');
    }

    if (query.includes('UPDATE') && !query.includes('WHERE')) {
      risks.push('🚨 UPDATE without WHERE clause - will update all rows');
    }

    if (query.match(/['"]\s*\+\s*|CONCAT\s*\(/i)) {
      risks.push('⚠️ Possible SQL injection vulnerability - use parameterized queries');
    }

    if (query.includes('SELECT *')) {
      risks.push('📊 SELECT * may impact performance and expose unnecessary data');
    }

    if (query.match(/OR\s+1\s*=\s*1/i)) {
      risks.push('🚨 SQL injection pattern detected');
    }

    return risks;
  }

  private generateSuggestions(
    query: string,
    type: QueryAnalysis['type'],
    hasWildcard: boolean,
    hasJoins: boolean
  ): string[] {
    const suggestions: string[] = [];

    if (hasWildcard && type === 'SELECT') {
      suggestions.push('💡 Replace SELECT * with specific column names for better performance');
    }

    if (!query.includes('LIMIT') && type === 'SELECT') {
      suggestions.push('💡 Consider adding LIMIT clause to control result set size');
    }

    if (hasJoins && !query.includes('INDEX')) {
      suggestions.push('💡 Ensure proper indexes exist on JOIN columns');
    }

    if (query.includes('NOT IN')) {
      suggestions.push('💡 Consider using NOT EXISTS or LEFT JOIN instead of NOT IN');
    }

    if (query.includes('LIKE') && query.match(/LIKE\s+['"]%/i)) {
      suggestions.push('💡 Leading wildcard in LIKE prevents index usage');
    }

    if (type === 'SELECT' && query.split('JOIN').length > 4) {
      suggestions.push('💡 Consider breaking complex query into smaller queries or using views');
    }

    if (query.includes('DISTINCT')) {
      suggestions.push('💡 DISTINCT can be expensive - verify if it\'s necessary');
    }

    return suggestions;
  }

  private calculateComplexity(hasJoins: boolean, hasSubqueries: boolean, query: string): 'low' | 'medium' | 'high' {
    let score = 0;

    if (hasJoins) score += 2;
    if (hasSubqueries) score += 3;
    if (query.includes('DISTINCT')) score += 1;
    if (query.includes('GROUP BY')) score += 1;
    if (query.includes('HAVING')) score += 1;
    if (query.split('JOIN').length > 3) score += 2;

    if (score >= 5) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }

  private calculateScore(risks: string[], complexity: string, hasWildcard: boolean): number {
    let score = 100;

    score -= risks.length * 15;

    if (complexity === 'high') score -= 20;
    else if (complexity === 'medium') score -= 10;

    if (hasWildcard) score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  estimatePerformance(analysis: QueryAnalysis): {
    rating: 'excellent' | 'good' | 'fair' | 'poor';
    message: string;
  } {
    if (analysis.score >= 85) {
      return { rating: 'excellent', message: 'Query is well-optimized' };
    } else if (analysis.score >= 70) {
      return { rating: 'good', message: 'Query is reasonably optimized' };
    } else if (analysis.score >= 50) {
      return { rating: 'fair', message: 'Query could be improved' };
    } else {
      return { rating: 'poor', message: 'Query needs significant optimization' };
    }
  }
}

export const queryAnalyzer = new QueryAnalyzer();
