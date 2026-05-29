/**
 * AI query suggestion engine.
 */

import type {
  QuerySuggestion,
  NLQueryIntent,
} from "./types";
import type { VisualQuery } from "../engine/types";

export class QuerySuggester {
  /**
   * Suggest queries from natural language.
   */
  async suggestFromNaturalLanguage(
    text: string,
    _tables?: string[]
  ): Promise<QuerySuggestion[]> {
    const intent = this.parseIntent(text);

    if (intent.confidence < 0.3) {
      return [];
    }

    const suggestions: QuerySuggestion[] = [];

    // Generate suggestions based on intent
    if (intent.type === "select") {
      suggestions.push(this.createSelectSuggestion(intent));
    }

    if (intent.type === "aggregate") {
      suggestions.push(this.createAggregateSuggestion(intent));
    }

    if (intent.type === "join") {
      suggestions.push(this.createJoinSuggestion(intent));
    }

    return suggestions;
  }

  /**
   * Parse natural language to query intent.
   */
  private parseIntent(text: string): NLQueryIntent {
    const lowerText = text.toLowerCase();

    // Detect query type
    let type: NLQueryIntent["type"] = "unknown";
    if (lowerText.includes("select") || lowerText.includes("show") || lowerText.startsWith("all ")) {
      type = "select";
    } else if (lowerText.includes("count") || lowerText.includes("sum")) {
      type = "aggregate";
    } else if (lowerText.includes("join")) {
      type = "join";
    } else if (lowerText.includes("where") || lowerText.includes("filter")) {
      type = "filter";
    } else if (lowerText.includes("order") || lowerText.includes("sort")) {
      type = "order";
    }

    // Extract tables and columns using simple heuristics
    const tables = this.extractTables(text);
    const columns = this.extractColumns(text);
    const conditions = this.extractConditions(text);

    return {
      type,
      tables,
      columns,
      conditions,
      confidence: this.calculateConfidence(type),
    };
  }

  /**
   * Extract table names from text.
   */
  private extractTables(text: string): string[] {
    const tables: string[] = [];
    const commonTables = ["users", "orders", "products", "customers", "transactions"];

    for (const table of commonTables) {
      if (text.toLowerCase().includes(table)) {
        tables.push(table);
      }
    }

    return tables;
  }

  /**
   * Extract column names from text.
   */
  private extractColumns(text: string): string[] {
    const columns: string[] = [];
    const commonColumns = ["id", "name", "email", "date", "amount", "status"];

    for (const col of commonColumns) {
      if (text.toLowerCase().includes(col)) {
        columns.push(col);
      }
    }

    return columns;
  }

  /**
   * Extract filter conditions.
   */
  private extractConditions(text: string): string[] {
    const conditions: string[] = [];
    // Simple extraction of conditions
    const whereMatch = text.match(/where (.+?)(?:and|or|$)/i);
    if (whereMatch) {
      conditions.push(whereMatch[1].trim());
    }
    return conditions;
  }

  /**
   * Calculate confidence score.
   */
  private calculateConfidence(type: NLQueryIntent["type"]): number {
    // Confidence varies by type clarity
    if (type === "unknown") return 0.2;
    if (type === "select") return 0.8;
    return 0.5;
  }

  /**
   * Create SELECT suggestion.
   */
  private createSelectSuggestion(intent: NLQueryIntent): QuerySuggestion {
    const table = intent.tables[0] || "table";
    const columns = intent.columns.length > 0
      ? intent.columns.join(", ")
      : "*";

    return {
      id: `select-${Date.now()}`,
      query: `SELECT ${columns} FROM ${table}`,
      description: `Select ${columns} from ${table}`,
      confidence: intent.confidence,
      tags: ["select", table],
    };
  }

  /**
   * Create aggregate suggestion.
   */
  private createAggregateSuggestion(intent: NLQueryIntent): QuerySuggestion {
    const table = intent.tables[0] || "table";
    const column = intent.columns[0] || "id";

    return {
      id: `aggregate-${Date.now()}`,
      query: `SELECT COUNT(${column}) FROM ${table}`,
      description: `Count ${column} in ${table}`,
      confidence: intent.confidence,
      tags: ["aggregate", "count", table],
    };
  }

  /**
   * Create JOIN suggestion.
   */
  private createJoinSuggestion(intent: NLQueryIntent): QuerySuggestion {
    const [table1, table2] = intent.tables;

    if (!table1 || !table2) {
      return {
        id: "invalid",
        query: "",
        description: "Unable to generate JOIN suggestion",
        confidence: 0,
        tags: [],
      };
    }

    return {
      id: `join-${Date.now()}`,
      query: `SELECT * FROM ${table1} JOIN ${table2} ON ${table1}.id = ${table2}.${table1}_id`,
      description: `Join ${table1} and ${table2}`,
      confidence: intent.confidence,
      tags: ["join", table1, table2],
    };
  }

  /**
   * Suggest optimizations for query.
   */
  async suggestOptimizations(query: VisualQuery): Promise<string[]> {
    const suggestions: string[] = [];

    // Check for missing indexes
    suggestions.push("Consider adding indexes on frequently filtered columns");

    // Check for missing LIMIT
    const hasLimit = query.blocks.some((b) => b.type === "limit");
    if (!hasLimit) {
      suggestions.push("Consider adding a LIMIT clause to improve performance");
    }

    // Check for SELECT *
    const selectBlock = query.blocks.find((b) => b.type === "select");
    if (selectBlock && (selectBlock as any).columns.includes("*")) {
      suggestions.push("Consider selecting specific columns instead of *");
    }

    return suggestions;
  }

  /**
   * Similar query search.
   */
  async findSimilarQueries(
    query: string,
    queryHistory: string[]
  ): Promise<QuerySuggestion[]> {
    const suggestions: QuerySuggestion[] = [];

    for (const historic of queryHistory) {
      const similarity = this.calculateSimilarity(query, historic);
      if (similarity > 0.6) {
        suggestions.push({
          id: `similar-${Date.now()}`,
          query: historic,
          description: "Similar query from history",
          confidence: similarity,
          tags: ["history"],
        });
      }
    }

    return suggestions.slice(0, 5); // Return top 5
  }

  /**
   * Calculate string similarity (simple Levenshtein).
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance algorithm.
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const costs: number[] = [];

    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }

    return costs[s2.length];
  }
}
