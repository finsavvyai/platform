import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { useTheme } from '../../context';
import useOfflineManager from '../../hooks/useOfflineManager';

interface OfflineIndicatorProps {
  showDetails?: boolean;
  onSyncPress?: () => void;
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  showDetails = false,
  onSyncPress,
}) => {
  const { theme } = useTheme();
  const { status, syncNow } = useOfflineManager();
  const [slideAnim] = useState(new Animated.Value(-100));
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status) {
      const isOffline = !status.isOnline;
      const hasPendingOperations = status.sync.pendingOperationsCount > 0 || status.queue.pending > 0;

      if (isOffline || hasPendingOperations) {
        setVisible(true);
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      } else {
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setVisible(false));
      }
    }
  }, [status, slideAnim]);

  const handleSyncPress = async () => {
    if (onSyncPress) {
      onSyncPress();
    } else {
      await syncNow();
    }
  };

  if (!visible || !status) {
    return null;
  }

  const isOffline = !status.isOnline;
  const hasPendingOperations = status.sync.pendingOperationsCount > 0 || status.queue.pending > 0;

  const getIndicatorColor = () => {
    if (isOffline) return theme.colors.error;
    if (hasPendingOperations) return theme.colors.warning;
    return theme.colors.success;
  };

  const getIndicatorText = () => {
    if (isOffline) return 'Offline';
    if (status.sync.isSyncing) return 'Syncing...';
    if (hasPendingOperations) return `${status.sync.pendingOperationsCount} pending`;
    return 'Synced';
  };

  const getIndicatorIcon = () => {
    if (isOffline) return '📵';
    if (status.sync.isSyncing) return '🔄';
    if (hasPendingOperations) return '⏳';
    return '✅';
  };

  const styles = StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: getIndicatorColor(),
      zIndex: 1000,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    icon: {
      fontSize: 16,
      marginRight: theme.spacing.sm,
    },
    text: {
      fontSize: 14,
      fontWeight: '500',
      color: 'white',
      flex: 1,
    },
    syncButton: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: 4,
    },
    syncButtonText: {
      fontSize: 12,
      color: 'white',
      fontWeight: '500',
    },
    details: {
      backgroundColor: 'rgba(0, 0, 0, 0.1)',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    detailText: {
      fontSize: 12,
      color: 'white',
      opacity: 0.9,
    },
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={hasPendingOperations && !isOffline ? handleSyncPress : undefined}
        disabled={!hasPendingOperations || isOffline}
        activeOpacity={0.7}
      >
        <Text style={styles.icon}>{getIndicatorIcon()}</Text>
        <Text style={styles.text}>{getIndicatorText()}</Text>

        {hasPendingOperations && !isOffline && (
          <View style={styles.syncButton}>
            <Text style={styles.syncButtonText}>
              {status.sync.isSyncing ? 'Syncing' : 'Sync Now'}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {showDetails && (
        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Text style={styles.detailText}>Status:</Text>
            <Text style={styles.detailText}>{isOffline ? 'Offline' : 'Online'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailText}>Queue:</Text>
            <Text style={styles.detailText}>{status.queue.pending} pending</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailText}>Cache:</Text>
            <Text style={styles.detailText}>{Math.round(status.cache.totalSize / 1024)}KB</Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
};

export default OfflineIndicator;