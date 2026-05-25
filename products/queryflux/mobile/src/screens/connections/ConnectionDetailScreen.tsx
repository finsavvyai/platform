/**
 * Connection detail screen showing detailed information about a database connection
 */

import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import {RouteProp, useRoute} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import {useDatabase} from '../../contexts/DatabaseContext';
import {theme} from '../../styles/theme';
import {RootStackParamList} from '../../navigation/AppNavigator';

type ConnectionDetailRouteProp = RouteProp<RootStackParamList, 'ConnectionDetail'>;

const ConnectionDetailScreen: React.FC = () => {
  const route = useRoute<ConnectionDetailRouteProp>();
  const {connectionId} = route.params;
  const {connections, refreshConnection} = useDatabase();
  const [refreshing, setRefreshing] = useState(false);

  const connection = connections.find(c => c.id === connectionId);

  useEffect(() => {
    if (connection) {
      refreshConnection(connectionId);
    }
  }, [connectionId, refreshConnection]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshConnection(connectionId);
    setRefreshing(false);
  };

  if (!connection) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error" size={48} color={theme.colors.error} />
        <Text style={styles.errorText}>Connection not found</Text>
      </View>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return theme.colors.success;
      case 'connecting':
        return theme.colors.warning;
      case 'error':
        return theme.colors.error;
      default:
        return theme.colors.gray;
    }
  };

  const renderInfoSection = (title: string, items: Array<{label: string; value: string}>) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, index) => (
        <View key={index} style={styles.infoRow}>
          <Text style={styles.infoLabel}>{item.label}</Text>
          <Text style={styles.infoValue}>{item.value}</Text>
        </View>
      ))}
    </View>
  );

  const renderMetricsSection = () => {
    if (!connection.metrics) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Performance Metrics</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Icon name="memory" size={24} color={theme.colors.primary} />
            <Text style={styles.metricValue}>{connection.metrics.cpu}%</Text>
            <Text style={styles.metricLabel}>CPU Usage</Text>
          </View>
          <View style={styles.metricCard}>
            <Icon name="storage" size={24} color={theme.colors.primary} />
            <Text style={styles.metricValue}>{connection.metrics.memory}%</Text>
            <Text style={styles.metricLabel}>Memory</Text>
          </View>
          <View style={styles.metricCard}>
            <Icon name="link" size={24} color={theme.colors.primary} />
            <Text style={styles.metricValue}>{connection.metrics.connections}</Text>
            <Text style={styles.metricLabel}>Connections</Text>
          </View>
          <View style={styles.metricCard}>
            <Icon name="query_stats" size={24} color={theme.colors.primary} />
            <Text style={styles.metricValue}>{connection.metrics.queries}</Text>
            <Text style={styles.metricLabel}>Queries/sec</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }>
      {/* Status Header */}
      <View style={styles.statusHeader}>
        <View style={styles.statusInfo}>
          <Text style={styles.connectionName}>{connection.name}</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                {backgroundColor: getStatusColor(connection.status)},
              ]}
            />
            <Text style={[styles.statusText, {color: getStatusColor(connection.status)}]}>
              {connection.status.toUpperCase()}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Icon name="refresh" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Connection Information */}
      {renderInfoSection('Connection Details', [
        {label: 'Type', value: connection.type.toUpperCase()},
        {label: 'Host', value: connection.host},
        {label: 'Port', value: connection.port.toString()},
        ...(connection.database ? [{label: 'Database', value: connection.database}] : []),
        ...(connection.username ? [{label: 'Username', value: connection.username}] : []),
        ...(connection.lastConnected ? [{label: 'Last Connected', value: new Date(connection.lastConnected).toLocaleString()}] : []),
      ])}

      {/* Performance Metrics */}
      {renderMetricsSection()}

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <TouchableOpacity style={styles.actionButton}>
          <Icon name="code" size={20} color={theme.colors.primary} />
          <Text style={styles.actionButtonText}>Run Query</Text>
          <Icon name="chevron_right" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Icon name="table_view" size={20} color={theme.colors.primary} />
          <Text style={styles.actionButtonText}>Browse Tables</Text>
          <Icon name="chevron_right" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Icon name="analytics" size={20} color={theme.colors.primary} />
          <Text style={styles.actionButtonText}>View Analytics</Text>
          <Icon name="chevron_right" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  errorText: {
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.error,
    marginTop: theme.spacing.md,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  statusInfo: {
    flex: 1,
  },
  connectionName: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: theme.spacing.sm,
  },
  statusText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  refreshButton: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.lightGray,
  },
  section: {
    backgroundColor: theme.colors.white,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.sm,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.separator,
  },
  infoLabel: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  infoValue: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text,
    fontWeight: theme.typography.fontWeight.medium,
    flex: 2,
    textAlign: 'right',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '48%',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.lightGray,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  metricValue: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
  },
  metricLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.separator,
  },
  actionButtonText: {
    flex: 1,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text,
    marginLeft: theme.spacing.md,
  },
});

export default ConnectionDetailScreen;