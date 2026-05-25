// Main store index file
export { useUIStore } from './uiStore';
export { useConnectionStore } from './connectionStore';
export { useQueryStore } from './queryStore';
export { useAIStore } from './aiStore';
export { useMonitoringStore } from './monitoringStore';

// Export types
export type {
  AppState,
  AppActions,
  UserPreferences,
  DatabaseConnection,
  ActiveConnection,
  Query,
  QueryHistory,
  QueryResult,
  AIConversation,
  AISuggestion,
  DatabaseMetrics,
  Alert,
  UpdateInfo,
  DatabaseType,
  SSHTunnelConfig,
  ConnectionMetrics,
  ColumnInfo,
  RowData,
  AIMessage,
  AIAttachment,
  StorageUsage,
} from './types';

// Export slice types
export type {
  ConnectionSlice,
  QuerySlice,
  AISlice,
  UISlice,
  MonitoringSlice,
} from './types';

// Combined store hook for convenience
export const useAppStore = () => {
  const uiStore = useUIStore();
  const connectionStore = useConnectionStore();
  const queryStore = useQueryStore();
  const aiStore = useAIStore();
  const monitoringStore = useMonitoringStore();

  return {
    ...uiStore,
    ...connectionStore,
    ...queryStore,
    ...aiStore,
    ...monitoringStore,
    // Additional convenience methods for cross-store operations
    initializeApp: async () => {
      // Initialize all stores
      console.log('Initializing app stores...');
    },
    resetState: () => {
      // Reset all stores to initial state
      console.log('Resetting all stores...');
    },
  };
};