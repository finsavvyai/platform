/**
 * Tests for query suggestion engine.
 */

import { beforeEach, describe, it, expect } from "vitest";
import { QuerySuggester } from "../query-suggest";
import type { VisualQuery } from "../../engine/types";

describe("QuerySuggester", () => {
  let suggester: QuerySuggester;

  beforeEach(() => {
    suggester = new QuerySuggester();
  });

  describe("suggestFromNaturalLanguage", () => {
    it("should suggest SELECT query from natural language", async () => {
      const suggestions = await suggester.suggestFromNaturalLanguage(
        "show me all users"
      );

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].query).toContain("SELECT");
      expect(suggestions[0].tags).toContain("select");
    });

    it("should suggest COUNT query for aggregation", async () => {
      const suggestions = await suggester.suggestFromNaturalLanguage(
        "count all users"
      );

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].query).toContain("COUNT");
    });

    it("should suggest JOIN query from natural language", async () => {
      const suggestions = await suggester.suggestFromNaturalLanguage(
        "join users and orders"
      );

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].query).toContain("JOIN");
    });

    it("should have confidence scores", async () => {
      const suggestions = await suggester.suggestFromNaturalLanguage(
        "select from users"
      );

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].confidence).toBeGreaterThan(0);
      expect(suggestions[0].confidence).toBeLessThanOrEqual(1);
    });

    it("should return empty for unclear intent", async () => {
      const suggestions = await suggester.suggestFromNaturalLanguage(
        "xyz abc def"
      );

      expect(suggestions.length).toBe(0);
    });

    it("should extract tables from natural language", async () => {
      const suggestions = await suggester.suggestFromNaturalLanguage(
        "all users from the database"
      );

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].query).toContain("users");
    });

    it("should extract columns from natural language", async () => {
      const suggestions = await suggester.suggestFromNaturalLanguage(
        "show id and name"
      );

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].query).toContain("name");
    });
  });

  describe("suggestOptimizations", () => {
    it("should suggest adding LIMIT", async () => {
      const query: VisualQuery = {
        id: "q1",
        name: "Test",
        blocks: [
          { type: "select", columns: ["*"] },
          { type: "from", table: "users" },
        ],
        connectionId: "conn-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const suggestions = await suggester.suggestOptimizations(query);

      expect(suggestions.some((s) => s.includes("LIMIT"))).toBe(true);
    });

    it("should suggest specific columns instead of *", async () => {
      const query: VisualQuery = {
        id: "q1",
        name: "Test",
        blocks: [
          { type: "select", columns: ["*"] },
          { type: "from", table: "users" },
        ],
        connectionId: "conn-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const suggestions = await suggester.suggestOptimizations(query);

      expect(suggestions.some((s) => s.includes("specific columns"))).toBe(true);
    });

    it("should suggest indexes", async () => {
      const query: VisualQuery = {
        id: "q1",
        name: "Test",
        blocks: [
          { type: "select", columns: ["*"] },
          { type: "from", table: "users" },
          { type: "where", conditions: ["id = 1"] },
        ],
        connectionId: "conn-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const suggestions = await suggester.suggestOptimizations(query);

      expect(suggestions.some((s) => s.includes("indexes"))).toBe(true);
    });
  });

  describe("findSimilarQueries", () => {
    it("should find similar queries from history", async () => {
      const history = [
        "SELECT * FROM users WHERE id = 1",
        "SELECT name FROM users WHERE status = 'active'",
        "SELECT COUNT(*) FROM products",
      ];

      const similar = await suggester.findSimilarQueries(
        "SELECT * FROM users WHERE id = 2",
        history
      );

      expect(similar.length).toBeGreaterThan(0);
      expect(similar[0].query).toContain("users");
    });

    it("should return top 5 results", async () => {
      const history = Array(10)
        .fill(null)
        .map((_, i) => `SELECT * FROM users WHERE id = ${i}`);

      const similar = await suggester.findSimilarQueries(
        "SELECT * FROM users WHERE id = 100",
        history
      );

      expect(similar.length).toBeLessThanOrEqual(5);
    });

    it("should have similarity scores", async () => {
      const history = ["SELECT * FROM users"];

      const similar = await suggester.findSimilarQueries(
        "SELECT * FROM users",
        history
      );

      expect(similar.length).toBeGreaterThan(0);
      expect(similar[0].confidence).toBeGreaterThan(0.5);
    });
  });

  describe("intent parsing", () => {
    it("should parse SELECT intent", async () => {
      const suggestions = await suggester.suggestFromNaturalLanguage(
        "select all records from users"
      );

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].tags).toContain("select");
    });

    it("should parse aggregate intent", async () => {
      const suggestions = await suggester.suggestFromNaturalLanguage(
        "count the number of users"
      );

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].query).toContain("COUNT");
    });

    it("should parse JOIN intent", async () => {
      const suggestions = await suggester.suggestFromNaturalLanguage(
        "join tables users and orders"
      );

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].tags).toContain("join");
    });
  });

  describe("edge cases", () => {
    it("should handle empty input", async () => {
      const suggestions = await suggester.suggestFromNaturalLanguage("");

      expect(Array.isArray(suggestions)).toBe(true);
    });

    it("should handle special characters", async () => {
      const suggestions = await suggester.suggestFromNaturalLanguage(
        "show users & orders"
      );

      expect(Array.isArray(suggestions)).toBe(true);
    });

    it("should handle case insensitivity", async () => {
      const lower = await suggester.suggestFromNaturalLanguage("select users");
      const upper = await suggester.suggestFromNaturalLanguage("SELECT USERS");

      expect(lower.length).toBeGreaterThan(0);
      expect(upper.length).toBeGreaterThan(0);
    });
  });
});
