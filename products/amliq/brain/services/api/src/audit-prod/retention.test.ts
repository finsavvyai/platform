import { describe, expect, it } from "vitest";
import {
  auditRetentionPrefix,
  purgeExpiredAuditObjects,
  type R2AuditBucket,
  type R2AuditObject,
} from "./retention.js";

const bucket = (objects: readonly R2AuditObject[]): {
  readonly r2: R2AuditBucket;
  readonly deleted: string[];
  readonly cursors: (string | undefined)[];
} => {
  const deleted: string[] = [];
  const cursors: (string | undefined)[] = [];
  const r2: R2AuditBucket = {
    list: async (opts) => {
      cursors.push(opts?.cursor);
      return { objects };
    },
    delete: async (keys) => {
      if (typeof keys === "string") deleted.push(keys);
      else deleted.push(...keys);
    },
  };
  return { r2, deleted, cursors };
};

describe("audit retention purge", () => {
  it("builds tenant-scoped prefixes and rejects malformed tenants", () => {
    expect(auditRetentionPrefix("tenant-a")).toBe("audit/tenant-a/");
    expect(() => auditRetentionPrefix("BAD")).toThrow(
      "audit_retention.tenant.unknown",
    );
  });

  it("deletes only objects older than the retention cutoff", async () => {
    const { r2, deleted } = bucket([
      { key: "audit/tenant-a/old.json", uploaded: new Date("2020-01-01") },
      { key: "audit/tenant-a/new.json", uploaded: new Date("2026-01-01") },
      { key: "audit/tenant-a/no-upload.json" },
    ]);

    const result = await purgeExpiredAuditObjects({
      bucket: r2,
      tenantId: "tenant-a",
      retentionDays: 365,
      now: () => Date.parse("2026-05-26T00:00:00Z"),
    });

    expect(deleted).toStrictEqual(["audit/tenant-a/old.json"]);
    expect(result).toMatchObject({
      prefix: "audit/tenant-a/",
      scanned: 3,
      matched: 1,
      deleted: 1,
      dryRun: false,
    });
  });

  it("supports dry-run and max delete limits", async () => {
    const { r2, deleted } = bucket([
      { key: "a", uploaded: "2020-01-01T00:00:00Z" },
      { key: "b", uploaded: "2020-01-02T00:00:00Z" },
    ]);

    const result = await purgeExpiredAuditObjects({
      bucket: r2,
      tenantId: "tenant-a",
      retentionDays: 1,
      now: () => Date.parse("2026-05-26T00:00:00Z"),
      dryRun: true,
      maxDeletes: 1,
    });

    expect(deleted).toStrictEqual([]);
    expect(result.matched).toBe(2);
    expect(result.deleted).toBe(1);
    expect(result.dryRun).toBe(true);
  });

  it("returns a cursor when stopped before a truncated page chain completes", async () => {
    const deleted: string[] = [];
    const r2: R2AuditBucket = {
      list: async () => ({
        objects: [
          { key: "audit/tenant-a/old.json", uploaded: "2020-01-01T00:00:00Z" },
        ],
        truncated: true,
        cursor: "page-2",
      }),
      delete: async (keys) => {
        deleted.push(...(typeof keys === "string" ? [keys] : keys));
      },
    };

    const result = await purgeExpiredAuditObjects({
      bucket: r2,
      tenantId: "tenant-a",
      retentionDays: 1,
      now: () => Date.parse("2026-05-26T00:00:00Z"),
      maxDeletes: 1,
    });

    expect(deleted).toStrictEqual(["audit/tenant-a/old.json"]);
    expect(result.nextCursor).toBe("page-2");
  });

  it("rejects invalid retention windows", async () => {
    const { r2 } = bucket([]);
    await expect(purgeExpiredAuditObjects({
      bucket: r2,
      tenantId: "tenant-a",
      retentionDays: 0,
    })).rejects.toThrow("audit_retention.retention_days_invalid");
  });
});
