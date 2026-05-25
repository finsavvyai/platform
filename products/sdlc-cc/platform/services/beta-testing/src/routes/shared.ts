/**
 * Shared dependencies for beta testing routes
 */
import BetaTestingService from "../beta-testing.service";
import { createMcpClient } from "@sdlc/mcp-sdk";
import { z } from "zod";

export const mcp = createMcpClient();

export const betaService = new BetaTestingService(
  mcp.db,
  mcp.kv,
  mcp.email,
  mcp.monitoring,
);

export const surveyResponseValueSchema = z.object({
  answer: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
});

export const activityDataSchema = z.record(
  z.union([z.string(), z.number(), z.boolean()]),
);

export const activityMetadataSchema = z.record(
  z.union([z.string(), z.number(), z.boolean()]),
);

export function errorResponse(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
