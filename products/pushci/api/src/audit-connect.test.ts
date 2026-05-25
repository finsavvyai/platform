// Unit tests for the audit-connect helper (I-003 fix).
// License: Apache-2.0

import { describe, it, expect, beforeEach } from "vitest";
import { auditConnect, auditDisconnect, callerIp } from "./audit-connect";

type InsertedRow = {
  actor_sub: string | null;
  actor_login: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  details_json: string;
};

function makeDb(): { db: D1Database; rows: InsertedRow[] } {
  const rows: InsertedRow[] = [];
  const prepare = (_sql: string) => ({
    binds: [] as unknown[],
    bind(...args: unknown[]) {
      this.binds = args;
      return this;
    },
    async run() {
      const [actor_sub, actor_login, action, resource_type, resource_id, details_json] =
        this.binds as [string | null, string | null, string, string, string, string];
      rows.push({ actor_sub, actor_login, action, resource_type, resource_id, details_json });
      return { success: true };
    },
  });
  const db = { prepare } as unknown as D1Database;
  return { db, rows };
}

describe("auditConnect", () => {
  let rows: InsertedRow[];
  let env: { DB: D1Database };

  beforeEach(() => {
    const made = makeDb();
    rows = made.rows;
    env = { DB: made.db };
  });

  it("writes one integration_connect row with expected fields", async () => {
    await auditConnect(env, {
      sub: "github:42",
      provider: "gitlab",
      label: "gitlab.com",
      ip: "203.0.113.7",
      meta: { baseUrl: "https://gitlab.com" },
    });
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.action).toBe("integration_connect");
    expect(row.resource_type).toBe("integration");
    expect(row.resource_id).toBe("gitlab:gitlab.com");
    expect(row.actor_sub).toBe("github:42");
    expect(row.actor_login).toBeNull();
    const details = JSON.parse(row.details_json);
    expect(details.ip).toBe("203.0.113.7");
    expect(details.meta).toEqual({ baseUrl: "https://gitlab.com" });
  });

  it("writes integration_disconnect on auditDisconnect", async () => {
    await auditDisconnect(env, {
      sub: "github:42",
      provider: "jenkins",
      label: "ci.corp",
      ip: null,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("integration_disconnect");
    expect(rows[0].resource_id).toBe("jenkins:ci.corp");
    const details = JSON.parse(rows[0].details_json);
    expect(details.ip).toBeNull();
    expect(details.meta).toBeUndefined();
  });

  it("never logs a secret — only the declared meta keys are written", async () => {
    await auditConnect(env, {
      sub: "s",
      provider: "aws",
      label: "us-east-1:role",
      ip: "1.2.3.4",
      meta: { region: "us-east-1", mode: "role" },
    });
    const details = rows[0].details_json;
    expect(details).not.toMatch(/AKIA/);
    expect(details).not.toMatch(/secret/i);
    expect(details).not.toMatch(/token/i);
  });

  it("does not throw when D1 insert rejects — audit must not block user action", async () => {
    const brokenEnv = {
      DB: {
        prepare: () => ({
          bind: () => ({
            run: async () => {
              throw new Error("D1 connection lost");
            },
          }),
        }),
      } as unknown as D1Database,
    };
    await expect(
      auditConnect(brokenEnv, { sub: "s", provider: "gitlab", label: "l", ip: null })
    ).resolves.toBeUndefined();
  });
});

describe("callerIp", () => {
  it("pulls cf-connecting-ip from headers", () => {
    expect(callerIp((k) => (k === "cf-connecting-ip" ? "192.0.2.5" : undefined))).toBe(
      "192.0.2.5"
    );
  });

  it("also accepts uppercase variant", () => {
    expect(callerIp((k) => (k === "CF-Connecting-IP" ? "198.51.100.4" : undefined))).toBe(
      "198.51.100.4"
    );
  });

  it("returns null when header absent", () => {
    expect(callerIp(() => undefined)).toBeNull();
  });

  it("strips control chars and caps length", () => {
    const weird = "1.1.1.1\x00\n" + "A".repeat(500);
    const got = callerIp(() => weird);
    expect(got).not.toBeNull();
    expect(got!.length).toBeLessThanOrEqual(64);
    expect(got).not.toMatch(/[\x00-\x1f]/);
  });
});
