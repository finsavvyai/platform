/**
 * Tests for query API.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { QueryService } from "../queries";
import type { VisualQuery } from "../../engine/types";

describe("QueryService", () => {
  let service: QueryService;
  let testQuery: VisualQuery;

  beforeEach(() => {
    service = new QueryService();
    testQuery = {
      id: "q1",
      name: "Test Query",
      description: "A test query",
      blocks: [
        { type: "select", columns: ["*"] },
        { type: "from", table: "users" },
      ],
      connectionId: "conn-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  describe("CRUD operations", () => {
    it("should create query", async () => {
      const created = await service.create(testQuery);

      expect(created.id).toBeDefined();
      expect(created.name).toBe("Test Query");
      expect(created.createdAt).toBeDefined();
    });

    it("should get query by ID", async () => {
      const created = await service.create(testQuery);
      const retrieved = await service.getById(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe("Test Query");
    });

    it("should return null for non-existent query", async () => {
      const retrieved = await service.getById("non-existent");

      expect(retrieved).toBeNull();
    });

    it("should list queries", async () => {
      await service.create(testQuery);
      const other = { ...testQuery, id: "q2", name: "Other Query" };
      await service.create(other);

      const list = await service.list("tenant-1");

      expect(list.length).toBeGreaterThanOrEqual(2);
    });

    it("should update query", async () => {
      const created = await service.create(testQuery);
      const updated = await service.update(created.id, {
        name: "Updated Name",
      });

      expect(updated.name).toBe("Updated Name");
      expect(updated.id).toBe(created.id);
    });

    it("should throw error on update non-existent", async () => {
      await expect(
        service.update("non-existent", { name: "New" })
      ).rejects.toThrow();
    });

    it("should delete query", async () => {
      const created = await service.create(testQuery);
      const deleted = await service.delete(created.id);

      expect(deleted).toBe(true);

      const retrieved = await service.getById(created.id);
      expect(retrieved).toBeNull();
    });

    it("should return false on delete non-existent", async () => {
      const deleted = await service.delete("non-existent");

      expect(deleted).toBe(false);
    });
  });

  describe("search", () => {
    it("should search by name", async () => {
      await service.create(testQuery);
      const other = {
        ...testQuery,
        id: "q2",
        name: "Product Report",
      };
      await service.create(other);

      const results = await service.search("tenant-1", "Test");

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toContain("Test");
    });

    it("should search by description", async () => {
      await service.create(testQuery);

      const results = await service.search("tenant-1", "test query");

      expect(results.length).toBeGreaterThan(0);
    });

    it("should be case insensitive", async () => {
      await service.create(testQuery);

      const results = await service.search("tenant-1", "TEST");

      expect(results.length).toBeGreaterThan(0);
    });

    it("should return empty for no matches", async () => {
      await service.create(testQuery);

      const results = await service.search("tenant-1", "nonexistent");

      expect(results.length).toBe(0);
    });
  });

  describe("duplicate", () => {
    it("should duplicate query", async () => {
      const original = await service.create(testQuery);
      const copy = await service.duplicate(original.id);

      expect(copy.id).not.toBe(original.id);
      expect(copy.name).toContain("copy");
      expect(copy.blocks).toEqual(original.blocks);
    });

    it("should throw for non-existent query", async () => {
      await expect(service.duplicate("non-existent")).rejects.toThrow();
    });
  });

  describe("recent queries", () => {
    it("should get recent queries sorted by update time", async () => {
      await service.create(testQuery);
      await service.create({
        ...testQuery,
        id: "q2",
        name: "Query 2",
      });

      const recent = await service.getRecent("tenant-1", 10);

      expect(recent.length).toBeGreaterThanOrEqual(2);
      expect(recent[0].updatedAt.getTime()).toBeGreaterThanOrEqual(
        recent[1].updatedAt.getTime()
      );
    });

    it("should respect limit parameter", async () => {
      for (let i = 0; i < 5; i++) {
        await service.create({
          ...testQuery,
          id: `q${i}`,
          name: `Query ${i}`,
        });
      }

      const recent = await service.getRecent("tenant-1", 2);

      expect(recent.length).toBeLessThanOrEqual(2);
    });
  });

  describe("export", () => {
    it("should export query as SQL", async () => {
      const created = await service.create(testQuery);
      const sql = await service.exportAsSQL(created.id);

      expect(sql).toContain("SELECT");
    });

    it("should throw for non-existent query", async () => {
      await expect(service.exportAsSQL("non-existent")).rejects.toThrow();
    });
  });

  describe("statistics", () => {
    it("should get query statistics", async () => {
      await service.create(testQuery);
      const stats = await service.getStats("tenant-1");

      expect(stats.total).toBeGreaterThan(0);
      expect(stats.averageComplexity).toBeDefined();
    });
  });

  describe("sharing", () => {
    it("should share query", async () => {
      const created = await service.create(testQuery);
      const shared = await service.shareQuery(created.id, ["user1", "user2"]);

      expect(shared).toBe(true);
    });

    it("should return false for non-existent query", async () => {
      const shared = await service.shareQuery("non-existent", ["user1"]);

      expect(shared).toBe(false);
    });

    it("should add to favorites", async () => {
      const created = await service.create(testQuery);
      const added = await service.addToFavorites(created.id);

      expect(added).toBe(true);
    });

    it("should remove from favorites", async () => {
      const created = await service.create(testQuery);
      const removed = await service.removeFromFavorites(created.id);

      expect(removed).toBe(true);
    });
  });
});
