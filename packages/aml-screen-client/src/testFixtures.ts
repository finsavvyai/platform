// Test-only fixtures + response helpers. Not part of the public API.
import type { ScreenResponse } from "./types.js";

export function validResponse(): ScreenResponse {
  return {
    query: "Vladimir Putin",
    matches: [
      {
        entityId: "ofac-12345",
        entityName: "Vladimir Putin",
        confidence: 0.98,
        lists: ["ofac", "eu_fsf"],
        layers: [
          { layer: "exact", score: 1.0, matched: true },
          { layer: "fuzzy", score: 0.97, matched: true },
          { layer: "phonetic", score: 0.95, matched: true },
          { layer: "token", score: 0.99, matched: true },
          { layer: "embedding", score: 0.96, matched: true },
        ],
        pepStatus: "current",
      },
    ],
    riskLevel: "high",
    latencyMs: 12,
    screenedAt: "2026-05-26T12:00:00.000Z",
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
