import { useState, useEffect, useCallback } from 'react';
import { auditApi } from '../api/audit';
import type { AuditEntry } from '../types';

export function useAudit() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await auditApi.list();
      const data = resp as { entries?: AuditEntry[] };
      setEntries(data?.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  return { entries, loading, error, refetch: fetchAudit };
}
