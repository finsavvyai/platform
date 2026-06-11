import type { Server } from "node:http";
import { connect } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createBrainNodeHttpServer } from "./node-server.js";

let server: Server | undefined;

const listen = async (s: Server): Promise<string> => {
  await new Promise<void>((resolve) => s.listen(0, "127.0.0.1", resolve));
  const address = s.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("missing-listen-address");
  }
  return `http://127.0.0.1:${address.port}`;
};

const rawRequest = (baseUrl: string, payload: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const port = Number.parseInt(new URL(baseUrl).port, 10);
    const socket = connect(port, "127.0.0.1", () => {
      socket.write(payload);
    });
    let data = "";
    socket.on("data", (chunk) => {
      data += String(chunk);
    });
    socket.on("end", () => resolve(data));
    socket.on("error", reject);
  });

afterEach(async () => {
  if (server === undefined) return;
  const current = server;
  server = undefined;
  await new Promise<void>((resolve, reject) => {
    current.close((err) => (err ? reject(err) : resolve()));
  });
});

describe("Brain Node HTTP server", () => {
  it("serves health and writes audited protected calls as JSONL", async () => {
    const auditLines: string[] = [];
    server = createBrainNodeHttpServer({
      env: {
        VERSION: "0.1.0-node-test",
        BRAIN_AUTH_TOKEN: "secret",
      },
      deps: {
        auditLogWriter: (line) => auditLines.push(line),
      },
    });
    const baseUrl = await listen(server);

    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({
      status: "ok",
      version: "0.1.0-node-test",
    });

    const ping = await fetch(`${baseUrl}/v1/brain/ping`, {
      method: "POST",
      headers: { Authorization: "Bearer secret" },
    });
    expect(ping.status).toBe(200);
    expect(await ping.json()).toMatchObject({ ok: true });
    expect(auditLines).toHaveLength(1);
    expect(JSON.parse(auditLines[0]!)).toMatchObject({
      key: expect.stringContaining("brain.ping"),
      record: {
        actor_id: "brain-worker-client",
        event: "brain.ping",
        decision: "allow",
      },
    });
  });

  it("proxies SAR Draft requests through configured runtime fetch", async () => {
    let runtimeBody: unknown = null;
    const draft = {
      alert_id: "A-1",
      template_id: "structuring",
      filled_text: "Draft narrative.",
      citations: [],
      confidence: 0.7,
      human_review_required: true,
    };
    server = createBrainNodeHttpServer({
      env: {
        VERSION: "0.1.0-node-test",
        BRAIN_AUTH_TOKEN: "secret",
        BRAIN_SAR_DRAFT_ENDPOINT: "https://sar.internal/draft",
      },
      deps: {
        auditLogWriter: () => undefined,
        httpFetch: async (_url, init) => {
          runtimeBody = JSON.parse(String(init?.body));
          return new Response(JSON.stringify({ draft }));
        },
      },
    });
    const baseUrl = await listen(server);

    const res = await fetch(`${baseUrl}/v1/brain/sar-draft`, {
      method: "POST",
      headers: {
        Authorization: "Bearer secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tenant_id: "tenant-a",
        alert: { alert_id: "A-1", alert_type: "structuring" },
      }),
    });
    expect(res.status).toBe(200);
    expect(runtimeBody).toMatchObject({
      alert: { alert_id: "A-1", tenant_id: "tenant-a" },
    });
  });

  it("serves with process.env and default deps when no options given", async () => {
    server = createBrainNodeHttpServer();
    const baseUrl = await listen(server);

    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ status: "ok" });
  });

  it("honours x-forwarded-proto when building the request URL", async () => {
    server = createBrainNodeHttpServer({
      env: { VERSION: "0.1.0-node-test" },
      deps: { auditLogWriter: () => undefined },
    });
    const baseUrl = await listen(server);

    const health = await fetch(`${baseUrl}/health`, {
      headers: { "x-forwarded-proto": "https" },
    });
    expect(health.status).toBe(200);
  });

  it("serves HTTP/1.0 requests without a Host header and multi-value headers", async () => {
    server = createBrainNodeHttpServer({
      env: { VERSION: "0.1.0-node-test" },
      deps: { auditLogWriter: () => undefined },
    });
    const baseUrl = await listen(server);

    const response = await rawRequest(
      baseUrl,
      "GET /health HTTP/1.0\r\nSet-Cookie: a=1\r\nSet-Cookie: b=2\r\n\r\n",
    );
    expect(response).toContain(" 200 ");
    expect(response).toContain('"status":"ok"');
  });

  it("returns a stable 500 error body when the request cannot be translated", async () => {
    server = createBrainNodeHttpServer({
      env: { VERSION: "0.1.0-node-test" },
      deps: { auditLogWriter: () => undefined },
    });
    const baseUrl = await listen(server);

    const response = await rawRequest(
      baseUrl,
      "GET /health HTTP/1.1\r\nHost: bad host\r\nConnection: close\r\n\r\n",
    );
    expect(response).toContain(" 500 ");
    expect(response).toContain("brain_node_server_error");
  });
});
