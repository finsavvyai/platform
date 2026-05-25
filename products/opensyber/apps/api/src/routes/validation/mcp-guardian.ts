/**
 * MCP Guardian Route Validation Schemas
 */
import { z } from 'zod';

const mcpToolSchema = z.object({
  name: z.string().min(1),
  permissions: z.array(z.string()).optional(),
  command: z.string().optional(),
});

export const mcpScanSchema = z.object({
  name: z.string().min(1).max(200),
  bindAddress: z.string().optional(),
  port: z.number().int().positive().optional(),
  auth: z.object({
    type: z.string().optional(),
    token: z.string().optional(),
  }).nullable().optional(),
  tools: z.array(mcpToolSchema).optional(),
  storage: z.object({
    encrypted: z.boolean().optional(),
    path: z.string().optional(),
  }).nullable().optional(),
  tokenScopes: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional(),
});

export const mcpQuarantineSchema = z.object({
  reason: z.string().min(1).max(500),
});
