import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createBrainNodeAuditBucket, createBrainNodeFetch } from "./node-host.js";

describe("createBrainNodeAuditBucket", () => {
  it("prefers an injected audit writer over file and stdout", async () => {
    const lines: string[] = [];
    const bucket = createBrainNodeAuditBucket(
      { BRAIN_AUDIT_LOG_PATH: "/should/not/be/used.log" },
      { auditLogWriter: (line) => lines.push(line) },
    );
    await bucket.put("k1", JSON.stringify({ event: "brain.ping" }));
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toEqual({
      key: "k1",
      record: { event: "brain.ping" },
    });
    expect(lines[0]!.endsWith("\n")).toBe(true);
  });

  it("appends JSONL via injected fs when BRAIN_AUDIT_LOG_PATH is set", async () => {
    const ensureDir = vi.fn(async () => undefined);
    const appendFile = vi.fn(async () => undefined);
    const path = "/var/log/brain/audit.jsonl";
    const bucket = createBrainNodeAuditBucket(
      { BRAIN_AUDIT_LOG_PATH: path },
      {
        ensureDir: ensureDir as never,
        appendFile: appendFile as never,
      },
    );
    await bucket.put("k2", JSON.stringify({ event: "brain.search" }));
    expect(ensureDir).toHaveBeenCalledWith(dirname(path), { recursive: true });
    expect(appendFile).toHaveBeenCalledWith(
      path,
      `${JSON.stringify({ key: "k2", record: { event: "brain.search" } })}\n`,
      "utf8",
    );
  });

  it("appends to a real file with default fs bindings", async () => {
    const dir = await mkdtemp(join(tmpdir(), "brain-audit-"));
    const path = join(dir, "nested", "audit.jsonl");
    const bucket = createBrainNodeAuditBucket({ BRAIN_AUDIT_LOG_PATH: path });
    await bucket.put("k3", JSON.stringify({ event: "brain.ping" }));
    await bucket.put("k4", JSON.stringify({ event: "brain.search" }));
    const rows = (await readFile(path, "utf8")).trim().split("\n");
    expect(rows).toHaveLength(2);
    expect(JSON.parse(rows[0]!)).toEqual({
      key: "k3",
      record: { event: "brain.ping" },
    });
    expect(JSON.parse(rows[1]!)).toEqual({
      key: "k4",
      record: { event: "brain.search" },
    });
  });

  it("writes to injected stdout writer when no path is configured", async () => {
    const lines: string[] = [];
    const bucket = createBrainNodeAuditBucket(
      {},
      { stdoutWrite: (line) => lines.push(line) },
    );
    await bucket.put("k5", JSON.stringify({ event: "brain.ping" }));
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toEqual({
      key: "k5",
      record: { event: "brain.ping" },
    });
  });

  it("defaults to process.stdout when nothing is configured", async () => {
    const spy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    try {
      const bucket = createBrainNodeAuditBucket({});
      await bucket.put("k6", JSON.stringify({ event: "brain.ping" }));
      expect(spy).toHaveBeenCalledTimes(1);
      const written = String(spy.mock.calls[0]![0]);
      expect(JSON.parse(written)).toEqual({
        key: "k6",
        record: { event: "brain.ping" },
      });
    } finally {
      spy.mockRestore();
    }
  });
});

describe("createBrainNodeFetch", () => {
  it("serves the worker app over the node audit bucket", async () => {
    const lines: string[] = [];
    const fetchBrain = createBrainNodeFetch(
      { VERSION: "0.1.0-host-test", BRAIN_AUTH_TOKEN: "secret" },
      { auditLogWriter: (line) => lines.push(line) },
    );

    const health = await fetchBrain(new Request("http://brain.local/health"));
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({
      status: "ok",
      version: "0.1.0-host-test",
    });

    const ping = await fetchBrain(
      new Request("http://brain.local/v1/brain/ping", {
        method: "POST",
        headers: { Authorization: "Bearer secret" },
      }),
    );
    expect(ping.status).toBe(200);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toMatchObject({
      record: { event: "brain.ping", decision: "allow" },
    });
  });
});
