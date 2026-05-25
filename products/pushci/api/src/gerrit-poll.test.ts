// Stream M — gerrit-poll tests.
//
// Mocks env.RUNNERS (KV), env.DB (D1), and global fetch to exercise the
// scheduled polling path. We avoid any real network or database access.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { pollGerritProject, pollAllGerritProjects } from "./gerrit-poll";
import type { Env } from "./types";

// Hoist-safe mock for queueCiRun — gerrit-poll imports it from cloud-runners.
// We stub it to avoid the full cloud-runners import chain during tests.
vi.mock("./cloud-runners", () => ({
  queueCiRun: vi.fn(async () => ({ id: "job-stub" })),
}));

// --- in-memory KV mock ------------------------------------------------------

function makeKv(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async ({ prefix }: { prefix: string }) => ({
      keys: Array.from(store.keys())
        .filter((k) => k.startsWith(prefix))
        .map((name) => ({ name })),
      list_complete: true,
      cursor: "",
    })),
    _store: store,
  };
}

// --- in-memory D1 mock ------------------------------------------------------
// Supports the two statements gerrit-poll.ts touches:
//   SELECT * FROM projects WHERE repo = ?     (getProjectByRepo)
//   INSERT INTO runs ...                      (insertRun)

function makeDb(projectsByRepo: Record<string, { id: string; repo: string; platform: string }>) {
  const runs: unknown[] = [];
  return {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((...args: unknown[]) => ({
        first: vi.fn(async () => {
          if (sql.includes("FROM projects") && sql.includes("repo")) {
            return projectsByRepo[args[0] as string] ?? null;
          }
          return null;
        }),
        run: vi.fn(async () => {
          if (sql.includes("INSERT INTO runs")) runs.push(args);
          return { success: true };
        }),
        all: vi.fn(async () => ({ results: [] })),
      })),
    })),
    _runs: runs,
  };
}

function makeEnv(
  kv: ReturnType<typeof makeKv>,
  db: ReturnType<typeof makeDb>
): Env {
  return {
    RUNNERS: kv as unknown as KVNamespace,
    DB: db as unknown as D1Database,
  } as unknown as Env;
}

function seedProject(
  kv: ReturnType<typeof makeKv>,
  id: string,
  overrides: Partial<{ pollEnabled: boolean; project: string; host: string }> = {}
) {
  kv._store.set(
    `gerrit:project:${id}`,
    JSON.stringify({
      id,
      ownerSub: "user_1",
      host: overrides.host ?? "https://gerrit.example.com",
      project: overrides.project ?? "norlys/metering",
      httpUser: "pushci-bot",
      httpPassword: "pw",
      httpPasswordEnc: false,
      webhookSecret: "secret",
      createdAt: new Date().toISOString(),
      pollEnabled: overrides.pollEnabled ?? false,
    })
  );
}

function gerritChanges(
  entries: Array<{ change_id: string; current_revision: string; branch?: string }>
) {
  const body = entries.map((e) => ({
    id: e.change_id,
    change_id: e.change_id,
    project: "norlys/metering",
    branch: e.branch ?? "master",
    subject: "subj",
    status: "NEW",
    current_revision: e.current_revision,
  }));
  return new Response(")]}'\n" + JSON.stringify(body), { status: 200 });
}

const originalFetch = globalThis.fetch;

