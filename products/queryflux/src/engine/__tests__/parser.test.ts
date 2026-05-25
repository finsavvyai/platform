/**
 * Tests for SQL parser.
 */

import { beforeEach, describe, it, expect } from "vitest";
import { QueryParser } from "../parser";
import type { VisualQuery } from "../types";

describe("QueryParser", () => {
  let parser: QueryParser;

  beforeEach(() => {
    parser = new QueryParser();
  });

  describe("parseToSQL", () => {
    it("should parse simple SELECT query", () => {
      const query: VisualQuery = {
        id: "q1",
        name: "Simple Select",
        blocks: [
          { type: "select", columns: ["id", "name", "email"] },
          { type: "from", table: "users" },
        ],
        connectionId: "conn-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const sql = parser.parseToSQL(query);

      expect(sql).toContain("SELECT id, name, email");
      expect(sql).toContain("FROM users");
    });

    it("should parse query with WHERE clause", () => {
      const query: VisualQuery = {
        id: "q1",
        name: "Query with Filter",
        blocks: [
          { type: "select", columns: ["*"] },
          { type: "from", table: "users" },
          { type: "where", conditions: ["age > 18", "status = 'active'"] },
        ],
        connectionId: "conn-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const sql = parser.parseToSQL(query);

      expect(sql).toContain("SELECT *");
      expect(sql).toContain("FROM users");
      expect(sql).toContain("WHERE age > 18 AND status = 'active'");
    });

    it("should parse query with JOINs", () => {
      const query: VisualQuery = {
        id: "q1",
        name: "Query with JOIN",
        blocks: [
          { type: "select", columns: ["users.id", "users.name", "orders.amount"] },
          { type: "from", table: "users" },
          {
            type: "join",
            joinType: "LEFT",
            table: "orders",
            on: "users.id = orders.user_id",
          },
        ],
        connectionId: "conn-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const sql = parser.parseToSQL(query);

      expect(sql).toContain("SELECT");
      expect(sql).toContain("LEFT JOIN orders");
      expect(sql).toContain("ON users.id = orders.user_id");
    });

    it("should parse query with GROUP BY", () => {
      const query: VisualQuery = {
        id: "q1",
        name: "Query with GROUP BY",
        blocks: [
          { type: "select", columns: ["category", "COUNT(*)"] },
          { type: "from", table: "products" },
          { type: "group_by", columns: ["category"] },
        ],
        connectionId: "conn-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const sql = parser.parseToSQL(query);

      expect(sql).toContain("GROUP BY category");
    });

    it("should parse query with ORDER BY", () => {
      const query: VisualQuery = {
        id: "q1",
        name: "Query with ORDER BY",
        blocks: [
          { type: "select", columns: ["*"] },
          { type: "from", table: "users" },
          {
            type: "order_by",
            columns: [
              { name: "created_at", direction: "DESC" },
              { name: "name", direction: "ASC" },
            ],
          },
        ],
        connectionId: "conn-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const sql = parser.parseToSQL(query);

      expect(sql).toContain("ORDER BY created_at DESC, name ASC");
    });

    it("should parse query with LIMIT", () => {
      const query: VisualQuery = {
        id: "q1",
        name: "Query with LIMIT",
        blocks: [
          { type: "select", columns: ["*"] },
          { type: "from", table: "users" },
          { type: "limit", limit: 10, offset: 5 },
        ],
        connectionId: "conn-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const sql = parser.parseToSQL(query);

      expect(sql).toContain("LIMIT 10");
      expect(sql).toContain("OFFSET 5");
    });

    it("should parse DISTINCT queries", () => {
      const query: VisualQuery = {
        id: "q1",
        name: "DISTINCT Query",
        blocks: [
          { type: "select", columns: ["email"], distinct: true },
          { type: "from", table: "users" },
        ],
        connectionId: "conn-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const sql = parser.parseToSQL(query);

      expect(sql).toContain("SELECT DISTINCT");
    });
  });

  describe("getTables", () => {
    it("should extract table names from query", () => {
      const query: VisualQuery = {
        id: "q1",
        name: "Multi-table Query",
        blocks: [
          { type: "select", columns: ["*"] },
          { type: "from", table: "users" },
          { type: "join", joinType: "INNER", table: "orders", on: "users.id = orders.user_id" },
        ],
        connectionId: "conn-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const tables = parser.getTables(query);

      expect(tables).toContain("users");
      expect(tables).toContain("orders");
      expect(tables.length).toBe(2);
    });
  });

  describe("getColumns", () => {
    it("should extract column names from query", () => {
      const query: VisualQuery = {
        id: "q1",
        name: "Query with Columns",
        blocks: [
          { type: "select", columns: ["id", "name", "email"] },
          { type: "from", table: "users" },
          { type: "order_by", columns: [{ name: "created_at", direction: "DESC" }] },
        ],
        connectionId: "conn-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const columns = parser.getColumns(query);

      expect(columns).toContain("id");
      expect(columns).toContain("name");
      expect(columns).toContain("email");
      expect(columns).toContain("created_at");
    });
  });

  describe("parseSelect", () => {
    it("should handle wildcard in SELECT", () => {
      const query: VisualQuery = {
        id: "q1",
        name: "Wildcard Query",
        blocks: [
          { type: "select", columns: ["*"] },
          { type: "from", table: "users" },
        ],
        connectionId: "conn-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const sql = parser.parseToSQL(query);

      expect(sql).toContain("SELECT *");
    });
  });

  describe("edge cases", () => {
    it("should handle schema-qualified table names", () => {
      const query: VisualQuery = {
        id: "q1",
        name: "Schema Query",
        blocks: [
          { type: "select", columns: ["*"] },
          { type: "from", table: "users", schema: "public" },
        ],
        connectionId: "conn-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const sql = parser.parseToSQL(query);

      expect(sql).toContain("FROM public.users");
    });

    it("should handle table aliases", () => {
      const query: VisualQuery = {
        id: "q1",
        name: "Alias Query",
        blocks: [
          { type: "select", columns: ["u.id", "u.name"] },
          { type: "from", table: "users", alias: "u" },
        ],
        connectionId: "conn-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const sql = parser.parseToSQL(query);

      expect(sql).toContain("FROM users AS u");
    });

    it("should handle HAVING clause in GROUP BY", () => {
      const query: VisualQuery = {
        id: "q1",
        name: "HAVING Query",
        blocks: [
          { type: "select", columns: ["category", "COUNT(*)"] },
          { type: "from", table: "products" },
          { type: "group_by", columns: ["category"], having: ["COUNT(*) > 5"] },
        ],
        connectionId: "conn-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const sql = parser.parseToSQL(query);

      expect(sql).toContain("HAVING COUNT(*) > 5");
    });
  });
});
