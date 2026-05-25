/**
 * Validate SQL and query blocks for safety and correctness.
 */

import type { VisualQuery } from "./types";

export interface ValidationError {
  type: string;
  message: string;
  location?: string;
}

export class QueryValidator {
  private readonly sqlInjectionPatterns = [
    /(\b(DROP|DELETE|TRUNCATE|ALTER|CREATE)\b)/i,
    /(--|;)/,
    /(\*|;)\s*(DELETE|UPDATE|DROP)/i,
    /(UNION|EXEC|EXECUTE|DECLARE)/i,
  ];

  /**
   * Validate visual query for correctness and safety.
   */
  validate(query: VisualQuery): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for minimum requirements
    if (!query.blocks || query.blocks.length === 0) {
      errors.push({
        type: "empty_query",
        message: "Query must contain at least one block",
      });
      return errors;
    }

    // Check for SELECT block
    const hasSelect = query.blocks.some((b) => b.type === "select");
    if (!hasSelect) {
      errors.push({
        type: "missing_select",
        message: "Query must have a SELECT block",
      });
    }

    // Check for FROM block
    const hasFrom = query.blocks.some((b) => b.type === "from");
    if (!hasFrom && !this.hasSubquery(query)) {
      errors.push({
        type: "missing_from",
        message: "Query must have a FROM block",
      });
    }

    // Validate block order
    this.validateBlockOrder(query, errors);

    // Check for SQL injection
    this.checkSQLInjection(query, errors);

    return errors;
  }

  /**
   * Validate block order in query.
   */
  private validateBlockOrder(query: VisualQuery, errors: ValidationError[]): void {
    const blockOrder: Record<string, number> = {
      select: 0,
      from: 1,
      join: 2,
      where: 3,
      group_by: 4,
      order_by: 5,
      limit: 6,
    };

    let lastOrder = -1;

    for (let i = 0; i < query.blocks.length; i++) {
      const block = query.blocks[i];
      const currentOrder = blockOrder[block.type] ?? -1;

      if (currentOrder < lastOrder) {
        errors.push({
          type: "invalid_block_order",
          message: `${block.type} block is in incorrect position`,
          location: `block ${i}`,
        });
      }

      lastOrder = Math.max(lastOrder, currentOrder);
    }
  }

  /**
   * Check for SQL injection patterns.
   */
  private checkSQLInjection(query: VisualQuery, errors: ValidationError[]): void {
    const queryStr = JSON.stringify(query);

    for (const pattern of this.sqlInjectionPatterns) {
      if (pattern.test(queryStr)) {
        errors.push({
          type: "sql_injection_risk",
          message: `Potential SQL injection detected: ${pattern.source}`,
        });
      }
    }

    // Check individual blocks
    for (let i = 0; i < query.blocks.length; i++) {
      const block = query.blocks[i];
      if (block.type === "where") {
        const where = block as any;
        if (where.conditions) {
          for (const condition of where.conditions) {
            if (typeof condition === "string" && this.isSuspicious(condition)) {
              errors.push({
                type: "suspicious_condition",
                message: "WHERE condition contains suspicious patterns",
                location: `block ${i}`,
              });
            }
          }
        }
      }
    }
  }

  /**
   * Check if string is suspicious.
   */
  private isSuspicious(str: string): boolean {
    const suspiciousPatterns = [
      /^['"].*['"]$/,
      /--/,
      /\/\*/,
      /\*\//,
    ];

    return suspiciousPatterns.some((p) => p.test(str));
  }

  /**
   * Check if query has subquery.
   */
  private hasSubquery(query: VisualQuery): boolean {
    return JSON.stringify(query).includes("subquery");
  }

  /**
   * Validate specific SQL string.
   */
  validateSQL(sql: string): ValidationError[] {
    const errors: ValidationError[] = [];

    if (sql.trim().length === 0) {
      errors.push({
        type: "empty_sql",
        message: "SQL must not be empty",
      });
      return errors;
    }

    // Check for dangerous keywords
    const dangerousKeywords = ["DROP", "DELETE", "TRUNCATE", "ALTER", "EXEC"];
    const upperSql = sql.toUpperCase();

    for (const keyword of dangerousKeywords) {
      if (upperSql.includes(keyword)) {
        errors.push({
          type: "dangerous_keyword",
          message: `SQL contains dangerous keyword: ${keyword}`,
        });
      }
    }

    // Check for comment syntax
    if (sql.includes("--") || sql.includes("/*")) {
      errors.push({
        type: "comments_detected",
        message: "SQL contains comments which are not allowed",
      });
    }

    // Check for multiple statements
    if (sql.split(";").length > 2) {
      errors.push({
        type: "multiple_statements",
        message: "SQL contains multiple statements",
      });
    }

    return errors;
  }

  /**
   * Sanitize column name.
   */
  sanitizeIdentifier(identifier: string): string {
    // Allow alphanumeric, underscore, and dot for table.column
    if (!/^[a-zA-Z0-9_.*]+$/.test(identifier)) {
      throw new Error(`Invalid identifier: ${identifier}`);
    }
    return identifier;
  }

  /**
   * Sanitize table name.
   */
  sanitizeTableName(tableName: string): string {
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`);
    }
    return tableName;
  }
}
