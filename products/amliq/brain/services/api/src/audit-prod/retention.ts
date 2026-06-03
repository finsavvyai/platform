import { TENANT_ID_REGEX } from "../tenant/types.js";

export interface R2AuditObject {
  readonly key: string;
  readonly uploaded?: Date | string;
}

export interface R2AuditListResult {
  readonly objects: readonly R2AuditObject[];
  readonly truncated?: boolean;
  readonly cursor?: string;
}

export interface R2AuditBucket {
  list(options?: {
    readonly prefix?: string;
    readonly cursor?: string;
    readonly limit?: number;
  }): Promise<R2AuditListResult>;
  delete(keys: string | readonly string[]): Promise<unknown>;
}

export interface AuditRetentionPurgeOptions {
  readonly bucket: R2AuditBucket;
  readonly tenantId: string;
  readonly retentionDays?: number;
  readonly now?: () => number;
  readonly dryRun?: boolean;
  readonly maxDeletes?: number;
  readonly pageLimit?: number;
}

export interface AuditRetentionPurgeResult {
  readonly prefix: string;
  readonly cutoffMs: number;
  readonly scanned: number;
  readonly matched: number;
  readonly deleted: number;
  readonly dryRun: boolean;
  readonly nextCursor?: string;
}

const DEFAULT_RETENTION_DAYS = 365 * 7;
const DEFAULT_PAGE_LIMIT = 1000;

const assertTenant = (tenantId: string): void => {
  if (!TENANT_ID_REGEX.test(tenantId)) {
    throw new Error("audit_retention.tenant.unknown");
  }
};

const uploadedMs = (obj: R2AuditObject): number | null => {
  if (obj.uploaded instanceof Date) return obj.uploaded.getTime();
  if (typeof obj.uploaded === "string") {
    const parsed = Date.parse(obj.uploaded);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const retentionMs = (days: number): number => {
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error("audit_retention.retention_days_invalid");
  }
  return Math.floor(days) * 24 * 60 * 60 * 1000;
};

export const auditRetentionPrefix = (tenantId: string): string => {
  assertTenant(tenantId);
  return `audit/${tenantId}/`;
};

export const purgeExpiredAuditObjects = async (
  opts: AuditRetentionPurgeOptions,
): Promise<AuditRetentionPurgeResult> => {
  const prefix = auditRetentionPrefix(opts.tenantId);
  const cutoffMs =
    (opts.now ?? (() => Date.now()))()
      - retentionMs(opts.retentionDays ?? DEFAULT_RETENTION_DAYS);
  const pageLimit = opts.pageLimit ?? DEFAULT_PAGE_LIMIT;
  const dryRun = opts.dryRun === true;
  const maxDeletes = opts.maxDeletes ?? Number.POSITIVE_INFINITY;

  let cursor: string | undefined;
  let scanned = 0;
  let matched = 0;
  let deleted = 0;

  do {
    const page = await opts.bucket.list({
      prefix,
      ...(cursor !== undefined ? { cursor } : {}),
      limit: pageLimit,
    });
    const deleteKeys: string[] = [];
    for (const obj of page.objects) {
      scanned += 1;
      const ts = uploadedMs(obj);
      if (ts === null || ts >= cutoffMs) continue;
      matched += 1;
      if (deleted + deleteKeys.length < maxDeletes) {
        deleteKeys.push(obj.key);
      }
    }

    if (!dryRun && deleteKeys.length > 0) {
      await opts.bucket.delete(deleteKeys);
      deleted += deleteKeys.length;
    } else if (dryRun) {
      deleted += deleteKeys.length;
    }

    cursor = page.truncated === true ? page.cursor : undefined;
    if (deleted >= maxDeletes) break;
  } while (cursor !== undefined);

  return {
    prefix,
    cutoffMs,
    scanned,
    matched,
    deleted,
    dryRun,
    ...(cursor !== undefined ? { nextCursor: cursor } : {}),
  };
};
