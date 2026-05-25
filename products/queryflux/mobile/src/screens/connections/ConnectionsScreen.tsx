/**
 * Connections screen showing all database connections
 */

import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';

import {useDatabase, DatabaseConnection} from '../../contexts/DatabaseContext';
import {theme} from '../../styles/theme';
import {RootStackParamList} from '../../navigation/AppNavigator';

type ConnectionsNavigationProp = StackNavigationProp<RootStackParamList>;

const ConnectionsScreen: React.FC = () => {
  const navigation = useNavigation<ConnectionsNavigationProp>();
  const {connections, isLoading, fetchConnections, refreshConnection} = useDatabase();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchConnections();
    setRefreshing(false);
  };

  const getConnectionTypeIcon = (type: string) => {
    switch (type) {
      case 'postgresql':
        return 'storage';
      case 'mysql':
        return 'storage';
      case 'mongodb':
        return 'view_module';
      case 'redis':
        return 'memory';
      case 'sqlite':
        return 'folder';
      default:
        return 'storage';
    }
  };

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

  const renderConnection = ({item}: {item: DatabaseConnection}) => (
    <TouchableOpacity
      style={styles.connectionItem}
      onPress={() => navigation.navigate('ConnectionDetail', {connectionId: item.id})}>
      <View style={styles.connectionIcon}>
        <Icon
          name={getConnectionTypeIcon(item.type)}
          size={24}
          color={theme.colors.primary}
        />
      </View>
      
      <View style={styles.connectionInfo}>
        <Text style={styles.connectionName}>{item.name}</Text>
        <Text style={styles.connectionDetails}>
          {item.type.toUpperCase()} • {item.host}:{item.port}
        </Text>
        {item.database && (
          <Text style={styles.connectionDatabase}>Database: {item.database}</Text>
        )}
      </View>

      <View style={styles.connectionStatus}>
        <View
          style={[
            styles.statusDot,
            {backgroundColor: getStatusColor(item.status)},
          ]}
        />
        <Text style={[styles.statusText, {color: getStatusColor(item.status)}]}>
          {item.status}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="storage" size={64} color={theme.colors.gray} />
      <Text style={styles.emptyStateTitle}>No Database Connections</Text>
      <Text style={styles.emptyStateText}>
        Your database connections will appear here once they are configured on the server.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={connections}
        renderItem={renderConnection}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={connections.length === 0 ? styles.emptyContainer : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  connectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.sm,
  },
  connectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
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
  connectionDatabase: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  connectionStatus: {
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: theme.spacing.xs,
  },
  statusText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.medium,
    textTransform: 'capitalize',
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyStateTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  emptyStateText: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.md,
  },
});

export default ConnectionsScreen;