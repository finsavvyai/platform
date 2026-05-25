import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@context';
import { useNetwork } from '@context';
import { useNotifications } from '@context';
import { useAppStore } from '@store';
import useRealtimeUpdates from '@hooks/useRealtimeUpdates';
import AppleStyleCard from '../../components/ui/AppleStyleCard';
import AppleStyleButton from '../../components/ui/AppleStyleButton';
import AppleStyleList from '../../components/ui/AppleStyleList';
import { Typography, Spacing, BorderRadius, Shadows, TouchTargets } from '../../constants/AppleHIG';
import OfflineIndicator from '../../components/offline/OfflineIndicator';
import { Activity, Database, AlertTriangle, TrendingUp, Plus, Settings, Wifi, WifiOff } from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface StatCard {
  title: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
  color: string;
}

const AppleStyleDashboardScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<StatCard[]>([]);
  const { theme } = useTheme();
  const { isOnline } = useNetwork();
  const { unreadCount } = useNotifications();
  const {
    connections,
    alerts,
    recentQueries,
    metrics,
    user,
    initializeApp
  } = useAppStore();

  // Real-time updates
  const { status: realtimeStatus } = useRealtimeUpdates({
    autoConnect: true,
    enableMetrics: true,
    enableAlerts: true,
    enableQueries: true,
  });

  useEffect(() => {
    loadDashboardData();
  }, [connections, alerts, recentQueries, metrics]);

  const loadDashboardData = async () => {
    try {
      if (!user) {
        await initializeApp();
      }

      const newStats: StatCard[] = [
        {
          title: 'Connections',
          value: connections.filter(c => c.status === 'connected').length.toString(),
          change: '+2 today',
          trend: 'up',
          icon: <Database size={24} color={theme.colors.primary} />,
          color: theme.colors.primary,
        },
        {
          title: 'Active Alerts',
          value: alerts.filter(a => !a.acknowledged && !a.resolved).length.toString(),
          change: '-1 today',
          trend: 'down',
          icon: <AlertTriangle size={24} color={theme.colors.error} />,
          color: theme.colors.error,
        },
        {
          title: 'Queries Today',
          value: recentQueries.filter(q => {
            const queryDate = new Date(q.executedAt);
            const today = new Date();
            return queryDate.toDateString() === today.toDateString();
          }).length.toString(),
          change: '+12%',
          trend: 'up',
          icon: <Activity size={24} color={theme.colors.success} />,
          color: theme.colors.success,
        },
        {
          title: 'System Health',
          value: '98%',
          change: 'Optimal',
          trend: 'neutral',
          icon: <TrendingUp size={24} color={theme.colors.warning} />,
          color: theme.colors.warning,
        },
      ];

      setStats(newStats);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadDashboardData();
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

  const quickActions = [
    {
      id: 'add-connection',
      title: 'Add Connection',
      subtitle: 'Connect to a new database',
      icon: <Plus size={20} color={theme.colors.primary} />,
      onPress: () => console.log('Navigate to add connection'),
    },
    {
      id: 'run-query',
      title: 'Run Query',
      subtitle: 'Execute SQL queries',
      icon: <Activity size={20} color={theme.colors.primary} />,
      onPress: () => console.log('Navigate to query editor'),
    },
    {
      id: 'view-alerts',
      title: 'View Alerts',
      subtitle: `View ${unreadCount} new alerts`,
      icon: <AlertTriangle size={20} color={theme.colors.error} />,
      onPress: () => console.log('Navigate to alerts'),
    },
    {
      id: 'settings',
      title: 'Settings',
      subtitle: 'Manage app preferences',
      icon: <Settings size={20} color={theme.colors.textSecondary} />,
      onPress: () => console.log('Navigate to settings'),
    },
  ];

  const recentActivityData = [
    ...recentQueries.slice(0, 3).map((query, index) => ({
      id: `query-${query.id}`,
      title: `Query executed on ${query.connectionName}`,
      subtitle: new Date(query.executedAt).toLocaleTimeString(),
      icon: <Activity size={20} color={theme.colors.primary} />,
      type: 'navigation' as const,
    })),
    ...alerts.slice(0, 2).map((alert, index) => ({
      id: `alert-${alert.id}`,
      title: alert.title,
      subtitle: new Date(alert.createdAt).toLocaleTimeString(),
      icon: <AlertTriangle size={20} color={theme.colors.error} />,
      type: 'navigation' as const,
      accessory: unreadCount > 0 && index === 0 ? (
        <View style={{
          backgroundColor: theme.colors.error,
          borderRadius: 10,
          paddingHorizontal: 6,
          paddingVertical: 2,
          minWidth: 20,
          alignItems: 'center',
        }}>
          <Text style={{
            color: 'white',
            fontSize: 12,
            fontWeight: '600',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </Text>
        </View>
      ) : undefined,
    })),
  ];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      paddingTop: Spacing.sm,
    },
    header: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    greetingSection: {
      marginBottom: Spacing.md,
    },
    greeting: {
      ...Typography.largeTitle,
      color: theme.colors.text,
      marginBottom: Spacing.xs,
    },
    subtitle: {
      ...Typography.body,
      color: theme.colors.textSecondary,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.lg,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.large,
      backgroundColor: isOnline
        ? `${theme.colors.success}20`
        : `${theme.colors.error}20`,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: isOnline ? theme.colors.success : theme.colors.error,
      marginRight: Spacing.xs,
    },
    statusText: {
      ...Typography.caption1,
      color: isOnline ? theme.colors.success : theme.colors.error,
      fontWeight: '600',
    },
    statusIcon: {
      marginRight: Spacing.xs,
    },
    section: {
      marginBottom: Spacing.xl,
    },
    sectionTitle: {
      ...Typography.title3,
      color: theme.colors.text,
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: Spacing.lg,
      justifyContent: 'space-between',
    },
    statCard: {
      width: (width - Spacing.lg * 2 - Spacing.md) / 2,
      marginBottom: Spacing.md,
    },
    statContent: {
      padding: Spacing.lg,
    },
    statHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    statIcon: {
      marginRight: Spacing.sm,
    },
    statTitle: {
      ...Typography.footnote,
      color: theme.colors.textSecondary,
      flex: 1,
    },
    statValue: {
      ...Typography.title1,
      color: theme.colors.text,
      marginBottom: Spacing.xs,
    },
    statChange: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statChangeText: {
      ...Typography.caption2,
      marginLeft: 2,
    },
    quickActionsContainer: {
      paddingHorizontal: Spacing.lg,
    },
    recentActivityContainer: {
      paddingHorizontal: Spacing.lg,
    },
    quickActionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    quickActionCard: {
      width: (width - Spacing.lg * 2 - Spacing.md) / 2,
      marginBottom: Spacing.md,
    },
    quickActionContent: {
      alignItems: 'center',
      paddingVertical: Spacing.lg,
    },
    quickActionIcon: {
      marginBottom: Spacing.sm,
    },
    quickActionTitle: {
      ...Typography.headline,
      color: theme.colors.text,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: Spacing.xs,
    },
    quickActionSubtitle: {
      ...Typography.footnote,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <OfflineIndicator showDetails={false} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.greetingSection}>
            <Text style={styles.greeting}>
              Welcome back{user?.name ? `, ${user.name}` : ''}! 👋
            </Text>
            <Text style={styles.subtitle}>
              Here's what's happening with your databases today.
            </Text>
          </View>

          <View style={styles.statusRow}>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
            <View style={[
              styles.statusBadge,
              { backgroundColor: realtimeStatus.isConnected ? `${theme.colors.success}20` : `${theme.colors.textSecondary}20` }
            ]}>
              {realtimeStatus.isConnected ? (
                <Wifi size={16} color={theme.colors.success} style={styles.statusIcon} />
              ) : (
                <WifiOff size={16} color={theme.colors.textSecondary} style={styles.statusIcon} />
              )}
              <Text style={[
                styles.statusText,
                { color: realtimeStatus.isConnected ? theme.colors.success : theme.colors.textSecondary }
              ]}>
                {realtimeStatus.isConnected ? 'Live' : 'Disconnected'}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            {stats.map((stat, index) => (
              <AppleStyleCard
                key={index}
                style={styles.statCard}
                variant="primary"
                shadow
              >
                <View style={styles.statContent}>
                  <View style={styles.statHeader}>
                    <View style={styles.statIcon}>
                      {stat.icon}
                    </View>
                    <Text style={styles.statTitle}>{stat.title}</Text>
                  </View>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  {stat.change && (
                    <View style={styles.statChange}>
                      <Text style={{ color: getTrendColor(stat.trend) }}>
                        {getTrendIcon(stat.trend)}
                      </Text>
                      <Text
                        style={[
                          styles.statChangeText,
                          { color: getTrendColor(stat.trend) }
                        ]}
                      >
                        {stat.change}
                      </Text>
                    </View>
                  )}
                </View>
              </AppleStyleCard>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.slice(0, 4).map((action) => (
              <AppleStyleCard
                key={action.id}
                style={styles.quickActionCard}
                variant="primary"
                onPress={action.onPress}
                shadow
              >
                <View style={styles.quickActionContent}>
                  <View style={styles.quickActionIcon}>
                    {action.icon}
                  </View>
                  <Text style={styles.quickActionTitle}>{action.title}</Text>
                  <Text style={styles.quickActionSubtitle}>{action.subtitle}</Text>
                </View>
              </AppleStyleCard>
            ))}
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.recentActivityContainer}>
            <AppleStyleCard variant="primary" shadow>
              <AppleStyleList
                data={recentActivityData}
                variant="plain"
                showsVerticalScrollIndicator={false}
              />
            </AppleStyleCard>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AppleStyleDashboardScreen;