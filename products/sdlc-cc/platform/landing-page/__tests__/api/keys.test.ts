import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthMock, getOptionalCloudflareRequestContextMock } = vi.hoisted(() => ({
  getAuthMock: vi.fn(),
  getOptionalCloudflareRequestContextMock: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  getAuth: getAuthMock,
}));

vi.mock("../../lib/cloudflare-request-context", () => ({
  getOptionalCloudflareRequestContext: getOptionalCloudflareRequestContextMock,
}));

import keysHandler from "../../pages/api/keys";
import generateKeyHandler from "../../pages/api/keys/generate";
import keyHandler from "../../pages/api/keys/[keyId]";

class MockKVNamespace {
  private readonly store = new Map<string, string>();

  async get(key: string, type?: "json") {
    const value = this.store.get(key);

    if (value === undefined) {
      return null;
    }

    return type === "json" ? JSON.parse(value) : value;
  }

  async put(key: string, value: string) {
    this.store.set(key, value);
  }

  async delete(key: string) {
    this.store.delete(key);
  }

  async list(options?: { prefix?: string }) {
    const prefix = options?.prefix || "";
    const keys = Array.from(this.store.keys())
      .filter((name) => name.startsWith(prefix))
      .map((name) => ({ name }));

    return { keys };
  }
}

describe("/api/keys", () => {
  let kv: MockKVNamespace;

  beforeEach(() => {
    kv = new MockKVNamespace();
    vi.clearAllMocks();
    getAuthMock.mockReturnValue({ userId: "user_test_123" });
    getOptionalCloudflareRequestContextMock.mockReturnValue({
      env: {
        API_KEYS_KV: kv,
      },
    });
  });

  it("rejects unauthenticated requests", async () => {
    getAuthMock.mockReturnValue({ userId: null });

    const response = await keysHandler(
      new Request("https://sdlc.cc/api/keys", { method: "GET" }) as any,
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("creates and lists persisted API keys", async () => {
    const createResponse = await keysHandler(
      new Request("https://sdlc.cc/api/keys", { method: "POST" }) as any,
    );

    expect(createResponse.status).toBe(201);
    const created = await createResponse.json() as {
      id: string;
      key: string;
      keyPreview: string;
      createdAt: string;
      status: string;
      message: string;
    };

    expect(created.id).toMatch(/^key_/);
    expect(created.key).toMatch(/^sk-sdlc-live-/);
    expect(created.keyPreview).not.toBe(created.key);
    expect(created.status).toBe("active");
    expect(created.message).toContain("will not be shown again");

    const listResponse = await keysHandler(
      new Request("https://sdlc.cc/api/keys", { method: "GET" }) as any,
    );

    expect(listResponse.status).toBe(200);
    const listPayload = await listResponse.json() as {
      items: Array<{
        id: string;
        keyPreview: string;
        createdAt: string;
        status: string;
        key?: string;
      }>;
    };

    expect(listPayload.items).toHaveLength(1);
    expect(listPayload.items[0]).toEqual({
      id: created.id,
      keyPreview: created.keyPreview,
      createdAt: created.createdAt,
      status: "active",
    });
    expect(listPayload.items[0]).not.toHaveProperty("key");
  });

  it("supports the legacy /api/keys/generate endpoint", async () => {
    const response = await generateKeyHandler(
      new Request("https://sdlc.cc/api/keys/generate", { method: "POST" }) as any,
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      key: string;
      keyPreview: string;
      message: string;
    };

    expect(payload.key).toMatch(/^sk-sdlc-live-/);
    expect(payload.keyPreview).not.toBe(payload.key);
    expect(payload.message).toContain("Store this API key securely");
  });

  it("deletes persisted API keys", async () => {
    const createResponse = await keysHandler(
      new Request("https://sdlc.cc/api/keys", { method: "POST" }) as any,
    );
    const created = await createResponse.json() as { id: string };

    const deleteResponse = await keyHandler(
      new Request(`https://sdlc.cc/api/keys/${created.id}`, {
        method: "DELETE",
      }) as any,
    );

    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toEqual({ success: true });

    const listResponse = await keysHandler(
      new Request("https://sdlc.cc/api/keys", { method: "GET" }) as any,
    );
    const listPayload = await listResponse.json() as { items: unknown[] };

    expect(listPayload.items).toEqual([]);
  });

  it("returns 404 when deleting an unknown API key", async () => {
    const response = await keyHandler(
      new Request("https://sdlc.cc/api/keys/key_missing", {
        method: "DELETE",
      }) as any,
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "API key not found" });
  });

  it("returns 400 for an invalid API key id", async () => {
    const response = await keyHandler(
      new Request("https://sdlc.cc/api/keys/not-a-valid-id", {
        method: "DELETE",
      }) as any,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid API key request",
      message: "Invalid API key id",
    });
  });

  it("fails closed when API key storage is unavailable", async () => {
    getOptionalCloudflareRequestContextMock.mockReturnValue(undefined);

    const response = await keysHandler(
      new Request("https://sdlc.cc/api/keys", { method: "POST" }) as any,
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "API key management unavailable",
      message: "API key storage is not configured for this environment",
    });
  });
});
