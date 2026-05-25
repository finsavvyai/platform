/**
 * Query engine type definitions.
 */

export interface Connection {
  id: string;
  name: string;
  type: "postgres" | "mysql" | "sqlite" | "snowflake" | "bigquery";
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
}

export interface Table {
  name: string;
  schema?: string;
  columns: Column[];
}

export interface SelectBlock {
  type: "select";
  columns: string[]; // ["*"] or specific columns
  distinct?: boolean;
}

export interface FromBlock {
  type: "from";
  table: string;
  alias?: string;
  schema?: string;
}

export interface JoinBlock {
  type: "join";
  joinType: "INNER" | "LEFT" | "RIGHT" | "FULL";
  table: string;
  alias?: string;
  on: string; // condition like "users.id = orders.user_id"
}

export interface WhereBlock {
  type: "where";
  conditions: string[]; // array of conditions joined with AND
}

export interface GroupByBlock {
  type: "group_by";
  columns: string[];
  having?: string[];
}

export interface OrderByBlock {
  type: "order_by";
  columns: Array<{
    name: string;
    direction: "ASC" | "DESC";
  }>;
}

export interface LimitBlock {
  type: "limit";
  limit: number;
  offset?: number;
}

export type QueryBlock =
  | SelectBlock
  | FromBlock
  | JoinBlock
  | WhereBlock
  | GroupByBlock
  | OrderByBlock
  | LimitBlock;

export interface VisualQuery {
  id: string;
  name: string;
  description?: string;
  blocks: QueryBlock[];
  connectionId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  executionTime: number; // in milliseconds
  rowCount: number;
  success: boolean;
  error?: string;
}

export interface AggregateFunction {
  name: string;
  column: string;
  alias?: string;
}

export interface Subquery {
  alias: string;
  query: VisualQuery;
}
