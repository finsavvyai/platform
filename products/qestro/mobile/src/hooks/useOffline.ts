import { useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useUIStore } from '../stores/uiStore';
import { replayQueue } from '../lib/offlineQueue';

export function useOffline() {
  const isOffline = useUIStore((s) => s.isOffline);
  const setOffline = useUIStore((s) => s.setIsOffline);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOffline(!state.isConnected);
    });
    NetInfo.fetch().then((state) => setOffline(!state.isConnected));
    return () => unsubscribe();
  }, [setOffline]);

  const replay = useCallback(async () => {
    if (isOffline) return { success: 0, failed: 0 };
    return replayQueue();
  }, [isOffline]);

  return { isOffline, replay };
}
