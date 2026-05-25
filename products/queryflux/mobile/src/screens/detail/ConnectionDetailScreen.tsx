import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@context';
import { useNetwork } from '@context';
import { useAppStore } from '@store';

const ConnectionDetailScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [connectionHealth, setConnectionHealth] = useState<{
    status: 'healthy' | 'warning' | 'error';
    responseTime: number;
    uptime: string;
    lastCheck: string;
  } | null>(null);

  const { theme } = useTheme();
  const { isOnline } = useNetwork();
  const {
    selectedConnection,
    connections,
    metrics,
    setSelectedConnection,
  } = useAppStore();

  useEffect(() => {
    if (selectedConnection) {
      loadConnectionDetails();
    }
  }, [selectedConnection]);

  const loadConnectionDetails = async () => {
    try {
      // Simulate loading connection health data
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock connection health data
      setConnectionHealth({
        status: 'healthy',
        responseTime: Math.floor(Math.random() * 100) + 10,
        uptime: '99.9%',
        lastCheck: new Date().toLocaleString(),
      });
    } catch (error) {
      console.error('Failed to load connection details:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadConnectionDetails();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleEditConnection = () => {
    // Navigate to edit connection screen
    console.log('Navigate to edit connection');
  };

  const handleDeleteConnection = () => {
    if (!selectedConnection) return;

    Alert.alert(
      'Delete Connection',
      `Are you sure you want to delete "${selectedConnection.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Remove connection and navigate back
            console.log('Connection deleted:', selectedConnection.id);
            setSelectedConnection(null);
          },
        },
      ]
    );
  };

  const handleTestConnection = async () => {
    try {
      // Simulate testing connection
      await new Promise(resolve => setTimeout(resolve, 2000));

      Alert.alert(
        'Connection Test',
        'Connection successful! All tests passed.',
        [{ text: 'OK', style: 'default' }]
      );
    } catch (error) {
      Alert.alert(
        'Connection Test Failed',
        'Unable to connect to the database. Please check your connection settings.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return theme.colors.success;
      case 'warning':
        return theme.colors.warning;
      case 'error':
        return theme.colors.error;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return '❓';
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
    headerContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    headerLeft: {
      flex: 1,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 2,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    actions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    actionButton: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
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
    actionButtonText: {
      fontSize: 14,
      fontWeight: '500',
    },
    actionTextPrimary: {
      color: 'white',
    },
    actionTextSecondary: {
      color: theme.colors.text,
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
    card: {
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
    healthCard: {
      borderLeftWidth: 4,
      borderLeftColor: connectionHealth ? getStatusColor(connectionHealth.status) : theme.colors.textSecondary,
    },
    healthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    healthIcon: {
      fontSize: 24,
      marginRight: theme.spacing.sm,
    },
    healthTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    healthStatus: {
      fontSize: 14,
      color: connectionHealth ? getStatusColor(connectionHealth.status) : theme.colors.textSecondary,
      fontWeight: '500',
    },
    healthMetrics: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    metric: {
      alignItems: 'center',
    },
    metricValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 2,
    },
    metricLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    infoRowLast: {
      borderBottomWidth: 0,
    },
    infoLabel: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    infoValue: {
      fontSize: 14,
      color: theme.colors.text,
      textAlign: 'right',
      flex: 1,
    },
    chartContainer: {
      height: 200,
      backgroundColor: theme.colors.background,
      borderRadius: 8,
      padding: theme.spacing.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    chartPlaceholder: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.xxl,
    },
    emptyText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
  });

  if (!selectedConnection) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No connection selected</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>{selectedConnection.name}</Text>
            <Text style={styles.subtitle}>{selectedConnection.type}</Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSecondary]}
              onPress={handleTestConnection}
            >
              <Text style={[styles.actionButtonText, styles.actionTextSecondary]}>Test</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPrimary]}
              onPress={handleEditConnection}
            >
              <Text style={[styles.actionButtonText, styles.actionTextPrimary]}>Edit</Text>
            </TouchableOpacity>
          </View>
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
        {/* Connection Health */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection Health</Text>
          <View style={[styles.card, styles.healthCard]}>
            <View style={styles.healthHeader}>
              <Text style={styles.healthIcon}>
                {connectionHealth ? getStatusIcon(connectionHealth.status) : '📊'}
              </Text>
              <View style={styles.healthTitle}>
                <Text style={styles.healthTitle}>System Status</Text>
                <Text style={styles.healthStatus}>
                  {connectionHealth?.status || 'Unknown'}
                </Text>
              </View>
            </View>

            {connectionHealth && (
              <View style={styles.healthMetrics}>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>{connectionHealth.responseTime}ms</Text>
                  <Text style={styles.metricLabel}>Response Time</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>{connectionHealth.uptime}</Text>
                  <Text style={styles.metricLabel}>Uptime</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>
                    {Math.floor(Math.random() * 100) + 1}
                  </Text>
                  <Text style={styles.metricLabel}>Queries/sec</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Connection Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection Information</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Database Type</Text>
              <Text style={styles.infoValue}>{selectedConnection.type}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Host</Text>
              <Text style={styles.infoValue}>{selectedConnection.host}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Port</Text>
              <Text style={styles.infoValue}>{selectedConnection.port}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Database</Text>
              <Text style={styles.infoValue}>{selectedConnection.database || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Username</Text>
              <Text style={styles.infoValue}>{selectedConnection.username || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={[styles.infoValue, { color: getStatusColor(selectedConnection.status) }]}>
                {selectedConnection.status}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Created</Text>
              <Text style={styles.infoValue}>
                {new Date(selectedConnection.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <View style={[styles.infoRow, styles.infoRowLast]}>
              <Text style={styles.infoLabel}>Last Updated</Text>
              <Text style={styles.infoValue}>
                {new Date(selectedConnection.updatedAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Performance Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance Metrics</Text>
          <View style={styles.card}>
            <View style={styles.chartContainer}>
              <Text style={styles.chartPlaceholder}>📊 Performance Chart</Text>
              <Text style={[styles.chartPlaceholder, { fontSize: 14 }]}>
                Performance visualization will appear here
              </Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary, { width: '100%' }]}
            onPress={handleTestConnection}
          >
            <Text style={[styles.actionButtonText, styles.actionTextSecondary]}>
              Test Connection
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.actionButtonPrimary,
              { width: '100%', marginTop: theme.spacing.md }
            ]}
            onPress={handleEditConnection}
          >
            <Text style={[styles.actionButtonText, styles.actionTextPrimary]}>
              Edit Connection
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.actionButtonSecondary,
              { width: '100%', marginTop: theme.spacing.md, borderColor: theme.colors.error }
            ]}
            onPress={handleDeleteConnection}
          >
            <Text style={[styles.actionButtonText, { color: theme.colors.error }]}>
              Delete Connection
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ConnectionDetailScreen;