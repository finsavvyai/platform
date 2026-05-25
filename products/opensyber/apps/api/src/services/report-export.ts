import { eq, and, gte, lte, desc, gt } from 'drizzle-orm';
import { auditLog } from '@opensyber/db';
import type { ComplianceControlResult } from '@opensyber/shared';

const CSV_CHUNK_SIZE = 500;

/** Convert compliance results to CSV string. */
export function exportComplianceToCsv(
  results: ComplianceControlResult[],
  framework: string,
): string {
  const headers = ['Control ID', 'Name', 'Category', 'Status', 'Evidence', 'Framework'];
  const rows = results.map((r) => [
    escapeCsv(r.controlId),
    escapeCsv(r.name),
    escapeCsv(r.category),
    r.status,
    escapeCsv(r.evidence),
    framework,
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/** Export audit log entries to CSV with chunked pagination. */
export async function exportAuditToCsv(
  db: any,
  instanceId: string,
  from: string | null,
  to: string | null,
): Promise<string> {
  const headers = ['ID', 'Instance ID', 'Action', 'Skill ID', 'Actor ID', 'Details', 'Created At'];
  const csvLines: string[] = [headers.join(',')];
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const conditions = [eq(auditLog.instanceId, instanceId)];
    if (from) conditions.push(gte(auditLog.createdAt, from));
    if (to) conditions.push(lte(auditLog.createdAt, to));
    if (cursor) conditions.push(gt(auditLog.createdAt, cursor));

    const rows = await db.select().from(auditLog)
      .where(and(...conditions))
      .orderBy(desc(auditLog.createdAt))
      .limit(CSV_CHUNK_SIZE);

    for (const row of rows) {
      csvLines.push([
        escapeCsv(row.id),
        escapeCsv(row.instanceId),
        escapeCsv(row.action),
        escapeCsv(row.skillId ?? ''),
        escapeCsv(row.actorId ?? ''),
        escapeCsv(row.details ?? ''),
        escapeCsv(row.createdAt),
      ].join(','));
    }

    hasMore = rows.length === CSV_CHUNK_SIZE;
    if (hasMore) cursor = rows[rows.length - 1].createdAt;
  }

  return csvLines.join('\n');
}

/** Store export content in R2. Returns the key for later retrieval. */
export async function storeExport(
  r2: R2Bucket,
  key: string,
  content: string,
): Promise<void> {
  await r2.put(key, content, {
    httpMetadata: { contentType: 'text/csv' },
    customMetadata: { createdAt: new Date().toISOString() },
  });
}

/** Generate a time-limited URL for downloading an export. */
export function buildExportKey(
  instanceId: string,
  exportType: 'compliance' | 'audit',
  framework?: string,
): string {
  const ts = Date.now();
  const suffix = framework ? `-${framework}` : '';
  return `exports/${instanceId}/${exportType}${suffix}-${ts}.csv`;
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
