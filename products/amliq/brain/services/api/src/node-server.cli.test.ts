import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  renderListenAddress,
  resolveListenTarget,
  runBrainNodeCli,
  startBrainNodeServer,
} from "./node-server.js";

let server: Server | undefined;

const closeServer = async (s: Server): Promise<void> =>
  new Promise((resolve, reject) => {
    s.close((err) => (err ? reject(err) : resolve()));
  });

afterEach(async () => {
  if (server === undefined) return;
  const current = server;
  server = undefined;
  await closeServer(current);
  delete process.env.HOST;
  delete process.env.PORT;
  process.exitCode = undefined;
});

const testEnv = { VERSION: "0.1.0-cli-test" };
const testDeps = { auditLogWriter: () => undefined };

describe("startBrainNodeServer", () => {
  it("listens on the explicit host and port options", async () => {
    server = await startBrainNodeServer({
      env: testEnv,
      deps: testDeps,
      host: "127.0.0.1",
      port: 0,
    });
    const address = server.address();
    expect(typeof address === "object" && address !== null).toBe(true);

    const health = await fetch(`http://${renderListenAddress(address)}/health`);
    expect(health.status).toBe(200);
  });

  it("falls back to HOST and PORT environment variables", async () => {
    process.env.HOST = "127.0.0.1";
    process.env.PORT = "0";
    server = await startBrainNodeServer({ env: testEnv, deps: testDeps });
    const address = server.address();
    if (typeof address !== "object" || address === null) {
      throw new Error("missing-listen-address");
    }
    expect(address.address).toBe("127.0.0.1");
    expect(address.port).toBeGreaterThan(0);
  });
});

describe("resolveListenTarget", () => {
  it("defaults to 127.0.0.1:8787 when nothing is configured", () => {
    expect(resolveListenTarget({}, {})).toEqual({
      host: "127.0.0.1",
      port: 8787,
    });
  });

  it("prefers explicit options over environment variables", () => {
    expect(
      resolveListenTarget(
        { host: "0.0.0.0", port: 9000 },
        { HOST: "10.0.0.1", PORT: "9100" },
      ),
    ).toEqual({ host: "0.0.0.0", port: 9000 });
  });

  it("falls back to HOST and PORT environment variables", () => {
    expect(resolveListenTarget({}, { HOST: "10.0.0.1", PORT: "9100" })).toEqual(
      { host: "10.0.0.1", port: 9100 },
    );
  });
});

describe("renderListenAddress", () => {
  it("renders socket address objects as host:port", () => {
    expect(
      renderListenAddress({ address: "127.0.0.1", family: "IPv4", port: 8787 }),
    ).toBe("127.0.0.1:8787");
  });

  it("stringifies non-object addresses", () => {
    expect(renderListenAddress(null)).toBe("null");
    expect(renderListenAddress("/tmp/brain.sock")).toBe("/tmp/brain.sock");
  });
});

describe("runBrainNodeCli", () => {
  it("starts the server and logs a structured started event", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await runBrainNodeCli({
        env: testEnv,
        deps: testDeps,
        host: "127.0.0.1",
        port: 0,
      }, {
        start: async (options) => {
          server = await startBrainNodeServer(options);
          return server;
        },
      });
      expect(logSpy).toHaveBeenCalledTimes(1);
      const event = JSON.parse(String(logSpy.mock.calls[0]![0]));
      expect(event.event).toBe("brain.node.started");
      expect(event.address).toMatch(/^127\.0\.0\.1:\d+$/);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("uses startBrainNodeServer by default and returns the server", async () => {
    const lines: string[] = [];
    const started = await runBrainNodeCli(
      { env: testEnv, deps: testDeps, host: "127.0.0.1", port: 0 },
      { log: (line) => lines.push(line) },
    );
    expect(started).toBeDefined();
    server = started;
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toMatchObject({
      event: "brain.node.started",
    });
  });

  it("logs a structured failure and sets exit code when start fails", async () => {
    const errors: string[] = [];
    await runBrainNodeCli({}, {
      start: async () => {
        throw new Error("listen-denied");
      },
      error: (line) => errors.push(line),
    });
    expect(errors).toHaveLength(1);
    expect(JSON.parse(errors[0]!)).toEqual({
      event: "brain.node.start_failed",
      error: "listen-denied",
    });
    expect(process.exitCode).toBe(1);
  });

  it("renders unknown for non-Error failures via default error logger", async () => {
    const errSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      await runBrainNodeCli({}, {
        start: async () => {
          throw "boom";
        },
      });
      expect(errSpy).toHaveBeenCalledTimes(1);
      expect(JSON.parse(String(errSpy.mock.calls[0]![0]))).toEqual({
        event: "brain.node.start_failed",
        error: "unknown",
      });
      expect(process.exitCode).toBe(1);
    } finally {
      errSpy.mockRestore();
    }
  });
});
