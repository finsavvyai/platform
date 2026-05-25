import { describe, it, expect, beforeEach, vi } from "vitest";
import { VaultClient, vaultFromEnv } from "./vault";

const okSecret = {
  data: {
    data: { foo: "bar" },
    metadata: { version: 3, created_time: "2026-04-22T12:00:00Z" },
  },
};
const okAuth = {
  auth: { client_token: "hvs.leased", lease_duration: 3600 },
};

describe("VaultClient", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("requires addr", () => {
    expect(() => new VaultClient({ addr: "", token: "t" })).toThrow(/addr required/);
  });

  it("requires token or roleId", () => {
    expect(() => new VaultClient({ addr: "https://v" })).toThrow(/token or roleId/);
  });

  it("reads a KV v2 secret with a static token", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(okSecret), { status: 200 }),
    );
    const c = new VaultClient({ addr: "https://v", token: "hvs.root" });
    const s = await c.readSecret("secret", "app/db");
    expect(s.data).toEqual({ foo: "bar" });
    expect(s.version).toBe(3);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://v/v1/secret/data/app/db",
      expect.objectContaining({
        headers: expect.objectContaining({ "x-vault-token": "hvs.root" }),
      }),
    );
  });

  it("exchanges AppRole creds for a leased token on first read", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(okAuth), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(okSecret), { status: 200 }));
    const c = new VaultClient({ addr: "https://v", roleId: "r", secretId: "s" });
    await c.readSecret("kv", "svc/creds");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[0][0]).toBe("https://v/v1/auth/approle/login");
  });

  it("caches the leased token across reads", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(okAuth), { status: 200 }))
      .mockImplementation(async () => new Response(JSON.stringify(okSecret), { status: 200 }));
    const c = new VaultClient({ addr: "https://v", roleId: "r", secretId: "s" });
    await c.readSecret("kv", "a");
    await c.readSecret("kv", "b");
    const loginCalls = fetchSpy.mock.calls.filter(([u]: [unknown, ...unknown[]]) =>
      String(u).includes("/login"),
    );
    expect(loginCalls).toHaveLength(1);
  });

  it("surfaces HTTP errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("nope", { status: 403 }));
    const c = new VaultClient({ addr: "https://v", token: "t" });
    await expect(c.readSecret("kv", "x")).rejects.toThrow(/HTTP 403/);
  });

  it("forwards namespace header when configured", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(okSecret), { status: 200 }),
    );
    const c = new VaultClient({ addr: "https://v", token: "t", namespace: "finance/" });
    await c.readSecret("kv", "x");
    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["x-vault-namespace"]).toBe("finance/");
  });
});

describe("vaultFromEnv", () => {
  it("returns null when VAULT_ADDR is unset", () => {
    expect(vaultFromEnv({})).toBeNull();
  });

  it("constructs a client from env", () => {
    const c = vaultFromEnv({ VAULT_ADDR: "https://v", VAULT_TOKEN: "t" });
    expect(c).toBeInstanceOf(VaultClient);
  });
});
