import { describe, it, expect, vi } from "vitest";
import worker from "../src/index";

// Mock the providers to avoid actual network calls
vi.mock("../src/providers", async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        callMultiProvider: vi.fn().mockResolvedValue({
            plan: { id: "test", steps: [] },
            analysis: "mock analysis",
            recommendations: ["test"]
        }),
        callMythicMultiProvider: vi.fn().mockResolvedValue({
            architecture: "mock arch",
            diagram: "mock diagram",
            files: []
        })
    };
});

describe("Agent Brain Worker - Unit Tests", () => {
    const mockEnv = {
        LUNAFORGE_PROVIDERS: "mock",
        OPENAI_API_KEY: "sk-test",
        ANTHROPIC_API_KEY: "at-test"
    };

    const mockCtx = {} as any;

    it("should return healthy on /health", async () => {
        const req = new Request("http://localhost/health");
        const res = await worker.fetch(req, mockEnv as any, mockCtx);
        expect(res.status).toBe(200);
        const json: any = await res.json();
        expect(json.status).toBe("healthy");
    });

    it("should validate license keys", async () => {
        const req = new Request("http://localhost/v1/license/validate", {
            method: "POST",
            body: JSON.stringify({ key: "LF-PREMIUM-KEY" })
        });
        const res = await worker.fetch(req, mockEnv as any, mockCtx);
        const json: any = await res.json();
        expect(json.valid).toBe(true);
    });

    it("should handle /v1/plan", async () => {
        const req = new Request("http://localhost/v1/plan", {
            method: "POST",
            body: JSON.stringify({ summary: "test plan" })
        });
        const res = await worker.fetch(req, mockEnv as any, mockCtx);
        expect(res.status).toBe(200);
        const json: any = await res.json();
        expect(json.plan).toBeDefined();
    });

    it("should handle /v1/dream", async () => {
        const req = new Request("http://localhost/v1/dream", {
            method: "POST",
            body: JSON.stringify({ target: "test" })
        });
        const res = await worker.fetch(req, mockEnv as any, mockCtx);
        expect(res.status).toBe(200);
        const json: any = await res.json();
        expect(json.analysis).toBe("mock analysis");
    });
});
