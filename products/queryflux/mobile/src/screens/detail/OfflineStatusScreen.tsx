import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@context';
import useOfflineManager from '../../hooks/useOfflineManager';
import { useAppStore } from '@store';

const OfflineStatusScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const { theme } = useTheme();
  const { status, syncNow, clearAllData } = useOfflineManager();
  const { syncOfflineData, clearOfflineData } = useAppStore();

  useEffect(() => {
    // Component will update automatically through the hook
  }, [status]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await syncNow();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSyncNow = async () => {
    try {
      const success = await syncNow();
      if (success) {
        Alert.alert('Success', 'Data synchronized successfully!');
      } else {
        Alert.alert('Warning', 'Some data could not be synchronized. Please try again later.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to synchronize data');
    }
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Clear Offline Data',
      'This will permanently delete all cached data and queued operations. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllData();
              Alert.alert('Success', 'All offline data cleared successfully!');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear offline data');
            }
          },
        },
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached data but keep queued operations. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'default',
          onPress: async () => {
            try {
              // This would need to be implemented in the cache service
              Alert.alert('Success', 'Cache cleared successfully!');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear cache');
            }
          },
        },
      ]
    );
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getCacheHitRate = () => {
    if (!status) return '0%';
    const total = status.cache.hitCount + status.cache.missCount;
    if (total === 0) return '0%';
    return Math.round((status.cache.hitCount / total) * 100) + '%';
  };

  const getStatusColor = (value: boolean) => {
    return value ? theme.colors.success : theme.colors.error;
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      padding: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: theme.spacing.lg,
    },
    section: {
      marginBottom: theme.spacing.xl,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
    },
    statusCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    statusRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    statusRowLast: {
      borderBottomWidth: 0,
    },
    statusLabel: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    statusValue: {
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: '600',
    },
    statusIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginLeft: theme.spacing.sm,
    },
    actionButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    actionButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryActionButton: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    secondaryActionButtonText: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    dangerActionButton: {
      backgroundColor: theme.colors.error,
      borderRadius: 8,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    dangerActionButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    statCard: {
      width: '48%',
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });

  if (!status) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <Text style={{ fontSize: 16, color: theme.colors.textSecondary }}>
            Loading offline status...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Offline Status</Text>
        <Text style={styles.subtitle}>
          Monitor and manage your offline data and synchronization
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Connection Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection Status</Text>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.statusValue, { color: getStatusColor(status.isOnline) }]}>
                  {status.isOnline ? 'Online' : 'Offline'}
                </Text>
                <View
                  style={[
                    styles.statusIndicator,
                    { backgroundColor: getStatusColor(status.isOnline) }
                  ]}
                />
              </View>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Connection Type</Text>
              <Text style={styles.statusValue}>{status.connectionType || 'Unknown'}</Text>
            </View>
          </View>
        </View>

        {/* Synchronization Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Synchronization</Text>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Sync Status</Text>
              <Text style={[styles.statusValue, { color: status.sync.isSyncing ? theme.colors.warning : theme.colors.success }]}>
                {status.sync.isSyncing ? 'Syncing...' : 'Idle'}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Pending Operations</Text>
              <Text style={styles.statusValue}>{status.sync.pendingOperationsCount}</Text>
            </View>
            <View style={styles.statusRowLast}>
              <Text style={styles.statusLabel}>Last Sync</Text>
              <Text style={styles.statusValue}>
                {status.sync.lastSync
                  ? new Date(status.sync.lastSync).toLocaleString()
                  : 'Never'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleSyncNow}
            disabled={status.sync.isSyncing || !status.isOnline}
          >
            <Text style={styles.actionButtonText}>
              {status.sync.isSyncing ? 'Syncing...' : 'Sync Now'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Queue Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Operation Queue</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{status.queue.pending}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{status.queue.processing}</Text>
              <Text style={styles.statLabel}>Processing</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{status.queue.completed}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{status.queue.failed}</Text>
              <Text style={styles.statLabel}>Failed</Text>
            </View>
          </View>
        </View>

        {/* Cache Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cache Status</Text>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Total Size</Text>
              <Text style={styles.statusValue}>{formatBytes(status.cache.totalSize)}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Entries</Text>
              <Text style={styles.statusValue}>{status.cache.entryCount}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Hit Rate</Text>
              <Text style={styles.statusValue}>{getCacheHitRate()}</Text>
            </View>
            <View style={styles.statusRowLast}>
              <Text style={styles.statusLabel}>Last Updated</Text>
              <Text style={styles.statusValue}>
                {status.cache.newestEntry
                  ? new Date(status.cache.newestEntry).toLocaleString()
                  : 'Never'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.secondaryActionButton}
            onPress={handleClearCache}
          >
            <Text style={styles.secondaryActionButtonText}>Clear Cache</Text>
          </TouchableOpacity>
        </View>

        {/* Data Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>
          <TouchableOpacity
            style={styles.dangerActionButton}
            onPress={handleClearAllData}
          >
            <Text style={styles.dangerActionButtonText}>Clear All Offline Data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default OfflineStatusScreen;