/**
 * Tests for query validator.
 */

import { beforeEach, describe, it, expect } from "vitest";
import { QueryValidator } from "../validator";
import type { VisualQuery } from "../types";

describe("QueryValidator", () => {
  let validator: QueryValidator;

  beforeEach(() => {
    validator = new QueryValidator();
  });

  describe("validate", () => {
    it("should accept valid simple query", () => {
      const query: VisualQuery = {
        id: "q1",
        name: "Valid Query",
        blocks: [
          { type: "select", columns: ["id", "name"] },
          { type: "from", table: "users" },
        ],
        connectionId: "conn-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const errors = validator.validate(query);

      expect(errors.length).toBe(0);
    });

    it("should reject empty query", () => {
      const query: VisualQuery = {
        id: "q1",
        name: "Empty Query",
        blocks: [],
        connectionId: "conn-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const errors = validator.validate(query);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].type).toBe("empty_query");
    });

    it("should reject query without SELECT", () => {
      const query: VisualQuery = {
        id: "q1",
        name: "No SELECT",
        blocks: [{ type: "from", table: "users" }],
        connectionId: "conn-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const errors = validator.validate(query);

      expect(errors.some((e) => e.type === "missing_select")).toBe(true);
    });

    it("should reject query without FROM (and no subquery)", () => {
      const query: VisualQuery = {
        id: "q1",
        name: "No FROM",
        blocks: [{ type: "select", columns: ["*"] }],
        connectionId: "conn-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const errors = validator.validate(query);

      expect(errors.some((e) => e.type === "missing_from")).toBe(true);
    });

    it("should reject invalid block order", () => {
      const query: VisualQuery = {
        id: "q1",
        name: "Invalid Order",
        blocks: [
          { type: "from", table: "users" },
          { type: "select", columns: ["*"] },
        ],
        connectionId: "conn-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const errors = validator.validate(query);

      expect(errors.some((e) => e.type === "invalid_block_order")).toBe(true);
    });

    it("should detect SQL injection patterns", () => {
      const query: VisualQuery = {
        id: "q1",
        name: "Injection Test",
        blocks: [
          { type: "select", columns: ["*; DROP TABLE users--"] },
          { type: "from", table: "users" },
        ],
        connectionId: "conn-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const errors = validator.validate(query);

      expect(errors.some((e) => e.type === "sql_injection_risk")).toBe(true);
    });
  });

  describe("validateSQL", () => {
    it("should accept valid SQL", () => {
      const sql = "SELECT * FROM users WHERE id = 1";
      const errors = validator.validateSQL(sql);

      expect(errors.length).toBe(0);
    });

    it("should reject DROP statements", () => {
      const sql = "SELECT * FROM users; DROP TABLE users;";
      const errors = validator.validateSQL(sql);

      expect(errors.some((e) => e.type === "dangerous_keyword")).toBe(true);
    });

    it("should reject DELETE statements", () => {
      const sql = "DELETE FROM users;";
      const errors = validator.validateSQL(sql);

      expect(errors.some((e) => e.type === "dangerous_keyword")).toBe(true);
    });

    it("should reject SQL with comments", () => {
      const sql = "SELECT * FROM users -- this is a comment";
      const errors = validator.validateSQL(sql);

      expect(errors.some((e) => e.type === "comments_detected")).toBe(true);
    });

    it("should reject multiple statements", () => {
      const sql = "SELECT * FROM users; SELECT * FROM orders;";
      const errors = validator.validateSQL(sql);

      expect(errors.some((e) => e.type === "multiple_statements")).toBe(true);
    });

    it("should reject empty SQL", () => {
      const sql = "";
      const errors = validator.validateSQL(sql);

      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("sanitizeIdentifier", () => {
    it("should accept valid identifiers", () => {
      expect(() => {
        validator.sanitizeIdentifier("users.id");
        validator.sanitizeIdentifier("user_name");
        validator.sanitizeIdentifier("table123");
      }).not.toThrow();
    });

    it("should reject invalid identifiers", () => {
      expect(() => {
        validator.sanitizeIdentifier("users; DROP");
      }).toThrow();

      expect(() => {
        validator.sanitizeIdentifier("user's");
      }).toThrow();
    });
  });

  describe("sanitizeTableName", () => {
    it("should accept valid table names", () => {
      expect(() => {
        validator.sanitizeTableName("users");
        validator.sanitizeTableName("user_orders");
        validator.sanitizeTableName("table123");
      }).not.toThrow();
    });

    it("should reject invalid table names", () => {
      expect(() => {
        validator.sanitizeTableName("users; DROP");
      }).toThrow();

      expect(() => {
        validator.sanitizeTableName("user.public");
      }).toThrow();
    });
  });

  describe("complex scenarios", () => {
    it("should validate complex JOIN query", () => {
      const query: VisualQuery = {
        id: "q1",
        name: "Complex JOIN",
        blocks: [
          { type: "select", columns: ["u.id", "u.name", "COUNT(o.id)"] },
          { type: "from", table: "users", alias: "u" },
          {
            type: "join",
            joinType: "LEFT",
            table: "orders",
            alias: "o",
            on: "u.id = o.user_id",
          },
          { type: "where", conditions: ["u.status = 'active'"] },
          { type: "group_by", columns: ["u.id", "u.name"] },
          {
            type: "order_by",
            columns: [{ name: "COUNT(o.id)", direction: "DESC" }],
          },
        ],
        connectionId: "conn-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const errors = validator.validate(query);

      expect(errors.length).toBe(0);
    });

    it("should validate query with multiple conditions", () => {
      const query: VisualQuery = {
        id: "q1",
        name: "Multiple Conditions",
        blocks: [
          { type: "select", columns: ["*"] },
          { type: "from", table: "users" },
          {
            type: "where",
            conditions: [
              "age > 18",
              "status = 'active'",
              "country = 'US'",
            ],
          },
        ],
        connectionId: "conn-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const errors = validator.validate(query);

      expect(errors.length).toBe(0);
    });
  });
});
