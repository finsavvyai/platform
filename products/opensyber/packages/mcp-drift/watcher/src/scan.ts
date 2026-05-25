// Core scan flow: fetch tools/list, fingerprint each tool, diff against D1,
// upsert latest, append history, return alerts. Used by the Hono route and tests.

import { drizzle } from 'drizzle-orm/d1';
import { and, eq } from 'drizzle-orm';
import { fetchToolsList } from './mcp-http-client.js';
import { fingerprintTool, canonicalJson } from './fingerprint.js';
import { classifyDrift } from './differ.js';
import { toolFingerprints, fingerprintHistory } from './schema.js';
import type { DriftAlert } from './alert.js';

export async function scanServer(d1: D1Database, serverUrl: string): Promise<DriftAlert[]> {
  const db = drizzle(d1);
  const tools = await fetchToolsList(serverUrl);
  const now = Date.now();
  const alerts: DriftAlert[] = [];

  for (const tool of tools) {
    const newFingerprint = await fingerprintTool(tool);
    const newDescription = tool.description;
    const newInputSchema = canonicalJson(tool.inputSchema);

    const [prior] = await db
      .select()
      .from(toolFingerprints)
      .where(and(eq(toolFingerprints.serverUrl, serverUrl), eq(toolFingerprints.toolName, tool.name)))
      .limit(1);

    const drift = classifyDrift({
      oldFingerprint: prior?.fingerprint ?? null,
      newFingerprint,
      oldDescription: prior?.description ?? '',
      newDescription,
      oldInputSchema: prior?.inputSchema ?? '',
      newInputSchema,
    });

    alerts.push({
      serverUrl,
      toolName: tool.name,
      verdict: drift.verdict,
      reason: drift.reason,
      oldFingerprint: prior?.fingerprint ?? null,
      newFingerprint,
      diffSummary: drift.diffSummary,
      observedAt: now,
    });

    if (prior === undefined) {
      await db.insert(toolFingerprints).values({
        serverUrl,
        toolName: tool.name,
        fingerprint: newFingerprint,
        description: newDescription,
        inputSchema: newInputSchema,
        firstSeen: now,
        lastSeen: now,
      });
    } else {
      await db
        .update(toolFingerprints)
        .set({ fingerprint: newFingerprint, description: newDescription, inputSchema: newInputSchema, lastSeen: now })
        .where(and(eq(toolFingerprints.serverUrl, serverUrl), eq(toolFingerprints.toolName, tool.name)));
    }

    await db.insert(fingerprintHistory).values({
      serverUrl,
      toolName: tool.name,
      fingerprint: newFingerprint,
      description: newDescription,
      inputSchema: newInputSchema,
      seenAt: now,
    });
  }

  return alerts;
}