describe("pollGerritProject", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("creates runs for new open changes", async () => {
    const kv = makeKv();
    seedProject(kv, "p1", { pollEnabled: true });
    const db = makeDb({
      "gerrit/norlys/metering": { id: "proj-1", repo: "gerrit/norlys/metering", platform: "github" },
    });
    const env = makeEnv(kv, db);

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      gerritChanges([
        { change_id: "Iaaa", current_revision: "sha-a" },
        { change_id: "Ibbb", current_revision: "sha-b" },
      ])
    );

    const res = await pollGerritProject(env, "p1");
    expect(res.checked).toBe(2);
    expect(res.newChanges).toBe(2);
    expect(res.runsCreated).toHaveLength(2);
    expect(res.errors).toHaveLength(0);
    // Seen markers were written.
    expect(kv._store.has("gerrit:seen:p1:Iaaa:sha-a")).toBe(true);
    expect(kv._store.has("gerrit:seen:p1:Ibbb:sha-b")).toBe(true);
  });

  it("skips already-seen changes", async () => {
    const kv = makeKv();
    seedProject(kv, "p1", { pollEnabled: true });
    kv._store.set("gerrit:seen:p1:Iaaa:sha-a", "1");
    const db = makeDb({
      "gerrit/norlys/metering": { id: "proj-1", repo: "gerrit/norlys/metering", platform: "github" },
    });
    const env = makeEnv(kv, db);

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      gerritChanges([
        { change_id: "Iaaa", current_revision: "sha-a" }, // seen
        { change_id: "Ibbb", current_revision: "sha-b" }, // new
      ])
    );

    const res = await pollGerritProject(env, "p1");
    expect(res.checked).toBe(2);
    expect(res.newChanges).toBe(1);
    expect(res.runsCreated).toHaveLength(1);
  });

  it("records error when project config is missing", async () => {
    const kv = makeKv();
    const db = makeDb({});
    const env = makeEnv(kv, db);

    const res = await pollGerritProject(env, "nope");
    expect(res.checked).toBe(0);
    expect(res.newChanges).toBe(0);
    expect(res.errors[0]).toMatch(/not found/);
  });

  it("records error when Gerrit API 500s", async () => {
    const kv = makeKv();
    seedProject(kv, "p1", { pollEnabled: true });
    const db = makeDb({
      "gerrit/norlys/metering": { id: "proj-1", repo: "gerrit/norlys/metering", platform: "github" },
    });
    const env = makeEnv(kv, db);

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("boom", { status: 500 })
    );

    const res = await pollGerritProject(env, "p1");
    expect(res.checked).toBe(0);
    expect(res.newChanges).toBe(0);
    expect(res.errors.length).toBeGreaterThan(0);
    expect(res.errors[0]).toMatch(/list changes/i);
  });

  it("records error when no linked PushCI project exists", async () => {
    const kv = makeKv();
    seedProject(kv, "p1", { pollEnabled: true });
    const db = makeDb({});
    const env = makeEnv(kv, db);

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      gerritChanges([{ change_id: "Iaaa", current_revision: "sha-a" }])
    );

    const res = await pollGerritProject(env, "p1");
    expect(res.newChanges).toBe(0);
    expect(res.errors.some((e) => e.includes("no pushci project"))).toBe(true);
  });

  it("never throws — captures unexpected rejections", async () => {
    const kv = makeKv();
    seedProject(kv, "p1", { pollEnabled: true });
    const db = makeDb({
      "gerrit/norlys/metering": { id: "proj-1", repo: "gerrit/norlys/metering", platform: "github" },
    });
    const env = makeEnv(kv, db);

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new TypeError("network down")
    );

    const res = await pollGerritProject(env, "p1");
    expect(res.errors[0]).toMatch(/network down/);
  });
});

describe("pollAllGerritProjects", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("skips projects with pollEnabled=false", async () => {
    const kv = makeKv();
    seedProject(kv, "p1", { pollEnabled: false });
    seedProject(kv, "p2", { pollEnabled: false });
    const db = makeDb({});
    const env = makeEnv(kv, db);

    const res = await pollAllGerritProjects(env);
    expect(res.projectsPolled).toBe(0);
    expect(res.totalNewChanges).toBe(0);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("only polls opted-in projects", async () => {
    const kv = makeKv();
    seedProject(kv, "p1", { pollEnabled: true });
    seedProject(kv, "p2", { pollEnabled: false });
    const db = makeDb({
      "gerrit/norlys/metering": { id: "proj-1", repo: "gerrit/norlys/metering", platform: "github" },
    });
    const env = makeEnv(kv, db);

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      gerritChanges([{ change_id: "Iaaa", current_revision: "sha-a" }])
    );

    const res = await pollAllGerritProjects(env);
    expect(res.projectsPolled).toBe(1);
    expect(res.totalNewChanges).toBe(1);
    expect(res.perProject.p1).toBeDefined();
    expect(res.perProject.p2).toBeUndefined();
  });

  it("empty project list → zero counts", async () => {
    const kv = makeKv();
    const db = makeDb({});
    const env = makeEnv(kv, db);

    const res = await pollAllGerritProjects(env);
    expect(res).toEqual({
      projectsPolled: 0,
      totalNewChanges: 0,
      totalRunsCreated: 0,
      perProject: {},
    });
  });
});
