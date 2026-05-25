/**
 * Dashboard screen showing overview of database connections and metrics
 */

import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {LineChart} from 'react-native-chart-kit';

import {useDatabase, DatabaseConnection} from '../../contexts/DatabaseContext';
import {theme} from '../../styles/theme';
import {RootStackParamList} from '../../navigation/AppNavigator';

type DashboardNavigationProp = StackNavigationProp<RootStackParamList>;

const screenWidth = Dimensions.get('window').width;

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<DashboardNavigationProp>();
  const {connections, isLoading, fetchConnections} = useDatabase();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchConnections();
    setRefreshing(false);
  };

  const getConnectionStatusColor = (status: string) => {
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

  const getConnectionTypeColor = (type: string) => {
    return theme.colors[type as keyof typeof theme.colors] || theme.colors.gray;
  };

  const getConnectionStats = () => {
    const total = connections.length;
    const connected = connections.filter(c => c.status === 'connected').length;
    const errors = connections.filter(c => c.status === 'error').length;
    
    return {total, connected, errors};
  };

  const renderConnectionCard = (connection: DatabaseConnection) => (
    <TouchableOpacity
      key={connection.id}
      style={styles.connectionCard}
      onPress={() => navigation.navigate('ConnectionDetail', {connectionId: connection.id})}>
      <View style={styles.connectionHeader}>
        <View style={styles.connectionInfo}>
          <Text style={styles.connectionName}>{connection.name}</Text>
          <Text style={styles.connectionDetails}>
            {connection.type.toUpperCase()} • {connection.host}:{connection.port}
          </Text>
        </View>
        <View style={styles.connectionStatus}>
          <View
            style={[
              styles.statusIndicator,
              {backgroundColor: getConnectionStatusColor(connection.status)},
            ]}
          />
          <Text style={styles.statusText}>{connection.status}</Text>
        </View>
      </View>

      {connection.metrics && (
        <View style={styles.metricsContainer}>
          <View style={styles.metric}>
            <Icon name="memory" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.metricText}>CPU: {connection.metrics.cpu}%</Text>
          </View>
          <View style={styles.metric}>
            <Icon name="storage" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.metricText}>Memory: {connection.metrics.memory}%</Text>
          </View>
          <View style={styles.metric}>
            <Icon name="link" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.metricText}>Connections: {connection.metrics.connections}</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderStatsCard = () => {
    const stats = getConnectionStats();
    
    return (
      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Connection Overview</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, {color: theme.colors.success}]}>
              {stats.connected}
            </Text>
            <Text style={styles.statLabel}>Connected</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, {color: theme.colors.error}]}>
              {stats.errors}
            </Text>
            <Text style={styles.statLabel}>Errors</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderPerformanceChart = () => {
    // Mock data for demonstration
    const chartData = {
      labels: ['1h', '2h', '3h', '4h', '5h', '6h'],
      datasets: [
        {
          data: [20, 45, 28, 80, 99, 43],
          color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };

    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Performance Overview</Text>
        <LineChart
          data={chartData}
          width={screenWidth - theme.spacing.lg * 2}
          height={200}
          chartConfig={{
            backgroundColor: theme.colors.white,
            backgroundGradientFrom: theme.colors.white,
            backgroundGradientTo: theme.colors.white,
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: {
              borderRadius: theme.borderRadius.md,
            },
            propsForDots: {
              r: '4',
              strokeWidth: '2',
              stroke: theme.colors.primary,
            },
          }}
          bezier
          style={styles.chart}
        />
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }>
      {renderStatsCard()}
      {renderPerformanceChart()}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Database Connections</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Main', {screen: 'Connections'})}>
            <Text style={styles.sectionAction}>View All</Text>
          </TouchableOpacity>
        </View>

        {connections.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="storage" size={48} color={theme.colors.gray} />
            <Text style={styles.emptyStateText}>No database connections</Text>
            <Text style={styles.emptyStateSubtext}>
              Connect to your databases to see them here
            </Text>
          </View>
        ) : (
          connections.slice(0, 3).map(renderConnectionCard)
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('Main', {screen: 'Query'})}>
            <Icon name="code" size={24} color={theme.colors.primary} />
            <Text style={styles.quickActionText}>Run Query</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('Main', {screen: 'Monitoring'})}>
            <Icon name="monitor" size={24} color={theme.colors.primary} />
            <Text style={styles.quickActionText}>Monitor</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('Main', {screen: 'Settings'})}>
            <Icon name="settings" size={24} color={theme.colors.primary} />
            <Text style={styles.quickActionText}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  statsCard: {
    backgroundColor: theme.colors.white,
    margin: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.sm,
  },
  statsTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: theme.typography.fontSize.xxl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
  },
  statLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  chartCard: {
    backgroundColor: theme.colors.white,
    margin: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.sm,
  },
  chartTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  chart: {
    marginVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  section: {
    margin: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text,
  },
  sectionAction: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  connectionCard: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  connectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  connectionInfo: {
    flex: 1,
  },
  connectionName: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text,
  },
  connectionDetails: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: theme.spacing.xs,
  },
  statusText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    textTransform: 'capitalize',
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyStateText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
  },
  emptyStateSubtext: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.sm,
  },
  quickAction: {
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
});

export default DashboardScreen;