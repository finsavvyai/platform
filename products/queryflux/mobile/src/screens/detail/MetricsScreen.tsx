import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@context';
import { useNetwork } from '@context';
import { useAppStore } from '@store';

const { width } = Dimensions.get('window');

interface MetricCard {
  title: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: string;
  color: string;
}

const MetricsScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

  const { theme } = useTheme();
  const { isOnline } = useNetwork();
  const { connections, metrics: storeMetrics } = useAppStore();

  useEffect(() => {
    loadMetrics();
  }, [selectedTimeRange, connections, storeMetrics]);

  const loadMetrics = async () => {
    try {
      // Simulate loading metrics
      await new Promise(resolve => setTimeout(resolve, 1000));

      const activeConnections = connections.filter(c => c.status === 'connected').length;
      const totalQueries = storeMetrics.filter(m => m.metricType === 'query_count').length;
      const avgResponseTime = Math.floor(Math.random() * 100) + 50;
      const totalBytes = Math.floor(Math.random() * 1000000) + 100000;

      const newMetrics: MetricCard[] = [
        {
          title: 'Active Connections',
          value: activeConnections.toString(),
          change: '+2',
          trend: 'up',
          icon: '🔗',
          color: theme.colors.success,
        },
        {
          title: 'Query Rate',
          value: `${(totalQueries / 100).toFixed(1)}/s`,
          change: '+12%',
          trend: 'up',
          icon: '⚡',
          color: theme.colors.primary,
        },
        {
          title: 'Avg Response Time',
          value: `${avgResponseTime}ms`,
          change: '-5ms',
          trend: 'down',
          icon: '⏱️',
          color: theme.colors.warning,
        },
        {
          title: 'Data Transfer',
          value: `${(totalBytes / 1024 / 1024).toFixed(1)}MB`,
          change: '+2.1MB',
          trend: 'up',
          icon: '📊',
          color: theme.colors.info,
        },
        {
          title: 'Error Rate',
          value: '0.2%',
          change: '-0.1%',
          trend: 'down',
          icon: '📉',
          color: theme.colors.success,
        },
        {
          title: 'System Health',
          value: '98%',
          change: 'Stable',
          trend: 'neutral',
          icon: '💚',
          color: theme.colors.success,
        },
      ];

      setMetrics(newMetrics);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadMetrics();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const getTrendColor = (trend?: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return theme.colors.success;
      case 'down':
        return theme.colors.error;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getTrendIcon = (trend?: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      default:
        return '→';
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
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    timeRangeSelector: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: 4,
    },
    timeRangeOption: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: 6,
    },
    timeRangeOptionActive: {
      backgroundColor: theme.colors.primary,
    },
    timeRangeText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    timeRangeTextActive: {
      color: 'white',
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: theme.spacing.lg,
    },
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.xl,
    },
    metricCard: {
      width: (width - theme.spacing.lg * 2 - theme.spacing.md) / 2,
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
    metricCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    metricIcon: {
      fontSize: 20,
      marginRight: theme.spacing.sm,
    },
    metricTitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      flex: 1,
    },
    metricValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    metricChange: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    metricChangeText: {
      fontSize: 12,
      marginLeft: 2,
    },
    chartSection: {
      marginBottom: theme.spacing.xl,
    },
    chartTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
    },
    chartContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: theme.spacing.lg,
      height: 200,
      justifyContent: 'center',
      alignItems: 'center',
    },
    chartPlaceholder: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.sm,
    },
    chartSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    connectionsList: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      overflow: 'hidden',
    },
    connectionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    connectionItemLast: {
      borderBottomWidth: 0,
    },
    connectionIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.spacing.md,
    },
    connectionIconText: {
      fontSize: 16,
    },
    connectionInfo: {
      flex: 1,
    },
    connectionName: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text,
      marginBottom: 2,
    },
    connectionType: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    connectionStatus: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.success,
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
        <View style={styles.headerContent}>
          <Text style={styles.title}>Performance Metrics</Text>
          <View style={styles.timeRangeSelector}>
            {['1h', '24h', '7d', '30d'].map((range) => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.timeRangeOption,
                  selectedTimeRange === range && styles.timeRangeOptionActive
                ]}
                onPress={() => setSelectedTimeRange(range as typeof selectedTimeRange)}
              >
                <Text
                  style={[
                    styles.timeRangeText,
                    selectedTimeRange === range && styles.timeRangeTextActive
                  ]}
                >
                  {range}
                </Text>
              </TouchableOpacity>
            ))}
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
        {!isOnline && (
          <View style={styles.offlineIndicator}>
            <Text style={styles.offlineText}>
              You're offline. Metrics may not be current.
            </Text>
          </View>
        )}

        {/* Metrics Grid */}
        <View style={styles.metricsGrid}>
          {metrics.map((metric, index) => (
            <View key={index} style={styles.metricCard}>
              <View style={styles.metricCardHeader}>
                <Text style={[styles.metricIcon, { color: metric.color }]}>
                  {metric.icon}
                </Text>
                <Text style={styles.metricTitle}>{metric.title}</Text>
              </View>
              <Text style={styles.metricValue}>{metric.value}</Text>
              {metric.change && (
                <View style={styles.metricChange}>
                  <Text style={{ color: getTrendColor(metric.trend) }}>
                    {getTrendIcon(metric.trend)}
                  </Text>
                  <Text
                    style={[
                      styles.metricChangeText,
                      { color: getTrendColor(metric.trend) }
                    ]}
                  >
                    {metric.change}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Query Performance Chart */}
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>Query Performance</Text>
          <View style={styles.chartContainer}>
            <Text style={styles.chartPlaceholder}>📈</Text>
            <Text style={styles.chartSubtitle}>Query performance chart</Text>
            <Text style={[styles.chartSubtitle, { fontSize: 12 }]}>
              Response times and throughput visualization
            </Text>
          </View>
        </View>

        {/* System Resources Chart */}
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>System Resources</Text>
          <View style={styles.chartContainer}>
            <Text style={styles.chartPlaceholder}>💾</Text>
            <Text style={styles.chartSubtitle}>System resource usage</Text>
            <Text style={[styles.chartSubtitle, { fontSize: 12 }]}>
              CPU, Memory, and Disk I/O metrics
            </Text>
          </View>
        </View>

        {/* Active Connections */}
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>Active Connections</Text>
          <View style={styles.connectionsList}>
            {connections.filter(c => c.status === 'connected').length > 0 ? (
              connections
                .filter(c => c.status === 'connected')
                .slice(0, 5)
                .map((connection, index) => (
                  <View
                    key={connection.id}
                    style={[
                      styles.connectionItem,
                      index === connections.filter(c => c.status === 'connected').slice(0, 5).length - 1 && styles.connectionItemLast
                    ]}
                  >
                    <View style={styles.connectionIcon}>
                      <Text style={styles.connectionIconText}>🔗</Text>
                    </View>
                    <View style={styles.connectionInfo}>
                      <Text style={styles.connectionName}>{connection.name}</Text>
                      <Text style={styles.connectionType}>{connection.type}</Text>
                    </View>
                    <View style={[styles.connectionStatus, { backgroundColor: theme.colors.success }]} />
                  </View>
                ))
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No active connections</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default MetricsScreen;