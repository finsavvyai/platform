/**
 * SQL query explanation engine.
 */

import type { QueryExplanation } from "./types";
import type { VisualQuery, QueryBlock } from "../engine/types";
import { QueryParser } from "../engine/parser";

export class QueryExplainer {
  private parser = new QueryParser();

  /**
   * Explain a visual query in plain English.
   */
  explain(query: VisualQuery): QueryExplanation {
    const selectBlock = query.blocks.find((b) => b.type === "select");
    const joinBlocks = query.blocks.filter((b) => b.type === "join");
    const whereBlock = query.blocks.find((b) => b.type === "where");
    const groupBlock = query.blocks.find((b) => b.type === "group_by");
    const orderBlock = query.blocks.find((b) => b.type === "order_by");

    return {
      summary: this.generateSummary(query),
      purpose: this.generatePurpose(query),
      tables: this.parser.getTables(query),
      joins: this.extractJoins(joinBlocks),
      filters: this.extractFilters(whereBlock),
      aggregations: this.extractAggregations(selectBlock, groupBlock),
      sorting: this.extractSorting(orderBlock),
      complexity: this.calculateComplexity(query),
    };
  }

  /**
   * Generate natural language summary.
   */
  private generateSummary(query: VisualQuery): string {
    const tables = this.parser.getTables(query);
    const columns = this.parser.getColumns(query);

    if (tables.length === 0) {
      return "Invalid query: no tables specified";
    }

    let summary = `This query retrieves ${columns.join(", ")}`;
    summary += ` from ${this.formatTableList(tables)}`;

    const whereBlock = query.blocks.find((b) => b.type === "where");
    if (whereBlock) {
      summary += " with filtering conditions";
    }

    const joinBlocks = query.blocks.filter((b) => b.type === "join");
    if (joinBlocks.length > 0) {
      summary += ` joined with ${joinBlocks.length} other table${joinBlocks.length > 1 ? "s" : ""}`;
    }

    const orderBlock = query.blocks.find((b) => b.type === "order_by");
    if (orderBlock) {
      summary += " and sorts results";
    }

    return summary + ".";
  }

  /**
   * Generate query purpose.
   */
  private generatePurpose(query: VisualQuery): string {
    const selectBlock = query.blocks.find((b) => b.type === "select") as any;
    const groupBlock = query.blocks.find((b) => b.type === "group_by");

    if (groupBlock) {
      return "This is an aggregation query that groups data";
    }

    if (selectBlock?.columns.includes("COUNT")) {
      return "This query counts records";
    }

    if (selectBlock?.columns.some((c: string) => c.toUpperCase().includes("SUM"))) {
      return "This query sums values";
    }

    return "This is a data retrieval query";
  }

  /**
   * Extract join information.
   */
  private extractJoins(joinBlocks: QueryBlock[]): QueryExplanation["joins"] {
    return joinBlocks.map((b: any) => ({
      type: b.joinType || "INNER",
      leftTable: "current",
      rightTable: b.table,
      condition: b.on,
    }));
  }

  /**
   * Extract filter conditions.
   */
  private extractFilters(whereBlock?: QueryBlock): string[] {
    if (!whereBlock || whereBlock.type !== "where") {
      return [];
    }

    const where = whereBlock as any;
    return where.conditions || [];
  }

  /**
   * Extract aggregations.
   */
  private extractAggregations(
    selectBlock?: QueryBlock,
    groupBlock?: QueryBlock
  ): string[] {
    const aggregations: string[] = [];

    if (selectBlock) {
      const select = selectBlock as any;
      const aggs = select.columns.filter((c: string) =>
        /^(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(c)
      );
      aggregations.push(...aggs);
    }

    if (groupBlock) {
      const group = groupBlock as any;
      aggregations.push(`GROUP BY: ${group.columns.join(", ")}`);
    }

    return aggregations;
  }

  /**
   * Extract sorting.
   */
  private extractSorting(orderBlock?: QueryBlock): string[] {
    if (!orderBlock || orderBlock.type !== "order_by") {
      return [];
    }

    const order = orderBlock as any;
    return order.columns.map((c: any) => `${c.name} ${c.direction}`);
  }

  /**
   * Calculate query complexity.
   */
  private calculateComplexity(query: VisualQuery): "simple" | "moderate" | "complex" {
    let score = 0;

    // Count different block types
    const uniqueTypes = new Set(query.blocks.map((b) => b.type)).size;
    score += uniqueTypes;

    // Count joins
    const joinCount = query.blocks.filter((b) => b.type === "join").length;
    score += joinCount * 2;

    // Check for subqueries
    if (JSON.stringify(query).includes("subquery")) {
      score += 3;
    }

    if (score <= 2) return "simple";
    if (score <= 5) return "moderate";
    return "complex";
  }

  /**
   * Explain SQL string.
   */
  explainSQL(sql: string): string {
    // Simple SQL explanation
    const upperSql = sql.toUpperCase();

    let explanation = "";

    if (upperSql.includes("SELECT")) {
      const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM/i);
      if (selectMatch) {
        explanation += `Selecting: ${selectMatch[1]}. `;
      }
    }

    if (upperSql.includes("FROM")) {
      const fromMatch = sql.match(/FROM\s+([^\s,;]+)/i);
      if (fromMatch) {
        explanation += `From table: ${fromMatch[1]}. `;
      }
    }

    if (upperSql.includes("WHERE")) {
      explanation += "With filtering conditions. ";
    }

    if (upperSql.includes("JOIN")) {
      const joinCount = (sql.match(/JOIN/gi) || []).length;
      explanation += `Includes ${joinCount} join${joinCount > 1 ? "s" : ""}. `;
    }

    if (upperSql.includes("GROUP BY")) {
      explanation += "Grouped by specified columns. ";
    }

    if (upperSql.includes("ORDER BY")) {
      explanation += "Sorted by specified columns. ";
    }

    return explanation || "SQL query for data retrieval.";
  }

  /**
   * Format table list for display.
   */
  private formatTableList(tables: string[]): string {
    if (tables.length === 1) {
      return tables[0];
    }
    return tables.slice(0, -1).join(", ") + " and " + tables[tables.length - 1];
  }
}
