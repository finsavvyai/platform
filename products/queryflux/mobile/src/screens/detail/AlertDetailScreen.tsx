import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@context';
import { useNotifications } from '@context';
import { useAppStore } from '@store';
import { AlertData } from '@types';

const AlertDetailScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [alertHistory, setAlertHistory] = useState<AlertData[]>([]);

  const { theme } = useTheme();
  const { scheduleLocalNotification } = useNotifications();
  const {
    selectedAlert,
    alerts,
    acknowledgeAlert,
    resolveAlert,
    dismissAlert,
    user,
  } = useAppStore();

  useEffect(() => {
    if (selectedAlert) {
      loadAlertHistory();
    }
  }, [selectedAlert]);

  const loadAlertHistory = async () => {
    try {
      // Simulate loading alert history
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock related alerts
      const relatedAlerts = alerts.filter(alert =>
        alert.connectionId === selectedAlert?.connectionId ||
        alert.title === selectedAlert?.title
      );

      setAlertHistory(relatedAlerts.slice(0, 10));
    } catch (error) {
      console.error('Failed to load alert history:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadAlertHistory();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAcknowledge = () => {
    if (!selectedAlert) return;

    acknowledgeAlert(selectedAlert.id);

    scheduleLocalNotification({
      title: 'Alert Acknowledged',
      message: `"${selectedAlert.title}" has been acknowledged by ${user?.name || 'User'}`,
      type: 'info',
    });

    Alert.alert('Success', 'Alert has been acknowledged.');
  };

  const handleResolve = () => {
    if (!selectedAlert) return;

    Alert.alert(
      'Resolve Alert',
      'Has the issue been resolved?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          style: 'default',
          onPress: () => {
            resolveAlert(selectedAlert.id);

            scheduleLocalNotification({
              title: 'Alert Resolved',
              message: `"${selectedAlert.title}" has been resolved`,
              type: 'info',
            });

            Alert.alert('Success', 'Alert has been resolved.');
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    if (!selectedAlert) return;

    Alert.alert(
      'Delete Alert',
      'Are you sure you want to delete this alert?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            dismissAlert(selectedAlert.id);
            // Navigate back or update UI
          },
        },
      ]
    );
  };

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
    if (!selectedAlert) return null;

    if (selectedAlert.resolved) {
      return { text: 'Resolved', color: theme.colors.success, icon: '✅' };
    } else if (selectedAlert.acknowledged) {
      return { text: 'Acknowledged', color: theme.colors.info, icon: '👁️' };
    } else {
      return { text: 'Active', color: getSeverityColor(selectedAlert.severity), icon: getSeverityIcon(selectedAlert.severity) };
    }
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
    alertCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: theme.spacing.lg,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    alertHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    severityIcon: {
      fontSize: 24,
      marginRight: theme.spacing.sm,
    },
    alertTitleContainer: {
      flex: 1,
    },
    alertTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 4,
    },
    alertTimestamp: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      backgroundColor: `${getStatusBadge()?.color}20`,
      borderRadius: 12,
    },
    statusIcon: {
      fontSize: 14,
      marginRight: theme.spacing.xs,
    },
    statusText: {
      fontSize: 12,
      color: getStatusBadge()?.color,
      fontWeight: '600',
    },
    alertMessage: {
      fontSize: 16,
      color: theme.colors.text,
      lineHeight: 24,
      marginBottom: theme.spacing.lg,
    },
    detailsContainer: {
      backgroundColor: theme.colors.background,
      borderRadius: 8,
      padding: theme.spacing.md,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    detailRowLast: {
      borderBottomWidth: 0,
    },
    detailLabel: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    detailValue: {
      fontSize: 14,
      color: theme.colors.text,
      flex: 1,
      textAlign: 'right',
    },
    actions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.lg,
    },
    actionButton: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      borderRadius: 8,
      alignItems: 'center',
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
    actionButtonText: {
      fontSize: 14,
      fontWeight: '600',
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
    historyItem: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
    },
    historyIcon: {
      fontSize: 16,
      marginRight: theme.spacing.sm,
    },
    historyContent: {
      flex: 1,
    },
    historyTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text,
      marginBottom: 2,
    },
    historyTimestamp: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    historyStatus: {
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: theme.colors.background,
    },
    historyStatusText: {
      fontSize: 10,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.xl,
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
  });

  if (!selectedAlert) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No alert selected</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusBadge = getStatusBadge();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <Text style={styles.severityIcon}>
              {getSeverityIcon(selectedAlert.severity)}
            </Text>
            <View style={styles.alertTitleContainer}>
              <Text style={styles.alertTitle}>{selectedAlert.title}</Text>
              <Text style={styles.alertTimestamp}>
                {new Date(selectedAlert.createdAt).toLocaleString()}
              </Text>
            </View>
            {statusBadge && (
              <View style={styles.statusBadge}>
                <Text style={styles.statusIcon}>{statusBadge.icon}</Text>
                <Text style={styles.statusText}>{statusBadge.text}</Text>
              </View>
            )}
          </View>

          <Text style={styles.alertMessage}>{selectedAlert.message}</Text>

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Severity</Text>
              <Text style={[styles.detailValue, { color: getSeverityColor(selectedAlert.severity) }]}>
                {selectedAlert.severity.toUpperCase()}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Connection</Text>
              <Text style={styles.detailValue}>{selectedAlert.connectionName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Created</Text>
              <Text style={styles.detailValue}>
                {new Date(selectedAlert.createdAt).toLocaleString()}
              </Text>
            </View>
            {selectedAlert.acknowledgedAt && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Acknowledged</Text>
                <Text style={styles.detailValue}>
                  {new Date(selectedAlert.acknowledgedAt).toLocaleString()}
                </Text>
              </View>
            )}
            {selectedAlert.resolvedAt && (
              <View style={[styles.detailRow, styles.detailRowLast]}>
                <Text style={styles.detailLabel}>Resolved</Text>
                <Text style={styles.detailValue}>
                  {new Date(selectedAlert.resolvedAt).toLocaleString()}
                </Text>
              </View>
            )}
          </View>

          {!selectedAlert.resolved && (
            <View style={styles.actions}>
              {!selectedAlert.acknowledged && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonPrimary]}
                  onPress={handleAcknowledge}
                >
                  <Text style={[styles.actionButtonText, styles.actionTextPrimary]}>
                    Acknowledge
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonSecondary]}
                onPress={handleResolve}
              >
                <Text style={[styles.actionButtonText, styles.actionTextSecondary]}>
                  Resolve
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonDanger]}
                onPress={handleDelete}
              >
                <Text style={[styles.actionButtonText, styles.actionTextDanger]}>
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
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
        {/* Alert History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Related Alerts</Text>
          {alertHistory.length > 0 ? (
            alertHistory.map((alert) => (
              <View key={alert.id} style={styles.historyItem}>
                <Text style={styles.historyIcon}>
                  {getSeverityIcon(alert.severity)}
                </Text>
                <View style={styles.historyContent}>
                  <Text style={styles.historyTitle}>{alert.title}</Text>
                  <Text style={styles.historyTimestamp}>
                    {new Date(alert.createdAt).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.historyStatus}>
                  <Text style={styles.historyStatusText}>
                    {alert.resolved ? 'Resolved' : alert.acknowledged ? 'Acknowledged' : 'Active'}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No related alerts found</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AlertDetailScreen;