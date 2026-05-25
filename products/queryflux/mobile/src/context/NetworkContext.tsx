import React, { createContext, useContext, useEffect, useState } from 'react';
import { NetInfoState, NetInfoStateType, useNetInfo } from '@react-native-netinfo/netinfo';
import { useAppStore } from '@store';

interface NetworkContextType {
  isConnected: boolean | null;
  connectionType: string;
  isInternetReachable: boolean | null;
  isOnline: boolean;
  showOfflineIndicator: boolean;
  lastConnectedTime: Date | null;
  retryCount: number;
  retryConnection: () => Promise<void>;
  clearRetryCount: () => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const netInfo = useNetInfo();
  const { setOnlineStatus, isOnline: storeOnline } = useAppStore();
  const [retryCount, setRetryCount] = useState(0);
  const [lastConnectedTime, setLastConnectedTime] = useState<Date | null>(null);

  // Determine if we're truly online
  const isOnline = Boolean(
    netInfo.isConnected &&
    netInfo.isInternetReachable &&
    netInfo.type !== NetInfoStateType.none
  );

  const showOfflineIndicator = !isOnline && storeOnline;

  // Update store and track connection time
  useEffect(() => {
    setOnlineStatus(
      isOnline,
      netInfo.type || 'unknown'
    );

    if (isOnline && !lastConnectedTime) {
      setLastConnectedTime(new Date());
    } else if (!isOnline) {
      setLastConnectedTime(null);
    }
  }, [isOnline, netInfo.type, setOnlineStatus, lastConnectedTime]);

  // Handle reconnection
  useEffect(() => {
    if (isOnline && retryCount > 0) {
      console.log(`Network restored after ${retryCount} retries`);
      setRetryCount(0);
    }
  }, [isOnline, retryCount]);

  const retryConnection = async () => {
    setRetryCount(prev => prev + 1);

    try {
      // Simulate a connection test
      await new Promise(resolve => setTimeout(resolve, 1000));

      // In a real app, you might ping your server here
      // const response = await fetch('https://api.queryflux.com/health');

      console.log(`Connection retry attempt ${retryCount + 1}`);
    } catch (error) {
      console.error('Connection retry failed:', error);
    }
  };

  const clearRetryCount = () => {
    setRetryCount(0);
  };

  const value: NetworkContextType = {
    isConnected: netInfo.isConnected,
    connectionType: netInfo.type || 'unknown',
    isInternetReachable: netInfo.isInternetReachable,
    isOnline,
    showOfflineIndicator,
    lastConnectedTime,
    retryCount,
    retryConnection,
    clearRetryCount,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};