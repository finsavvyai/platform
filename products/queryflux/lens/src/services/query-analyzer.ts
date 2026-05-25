// Analyze queries: complexity score, missing indexes, N+1 detection
export interface QueryAnalysis {
  query: string;
  complexityScore: number;
  possibleIndexes: string[];
  nPlusOneDetected: boolean;
  missingIndexes: string[];
  warnings: string[];
  estimatedRows?: number;
}

export class QueryAnalyzer {
  analyzeQuery(sql: string, tables?: Record<string, string[]>): QueryAnalysis {
    const complexity = this.calculateComplexity(sql);
    const possibleIndexes = this.suggestIndexes(sql);
    const nPlusOne = this.detectNPlusOne(sql);
    const missingIndexes = this.identifyMissingIndexes(sql, tables || {});
    const warnings = this.generateWarnings(sql, complexity);

    return {
      query: sql,
      complexityScore: complexity,
      possibleIndexes,
      nPlusOneDetected: nPlusOne,
      missingIndexes,
      warnings,
      estimatedRows: this.estimateRows(sql),
    };
  }

  private calculateComplexity(sql: string): number {
    let score = 0;

    // Joins
    const joinCount = (sql.match(/JOIN/gi) || []).length;
    score += joinCount * 15;

    // Subqueries
    const subqueryCount = (sql.match(/\(/g) || []).length;
    score += subqueryCount * 10;

    // Aggregate functions
    const hasAggregates = /COUNT|SUM|AVG|MIN|MAX/i.test(sql);
    score += hasAggregates ? 5 : 0;

    // GROUP BY
    const hasGroupBy = /GROUP BY/i.test(sql);
    score += hasGroupBy ? 5 : 0;

    // DISTINCT
    const hasDistinct = /DISTINCT/i.test(sql);
    score += hasDistinct ? 3 : 0;

    // UNION
    const hasUnion = /UNION/i.test(sql);
    score += hasUnion ? 20 : 0;

    return Math.min(100, Math.max(1, score));
  }

  private suggestIndexes(sql: string): string[] {
    const indexes: string[] = [];

    // WHERE clause columns
    const whereMatch = sql.match(/WHERE\s+(.*?)(?:GROUP BY|ORDER BY|LIMIT|$)/i);
    if (whereMatch) {
      const conditions = whereMatch[1].split(/AND|OR/i);
      conditions.forEach((cond) => {
        const colMatch = cond.match(/(\w+)\s*=\s*/);
        if (colMatch) indexes.push(`INDEX(${colMatch[1]})`);
      });
    }

    // ORDER BY columns
    const orderMatch = sql.match(/ORDER BY\s+(.*?)(?:LIMIT|$)/i);
    if (orderMatch) {
      const cols = orderMatch[1].split(',');
      cols.forEach((col) => {
        const colName = col.trim().split(/\s/)[0];
        indexes.push(`INDEX(${colName})`);
      });
    }

    // JOIN columns
    const joinMatches = sql.match(/ON\s+(\w+\.\w+)\s*=\s*(\w+\.\w+)/gi);
    if (joinMatches) {
      joinMatches.forEach((join) => {
        const cols = join.match(/(\w+)/g);
        if (cols) {
          cols.forEach((col) => {
            indexes.push(`INDEX(${col})`);
          });
        }
      });
    }

    return [...new Set(indexes)];
  }

  private detectNPlusOne(sql: string): boolean {
    // Simple heuristic: multiple joins + no aggregation typically indicates N+1
    const joinCount = (sql.match(/JOIN/gi) || []).length;
    const hasAggregation = /COUNT|GROUP BY|HAVING/i.test(sql);

    return joinCount >= 2 && !hasAggregation;
  }

  private identifyMissingIndexes(sql: string, tables: Record<string, string[]>): string[] {
    const missing: string[] = [];

    // Simulate analysis based on tables info
    Object.entries(tables).forEach(([table, columns]) => {
      const tableRegex = new RegExp(`\\b${table}\\b`, 'i');
      if (tableRegex.test(sql)) {
        columns.forEach((col) => {
          if (sql.includes(col) && !sql.match(new RegExp(`CREATE INDEX.*${col}`, 'i'))) {
            missing.push(`${table}.${col}`);
          }
        });
      }
    });

    return missing;
  }

  private generateWarnings(sql: string, complexity: number): string[] {
    const warnings: string[] = [];

    if (complexity > 70) {
      warnings.push('Query complexity is high; consider optimization');
    }

    if (/SELECT \*/i.test(sql)) {
      warnings.push('Consider specifying columns instead of SELECT *');
    }

    if (/SELECT .* FROM .* WHERE .* OR /i.test(sql)) {
      warnings.push('OR conditions in WHERE may reduce index effectiveness');
    }

    if (/NOT IN|NOT LIKE/i.test(sql)) {
      warnings.push('NOT IN and NOT LIKE may skip indexes');
    }

    if (/UNION/i.test(sql) && !/UNION ALL/i.test(sql)) {
      warnings.push('Use UNION ALL if duplicates are acceptable for better performance');
    }

    return warnings;
  }

  private estimateRows(sql: string): number {
    // Simple estimation
    if (/LIMIT\s+(\d+)/i.test(sql)) {
      const match = sql.match(/LIMIT\s+(\d+)/i);
      return match ? parseInt(match[1], 10) : 1000;
    }

    if (/COUNT/i.test(sql)) return 1;

    // Default estimate
    return 100;
  }

  compareQueries(sql1: string, sql2: string): { faster: string; improvement: number } {
    const analysis1 = this.analyzeQuery(sql1);
    const analysis2 = this.analyzeQuery(sql2);

    const faster = analysis1.complexityScore < analysis2.complexityScore ? 'first' : 'second';
    const improvement = Math.abs(
      analysis1.complexityScore - analysis2.complexityScore
    );

    return { faster, improvement };
  }
}
