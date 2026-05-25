import { useState, useEffect, useCallback } from 'react';
import { listsApi, ListMeta } from '../api/lists';

export function useLists() {
  const [lists, setLists] = useState<ListMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchLists = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await listsApi.list();
      setLists(resp.lists || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const triggerSync = useCallback(
    async (listId: string) => {
      await listsApi.sync(listId);
      await fetchLists();
    },
    [fetchLists],
  );

  return { lists, loading, error, refetch: fetchLists, triggerSync };
}
