// Parse SQL: SELECT, INSERT, UPDATE, DELETE, JOIN extraction
export type QueryType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'UNKNOWN';

export interface ParsedQuery {
  type: QueryType;
  tables: string[];
  columns: string[];
  joins: JoinInfo[];
  conditions: string[];
  groupBy: string[];
  orderBy: string[];
  limit?: number;
  offset?: number;
}

export interface JoinInfo {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS';
  table: string;
  on: string;
}

export class SQLParser {
  parse(sql: string): ParsedQuery {
    const cleanSql = sql.trim().toUpperCase();
    const type = this.detectQueryType(cleanSql);

    return {
      type,
      tables: this.extractTables(sql),
      columns: this.extractColumns(sql),
      joins: this.extractJoins(sql),
      conditions: this.extractConditions(sql),
      groupBy: this.extractGroupBy(sql),
      orderBy: this.extractOrderBy(sql),
      limit: this.extractLimit(sql),
      offset: this.extractOffset(sql),
    };
  }

  private detectQueryType(sql: string): QueryType {
    if (sql.startsWith('SELECT')) return 'SELECT';
    if (sql.startsWith('INSERT')) return 'INSERT';
    if (sql.startsWith('UPDATE')) return 'UPDATE';
    if (sql.startsWith('DELETE')) return 'DELETE';
    return 'UNKNOWN';
  }

  private extractTables(sql: string): string[] {
    const tables: string[] = [];
    const fromMatch = sql.match(/FROM\s+([^\s,;]+)/i);
    if (fromMatch) tables.push(fromMatch[1]);

    const tableMatches = sql.match(/(?:INTO|UPDATE)\s+([^\s,;]+)/i);
    if (tableMatches) tables.push(tableMatches[1]);

    return [...new Set(tables)];
  }

  private extractColumns(sql: string): string[] {
    const selectMatch = sql.match(/SELECT\s+(.*?)\s+FROM/is);
    if (!selectMatch) return [];

    const selectPart = selectMatch[1];
    return selectPart
      .split(',')
      .map((col) => col.trim())
      .filter((col) => col.length > 0);
  }

  private extractJoins(sql: string): JoinInfo[] {
    const joins: JoinInfo[] = [];
    const joinPattern = /(INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\s+(\w+)\s+ON\s+([^\s]+\s*=\s*[^\s,;]+)/gi;

    let match;
    const regex = new RegExp(joinPattern.source, joinPattern.flags);
    while ((match = regex.exec(sql)) !== null) {
      joins.push({
        type: (match[1] || 'INNER').toUpperCase() as JoinInfo['type'],
        table: match[2],
        on: match[3],
      });
    }

    return joins;
  }

  private extractConditions(sql: string): string[] {
    const whereMatch = sql.match(/WHERE\s+(.*?)(?:GROUP BY|ORDER BY|LIMIT|$)/is);
    if (!whereMatch) return [];

    return whereMatch[1]
      .split(/AND|OR/i)
      .map((cond) => cond.trim())
      .filter((cond) => cond.length > 0);
  }

  private extractGroupBy(sql: string): string[] {
    const groupMatch = sql.match(/GROUP BY\s+(.*?)(?:ORDER BY|LIMIT|$)/i);
    if (!groupMatch) return [];

    return groupMatch[1]
      .split(',')
      .map((col) => col.trim())
      .filter((col) => col.length > 0);
  }

  private extractOrderBy(sql: string): string[] {
    const orderMatch = sql.match(/ORDER BY\s+(.*?)(?:LIMIT|$)/i);
    if (!orderMatch) return [];

    return orderMatch[1]
      .split(',')
      .map((col) => col.trim())
      .filter((col) => col.length > 0);
  }

  private extractLimit(sql: string): number | undefined {
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    return limitMatch ? parseInt(limitMatch[1], 10) : undefined;
  }

  private extractOffset(sql: string): number | undefined {
    const offsetMatch = sql.match(/OFFSET\s+(\d+)/i);
    return offsetMatch ? parseInt(offsetMatch[1], 10) : undefined;
  }

  getQueryComplexity(parsed: ParsedQuery): number {
    let complexity = 1;

    complexity += parsed.tables.length * 2;
    complexity += parsed.joins.length * 3;
    complexity += parsed.conditions.length * 1.5;
    complexity += parsed.groupBy.length * 2;
    if (parsed.orderBy.length > 0) complexity += 1;

    return Math.round(complexity);
  }
}
