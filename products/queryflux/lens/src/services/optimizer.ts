// Suggest optimizations: rewrite queries, add indexes
export interface OptimizationSuggestion {
  id: string;
  type: 'rewrite' | 'index' | 'restructure' | 'cache';
  title: string;
  description: string;
  suggestedQuery?: string;
  sqlStatement?: string;
  estimatedImprovement: number; // percentage
}

export class QueryOptimizer {
  private suggestions: Map<string, OptimizationSuggestion> = new Map();

  optimizeQuery(sql: string): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Check for SELECT *
    if (/SELECT \*/i.test(sql)) {
      suggestions.push(this.createSelectAllOptimization(sql));
    }

    // Check for UNION
    if (/UNION(?!\s+ALL)/i.test(sql)) {
      suggestions.push(this.createUnionOptimization(sql));
    }

    // Check for NOT IN with subquery
    if (/NOT IN\s*\(/i.test(sql)) {
      suggestions.push(this.createNotInOptimization(sql));
    }

    // Check for DISTINCT with aggregates
    if (/SELECT DISTINCT/i.test(sql) && /COUNT|SUM|AVG/i.test(sql)) {
      suggestions.push(this.createDistinctOptimization(sql));
    }

    // Check for missing LIMIT
    if (!/LIMIT/i.test(sql) && /SELECT/i.test(sql)) {
      suggestions.push(this.createLimitOptimization());
    }

    // Index suggestions
    suggestions.push(...this.suggestIndexes(sql));

    return suggestions;
  }

  private createSelectAllOptimization(sql: string): OptimizationSuggestion {
    return {
      id: `opt_select_all_${Date.now()}`,
      type: 'rewrite',
      title: 'Replace SELECT * with specific columns',
      description: 'Specify columns to reduce data transfer and improve cache efficiency',
      suggestedQuery: 'SELECT col1, col2, col3 FROM table WHERE ...',
      estimatedImprovement: 20,
    };
  }

  private createUnionOptimization(sql: string): OptimizationSuggestion {
    return {
      id: `opt_union_${Date.now()}`,
      type: 'rewrite',
      title: 'Use UNION ALL instead of UNION',
      description: 'UNION ALL is faster than UNION when duplicates are acceptable',
      suggestedQuery: sql.replace(/UNION(?!\s+ALL)/gi, 'UNION ALL'),
      estimatedImprovement: 30,
    };
  }

  private createNotInOptimization(sql: string): OptimizationSuggestion {
    return {
      id: `opt_not_in_${Date.now()}`,
      type: 'rewrite',
      title: 'Replace NOT IN with NOT EXISTS',
      description: 'NOT EXISTS is more efficient with subqueries and handles NULLs correctly',
      estimatedImprovement: 25,
    };
  }

  private createDistinctOptimization(sql: string): OptimizationSuggestion {
    return {
      id: `opt_distinct_${Date.now()}`,
      type: 'restructure',
      title: 'Remove DISTINCT with aggregates',
      description: 'DISTINCT is unnecessary when using GROUP BY with aggregates',
      estimatedImprovement: 15,
    };
  }

  private createLimitOptimization(): OptimizationSuggestion {
    return {
      id: `opt_limit_${Date.now()}`,
      type: 'rewrite',
      title: 'Add LIMIT clause',
      description: 'Limit results to necessary rows to reduce data transfer',
      sqlStatement: 'ADD LIMIT 100',
      estimatedImprovement: 10,
    };
  }

  private suggestIndexes(sql: string): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // WHERE clause index
    const whereMatch = sql.match(/WHERE\s+(\w+)\s*=/i);
    if (whereMatch) {
      suggestions.push({
        id: `opt_idx_where_${Date.now()}`,
        type: 'index',
        title: `Create index on ${whereMatch[1]}`,
        description: `Index on ${whereMatch[1]} will speed up WHERE clause filtering`,
        sqlStatement: `CREATE INDEX idx_${whereMatch[1]} ON table(${whereMatch[1]})`,
        estimatedImprovement: 40,
      });
    }

    // ORDER BY index
    const orderMatch = sql.match(/ORDER BY\s+(\w+)/i);
    if (orderMatch) {
      suggestions.push({
        id: `opt_idx_order_${Date.now()}`,
        type: 'index',
        title: `Create index on ${orderMatch[1]}`,
        description: `Index on ${orderMatch[1]} will speed up sorting`,
        sqlStatement: `CREATE INDEX idx_${orderMatch[1]} ON table(${orderMatch[1]})`,
        estimatedImprovement: 35,
      });
    }

    return suggestions;
  }

  rewriteForPerformance(sql: string): string {
    let optimized = sql;

    // Rewrite UNION to UNION ALL
    optimized = optimized.replace(/UNION(?!\s+ALL)/gi, 'UNION ALL');

    // Replace NOT IN with NOT EXISTS (simple case)
    if (/NOT IN\s*\(/i.test(optimized)) {
      optimized = optimized.replace(
        /(\w+)\s+NOT IN\s*\(SELECT\s+(\w+)\s+FROM\s+(\w+)\s*\)/gi,
        'NOT EXISTS (SELECT 1 FROM $3 WHERE $3.$2 = $1)'
      );
    }

    // Add LIMIT if missing
    if (!/LIMIT/i.test(optimized)) {
      optimized += ' LIMIT 1000';
    }

    return optimized;
  }

  getSuggestion(id: string): OptimizationSuggestion | undefined {
    return this.suggestions.get(id);
  }

  listSuggestions(): OptimizationSuggestion[] {
    return Array.from(this.suggestions.values());
  }
}
