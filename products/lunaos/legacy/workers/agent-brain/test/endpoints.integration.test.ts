import { describe, it, expect, vi } from "vitest";
import { Miniflare } from "miniflare";
import path from "node:path";

describe("Agent Brain Worker - Integration Tests", () => {
    const mf = new Miniflare({
        scriptPath: path.join(__dirname, "../dist/index.js"), // Use compiled JS
        modules: true,
        bindings: {
            LUNAFORGE_PROVIDERS: "mock",
            OPENAI_API_KEY: "sk-test",
            ANTHROPIC_API_KEY: "at-test"
        }
    });

    it("should return healthy on /health", async () => {
        const res = await mf.dispatchFetch("http://localhost/health");
        expect(res.status).toBe(200);
        const json: any = await res.json();
        expect(json.status).toBe("healthy");
    });

    it("should validate license keys", async () => {
        const res = await mf.dispatchFetch("http://localhost/v1/license/validate", {
            method: "POST",
            body: JSON.stringify({ key: "LF-PREMIUM-KEY" })
        });
        const json: any = await res.json();
        expect(json.valid).toBe(true);
        expect(json.plan).toBe("premium");
    });

    it("should support memory storage (mock)", async () => {
        const putRes = await mf.dispatchFetch("http://localhost/v1/memory/put", {
            method: "POST",
            body: JSON.stringify({ key: "test", value: "data" })
        });
        expect(putRes.status).toBe(200);

        const getRes = await mf.dispatchFetch("http://localhost/v1/memory/get", {
            method: "POST",
            body: JSON.stringify({ key: "test" })
        });
        expect(getRes.status).toBe(200);
    });
});
