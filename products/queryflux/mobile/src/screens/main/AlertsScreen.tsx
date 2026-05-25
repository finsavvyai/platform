import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@context';
import { useNotifications } from '@context';
import { useNetwork } from '@context';
import { useAppStore } from '@store';
import { AlertData } from '@types';

interface AlertItemProps {
  alert: AlertData;
  onPress: (alert: AlertData) => void;
  onAcknowledge: (alert: AlertData) => void;
  onResolve: (alert: AlertData) => void;
  onDelete: (alert: AlertData) => void;
}

const AlertItem: React.FC<AlertItemProps> = ({
  alert,
  onPress,
  onAcknowledge,
  onResolve,
  onDelete,
}) => {
  const { theme } = useTheme();

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return theme.colors.error;
      case 'warning':
        return theme.colors.warning;
      case 'info':
        return theme.colors.info;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '🚨';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📢';
    }
  };

  const getStatusBadge = () => {
    if (alert.resolved) {
      return { text: 'Resolved', color: theme.colors.success };
    } else if (alert.acknowledged) {
      return { text: 'Acknowledged', color: theme.colors.info };
    } else {
      return { text: 'Active', color: getSeverityColor(alert.severity) };
    }
  };

  const statusBadge = getStatusBadge();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      opacity: alert.resolved ? 0.6 : 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    severityIcon: {
      fontSize: 20,
      marginRight: theme.spacing.sm,
    },
    titleContainer: {
      flex: 1,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 2,
    },
    timestamp: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    statusContainer: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      backgroundColor: `${statusBadge.color}20`,
      borderRadius: 12,
    },
    statusText: {
      fontSize: 12,
      color: statusBadge.color,
      fontWeight: '500',
    },
    message: {
      fontSize: 14,
      color: theme.colors.text,
      lineHeight: 20,
      marginBottom: theme.spacing.md,
    },
    details: {
      backgroundColor: theme.colors.background,
      borderRadius: 8,
      padding: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    detailLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    detailValue: {
      fontSize: 12,
      color: theme.colors.text,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    leftActions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    rightActions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    actionButton: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: 6,
    },
    actionButtonPrimary: {
      backgroundColor: theme.colors.primary,
    },
    actionButtonSecondary: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    actionButtonDanger: {
      backgroundColor: theme.colors.error,
    },
    actionText: {
      fontSize: 12,
      fontWeight: '500',
    },
    actionTextPrimary: {
      color: 'white',
    },
    actionTextSecondary: {
      color: theme.colors.text,
    },
    actionTextDanger: {
      color: 'white',
    },
  });

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(alert)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={styles.severityIcon}>{getSeverityIcon(alert.severity)}</Text>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{alert.title}</Text>
          <Text style={styles.timestamp}>
            {new Date(alert.createdAt).toLocaleString()}
          </Text>
        </View>
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>{statusBadge.text}</Text>
        </View>
      </View>

      <Text style={styles.message}>{alert.message}</Text>

      {alert.metadata && Object.keys(alert.metadata).length > 0 && (
        <View style={styles.details}>
          {Object.entries(alert.metadata).map(([key, value]) => (
            <View key={key} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{key}:</Text>
              <Text style={styles.detailValue}>{String(value)}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <View style={styles.leftActions}>
          {!alert.acknowledged && !alert.resolved && (
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPrimary]}
              onPress={(e) => {
                e.stopPropagation();
                onAcknowledge(alert);
              }}
            >
              <Text style={[styles.actionText, styles.actionTextPrimary]}>
                Acknowledge
              </Text>
            </TouchableOpacity>
          )}
          {!alert.resolved && (
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSecondary]}
              onPress={(e) => {
                e.stopPropagation();
                onResolve(alert);
              }}
            >
              <Text style={[styles.actionText, styles.actionTextSecondary]}>
                Resolve
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.rightActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonDanger]}
            onPress={(e) => {
              e.stopPropagation();
              onDelete(alert);
            }}
          >
            <Text style={[styles.actionText, styles.actionTextDanger]}>
              Delete
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const AlertsScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [filteredAlerts, setFilteredAlerts] = useState<AlertData[]>([]);
  const { theme } = useTheme();
  const { isOnline } = useNetwork();
  const { scheduleLocalNotification } = useNotifications();
  const {
    alerts,
    addAlert,
    acknowledgeAlert,
    resolveAlert,
    dismissAlert,
    user,
  } = useAppStore();

  useEffect(() => {
    filterAlerts();
  }, [alerts, showActiveOnly]);

  const filterAlerts = () => {
    let filtered = alerts;

    if (showActiveOnly) {
      filtered = filtered.filter(alert => !alert.resolved);
    }

    // Sort by severity and creation time
    filtered.sort((a, b) => {
      const severityOrder = { critical: 3, warning: 2, info: 1 };
      const aSeverity = severityOrder[a.severity as keyof typeof severityOrder] || 0;
      const bSeverity = severityOrder[b.severity as keyof typeof severityOrder] || 0;

      if (aSeverity !== bSeverity) {
        return bSeverity - aSeverity;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    setFilteredAlerts(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Simulate refreshing alerts
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAlertPress = (alert: AlertData) => {
    // Navigate to alert detail
    console.log('Navigate to alert detail:', alert.id);
  };

  const handleAcknowledgeAlert = (alert: AlertData) => {
    acknowledgeAlert(alert.id);

    scheduleLocalNotification({
      title: 'Alert Acknowledged',
      message: `"${alert.title}" has been acknowledged by ${user?.name || 'User'}`,
      type: 'info',
    });
  };

  const handleResolveAlert = (alert: AlertData) => {
    resolveAlert(alert.id);

    scheduleLocalNotification({
      title: 'Alert Resolved',
      message: `"${alert.title}" has been resolved`,
      type: 'info',
    });
  };

  const handleDeleteAlert = (alert: AlertData) => {
    Alert.alert(
      'Delete Alert',
      'Are you sure you want to delete this alert?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            dismissAlert(alert.id);
          },
        },
      ]
    );
  };

  const handleCreateTestAlert = () => {
    const testAlert: AlertData = {
      id: Date.now().toString(),
      title: 'Test Alert',
      message: 'This is a test alert created for demonstration purposes.',
      severity: 'warning',
      acknowledged: false,
      resolved: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      connectionId: 'test-connection',
      connectionName: 'Test Database',
      metadata: {
        source: 'manual',
        createdBy: user?.name || 'User',
      },
    };

    addAlert(testAlert);
  };

  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.resolved).length;
  const activeCount = alerts.filter(a => !a.resolved).length;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    titleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    badge: {
      backgroundColor: theme.colors.error,
      borderRadius: 10,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: 2,
      marginLeft: theme.spacing.sm,
    },
    badgeText: {
      color: 'white',
      fontSize: 12,
      fontWeight: 'bold',
    },
    testButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: 6,
    },
    testButtonText: {
      color: 'white',
      fontSize: 12,
      fontWeight: '500',
    },
    statsContainer: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: theme.spacing.md,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    filterContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    filterLabel: {
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: '500',
    },
    content: {
      flex: 1,
      paddingHorizontal: theme.spacing.lg,
    },
    listContainer: {
      paddingBottom: theme.spacing.lg,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.xxl,
    },
    emptyIcon: {
      fontSize: 64,
      marginBottom: theme.spacing.lg,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: theme.spacing.lg,
    },
    offlineIndicator: {
      backgroundColor: theme.colors.warning + '20',
      borderColor: theme.colors.warning,
      borderWidth: 1,
      borderRadius: 8,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    offlineText: {
      color: theme.colors.warning,
      textAlign: 'center',
      fontSize: 14,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Alerts</Text>
            {criticalCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{criticalCount}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.testButton}
            onPress={handleCreateTestAlert}
          >
            <Text style={styles.testButtonText}>Test Alert</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{activeCount}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{criticalCount}</Text>
            <Text style={styles.statLabel}>Critical</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {alerts.filter(a => a.acknowledged && !a.resolved).length}
            </Text>
            <Text style={styles.statLabel}>Acknowledged</Text>
          </View>
        </View>

        <View style={styles.filterContainer}>
          <Text style={styles.filterLabel}>Active alerts only</Text>
          <Switch
            value={showActiveOnly}
            onValueChange={setShowActiveOnly}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          />
        </View>

        {!isOnline && (
          <View style={styles.offlineIndicator}>
            <Text style={styles.offlineText}>
              You're offline. Alert status may not be current.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        {filteredAlerts.length > 0 ? (
          <FlatList
            data={filteredAlerts}
            renderItem={({ item }) => (
              <AlertItem
                alert={item}
                onPress={handleAlertPress}
                onAcknowledge={handleAcknowledgeAlert}
                onResolve={handleResolveAlert}
                onDelete={handleDeleteAlert}
              />
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.primary}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>
              {showActiveOnly ? 'No active alerts' : 'No alerts found'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {showActiveOnly
                ? 'Great! All alerts have been resolved or there are no current issues.'
                : 'No alerts found. Create a test alert to see how the system works.'}
            </Text>
            <TouchableOpacity
              style={styles.testButton}
              onPress={handleCreateTestAlert}
            >
              <Text style={styles.testButtonText}>Create Test Alert</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

export default AlertsScreen;