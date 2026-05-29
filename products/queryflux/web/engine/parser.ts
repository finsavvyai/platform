/**
 * Parse visual query blocks into SQL.
 */

import type {
  QueryBlock,
  VisualQuery,
  SelectBlock,
  FromBlock,
  JoinBlock,
  WhereBlock,
  GroupByBlock,
  OrderByBlock,
  LimitBlock,
} from "./types";

export class QueryParser {
  /**
   * Parse visual query blocks into SQL string.
   */
  parseToSQL(query: VisualQuery): string {
    const parts: string[] = [];

    for (const block of query.blocks) {
      const sql = this.parseBlock(block);
      if (sql) {
        parts.push(sql);
      }
    }

    return parts.join(" ");
  }

  /**
   * Parse individual query block to SQL.
   */
  private parseBlock(block: QueryBlock): string {
    switch (block.type) {
      case "select":
        return this.parseSelect(block as SelectBlock);
      case "from":
        return this.parseFrom(block as FromBlock);
      case "join":
        return this.parseJoin(block as JoinBlock);
      case "where":
        return this.parseWhere(block as WhereBlock);
      case "group_by":
        return this.parseGroupBy(block as GroupByBlock);
      case "order_by":
        return this.parseOrderBy(block as OrderByBlock);
      case "limit":
        return this.parseLimit(block as LimitBlock);
      default:
        return "";
    }
  }

  /**
   * Parse SELECT block.
   */
  private parseSelect(block: SelectBlock): string {
    let sql = "SELECT";

    if (block.distinct) {
      sql += " DISTINCT";
    }

    sql += " " + block.columns.join(", ");
    return sql;
  }

  /**
   * Parse FROM block.
   */
  private parseFrom(block: FromBlock): string {
    let sql = `FROM ${block.schema ? `${block.schema}.` : ""}${block.table}`;

    if (block.alias) {
      sql += ` AS ${block.alias}`;
    }

    return sql;
  }

  /**
   * Parse JOIN block.
   */
  private parseJoin(block: JoinBlock): string {
    let sql = `${block.joinType} JOIN ${block.table}`;

    if (block.alias) {
      sql += ` AS ${block.alias}`;
    }

    sql += ` ON ${block.on}`;
    return sql;
  }

  /**
   * Parse WHERE block.
   */
  private parseWhere(block: WhereBlock): string {
    return `WHERE ${block.conditions.join(" AND ")}`;
  }

  /**
   * Parse GROUP BY block.
   */
  private parseGroupBy(block: GroupByBlock): string {
    let sql = `GROUP BY ${block.columns.join(", ")}`;

    if (block.having && block.having.length > 0) {
      sql += ` HAVING ${block.having.join(" AND ")}`;
    }

    return sql;
  }

  /**
   * Parse ORDER BY block.
   */
  private parseOrderBy(block: OrderByBlock): string {
    const items = block.columns.map(
      (col) => `${col.name} ${col.direction}`
    );
    return `ORDER BY ${items.join(", ")}`;
  }

  /**
   * Parse LIMIT block.
   */
  private parseLimit(block: LimitBlock): string {
    let sql = `LIMIT ${block.limit}`;

    if (block.offset) {
      sql += ` OFFSET ${block.offset}`;
    }

    return sql;
  }

  /**
   * Extract all table references from query.
   */
  getTables(query: VisualQuery): string[] {
    const tables = new Set<string>();

    for (const block of query.blocks) {
      if (block.type === "from") {
        const from = block as FromBlock;
        tables.add(from.table);
      } else if (block.type === "join") {
        const join = block as JoinBlock;
        tables.add(join.table);
      }
    }

    return Array.from(tables);
  }

  /**
   * Extract all columns referenced in query.
   */
  getColumns(query: VisualQuery): string[] {
    const columns = new Set<string>();

    for (const block of query.blocks) {
      if (block.type === "select") {
        const select = block as SelectBlock;
        select.columns.forEach((col) => columns.add(col));
      } else if (block.type === "order_by") {
        const order = block as OrderByBlock;
        order.columns.forEach((col) => columns.add(col.name));
      } else if (block.type === "group_by") {
        const group = block as GroupByBlock;
        group.columns.forEach((col) => columns.add(col));
      }
    }

    return Array.from(columns);
  }
}
