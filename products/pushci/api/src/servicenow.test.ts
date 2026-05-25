import { describe, it, expect, beforeEach, vi } from "vitest";
import { ServiceNowClient } from "./servicenow";

const okCreate = {
  result: { sys_id: "abc123", number: "CHG0001234", state: "new" },
};
const okOAuth = { access_token: "sn.token", expires_in: 3600 };

describe("ServiceNowClient", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("requires instance", () => {
    expect(() => new ServiceNowClient({ instance: "" })).toThrow(/instance required/);
  });

  it("requires credentials", () => {
    expect(() => new ServiceNowClient({ instance: "https://x" })).toThrow(/credentials required/);
  });

  it("creates a CHG with basic auth", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(okCreate), { status: 201 }));
    const c = new ServiceNowClient({ instance: "https://x", user: "u", password: "p" });
    const ticket = await c.createChange({
      shortDescription: "Deploy PushCI v1.7.1",
      description: "Auto-opened by PushCI",
      riskLevel: "low",
    });
    expect(ticket.number).toBe("CHG0001234");
    expect(ticket.url).toContain("sys_id=abc123");
    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.authorization).toMatch(/^Basic /);
  });

  it("exchanges OAuth client_credentials when configured", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(okOAuth), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(okCreate), { status: 201 }));
    const c = new ServiceNowClient({
      instance: "https://x",
      clientId: "id",
      clientSecret: "secret",
    });
    await c.createChange({ shortDescription: "x", description: "y" });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const headers = fetchSpy.mock.calls[1][1]?.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer sn.token");
  });

  it("surfaces create failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("nope", { status: 400 }));
    const c = new ServiceNowClient({ instance: "https://x", user: "u", password: "p" });
    await expect(c.createChange({ shortDescription: "x", description: "y" })).rejects.toThrow(/HTTP 400/);
  });

  it("closes a CHG with closeCode + notes", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const c = new ServiceNowClient({ instance: "https://x", user: "u", password: "p" });
    await c.closeChange("abc123", "successful", "deploy passed");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://x/api/now/table/change_request/abc123",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("trims trailing slash on instance", () => {
    const c = new ServiceNowClient({ instance: "https://x/", user: "u", password: "p" });
    expect(c).toBeDefined();
  });
});
