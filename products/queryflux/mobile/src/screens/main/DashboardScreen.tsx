import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@context';
import { useNetwork } from '@context';
import { useNotifications } from '@context';
import { useAppStore } from '@store';
import OfflineIndicator from '../../components/offline/OfflineIndicator';

const { width } = Dimensions.get('window');

interface StatCard {
  title: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: string;
}

const DashboardScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<StatCard[]>([]);
  const { theme } = useTheme();
  const { isOnline, showOfflineIndicator } = useNetwork();
  const { unreadCount } = useNotifications();
  const {
    connections,
    alerts,
    recentQueries,
    metrics,
    user,
    initializeApp
  } = useAppStore();

  useEffect(() => {
    loadDashboardData();
  }, [connections, alerts, recentQueries, metrics]);

  const loadDashboardData = async () => {
    try {
      // Initialize app if needed
      if (!user) {
        await initializeApp();
      }

      // Calculate stats
      const newStats: StatCard[] = [
        {
          title: 'Active Connections',
          value: connections.filter(c => c.status === 'connected').length.toString(),
          change: '+2 today',
          trend: 'up',
          icon: '🔗',
        },
        {
          title: 'Active Alerts',
          value: alerts.filter(a => !a.acknowledged && !a.resolved).length.toString(),
          change: '-1 today',
          trend: 'down',
          icon: '🚨',
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
          icon: '💾',
        },
        {
          title: 'System Health',
          value: '98%',
          change: 'Optimal',
          trend: 'neutral',
          icon: '💚',
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

  const handleStatPress = (stat: StatCard) => {
    Alert.alert(
      stat.title,
      `Current value: ${stat.value}\n${stat.change ? `Change: ${stat.change}` : ''}`,
      [{ text: 'OK', style: 'default' }]
    );
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
      paddingBottom: theme.spacing.md,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    greeting: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      backgroundColor: isOnline
        ? `${theme.colors.success}20`
        : `${theme.colors.error}20`,
      borderRadius: 12,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: isOnline ? theme.colors.success : theme.colors.error,
      marginRight: theme.spacing.xs,
    },
    statusText: {
      fontSize: 12,
      color: isOnline ? theme.colors.success : theme.colors.error,
      fontWeight: '500',
    },
    subtitle: {
      fontSize: 16,
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
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.lg,
    },
    statCard: {
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
    statCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    statIcon: {
      fontSize: 20,
      marginRight: theme.spacing.sm,
    },
    statTitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      flex: 1,
    },
    statValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    statChange: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statChangeText: {
      fontSize: 12,
      marginLeft: 2,
    },
    quickActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    quickAction: {
      width: (width - theme.spacing.lg * 2 - theme.spacing.md) / 2,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: theme.spacing.lg,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    quickActionIcon: {
      fontSize: 32,
      marginBottom: theme.spacing.sm,
    },
    quickActionText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text,
      textAlign: 'center',
    },
    recentActivity: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: theme.spacing.md,
    },
    activityItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    activityItemLast: {
      borderBottomWidth: 0,
    },
    activityIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.spacing.md,
    },
    activityIconText: {
      fontSize: 16,
    },
    activityContent: {
      flex: 1,
    },
    activityTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text,
      marginBottom: 2,
    },
    activityTime: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    notificationIndicator: {
      position: 'absolute',
      top: -2,
      right: -2,
      backgroundColor: theme.colors.error,
      borderRadius: 10,
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notificationText: {
      color: 'white',
      fontSize: 12,
      fontWeight: 'bold',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <OfflineIndicator showDetails={false} />
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.greeting}>
            Welcome back{user?.name ? `, ${user.name}` : ''}! 👋
          </Text>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          Here's what's happening with your databases today.
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
        {/* Stats Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            {stats.map((stat, index) => (
              <TouchableOpacity
                key={index}
                style={styles.statCard}
                onPress={() => handleStatPress(stat)}
                activeOpacity={0.7}
              >
                <View style={styles.statCardHeader}>
                  <Text style={styles.statIcon}>{stat.icon}</Text>
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
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => console.log('Navigate to connections')}
              activeOpacity={0.7}
            >
              <Text style={styles.quickActionIcon}>🔗</Text>
              <Text style={styles.quickActionText}>Add Connection</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => console.log('Navigate to queries')}
              activeOpacity={0.7}
            >
              <Text style={styles.quickActionIcon}>💾</Text>
              <Text style={styles.quickActionText}>Run Query</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.recentActivity}>
            {recentQueries.slice(0, 3).map((query, index) => (
              <View
                key={query.id}
                style={[
                  styles.activityItem,
                  index === recentQueries.slice(0, 3).length - 1 && styles.activityItemLast
                ]}
              >
                <View style={styles.activityIcon}>
                  <Text style={styles.activityIconText}>💾</Text>
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>
                    Query executed on {query.connectionName}
                  </Text>
                  <Text style={styles.activityTime}>
                    {new Date(query.executedAt).toLocaleTimeString()}
                  </Text>
                </View>
              </View>
            ))}

            {alerts.slice(0, 2).map((alert, index) => (
              <View
                key={alert.id}
                style={styles.activityItem}
              >
                <View style={styles.activityIcon}>
                  <Text style={styles.activityIconText}>🚨</Text>
                  {unreadCount > 0 && (
                    <View style={styles.notificationIndicator}>
                      <Text style={styles.notificationText}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>
                    {alert.title}
                  </Text>
                  <Text style={styles.activityTime}>
                    {new Date(alert.createdAt).toLocaleTimeString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default DashboardScreen;