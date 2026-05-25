import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@context';
import { useNetwork } from '@context';
import { useAppStore } from '@store';
import { DatabaseConnection } from '@types';

interface ConnectionItemProps {
  connection: DatabaseConnection;
  onPress: (connection: DatabaseConnection) => void;
  onEdit: (connection: DatabaseConnection) => void;
  onDelete: (connection: DatabaseConnection) => void;
}

const ConnectionItem: React.FC<ConnectionItemProps> = ({
  connection,
  onPress,
  onEdit,
  onDelete,
}) => {
  const { theme } = useTheme();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return theme.colors.success;
      case 'connecting':
        return theme.colors.warning;
      case 'error':
        return theme.colors.error;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting';
      case 'error':
        return 'Error';
      default:
        return 'Disconnected';
    }
  };

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
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
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
    subtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      backgroundColor: `${getStatusColor(connection.status)}20`,
      borderRadius: 12,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: getStatusColor(connection.status),
      marginRight: theme.spacing.xs,
    },
    statusText: {
      fontSize: 12,
      color: getStatusColor(connection.status),
      fontWeight: '500',
    },
    details: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    detailText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    actions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    actionButton: {
      padding: theme.spacing.xs,
    },
    actionText: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '500',
    },
  });

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(connection)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{connection.name}</Text>
          <Text style={styles.subtitle}>{connection.type}</Text>
        </View>
        <View style={styles.statusContainer}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>
            {getStatusText(connection.status)}
          </Text>
        </View>
      </View>

      <View style={styles.details}>
        <Text style={styles.detailText}>
          {connection.host}:{connection.port}
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              onEdit(connection);
            }}
          >
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              onDelete(connection);
            }}
          >
            <Text style={[styles.actionText, { color: theme.colors.error }]}>
              Delete
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const ConnectionsScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredConnections, setFilteredConnections] = useState<DatabaseConnection[]>([]);
  const { theme } = useTheme();
  const { isOnline } = useNetwork();
  const {
    connections,
    addConnection,
    updateConnection,
    removeConnection,
    setSelectedConnection,
  } = useAppStore();

  useEffect(() => {
    filterConnections();
  }, [connections, searchQuery]);

  const filterConnections = () => {
    if (!searchQuery.trim()) {
      setFilteredConnections(connections);
    } else {
      const filtered = connections.filter(conn =>
        conn.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conn.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conn.host.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredConnections(filtered);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Simulate refreshing connections
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleConnectionPress = (connection: DatabaseConnection) => {
    setSelectedConnection(connection);
    // Navigate to connection detail
    console.log('Navigate to connection detail:', connection.id);
  };

  const handleAddConnection = () => {
    // Navigate to add connection screen
    console.log('Navigate to add connection');
  };

  const handleEditConnection = (connection: DatabaseConnection) => {
    // Navigate to edit connection screen
    console.log('Navigate to edit connection:', connection.id);
  };

  const handleDeleteConnection = (connection: DatabaseConnection) => {
    Alert.alert(
      'Delete Connection',
      `Are you sure you want to delete "${connection.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            removeConnection(connection.id);
            console.log('Connection deleted:', connection.id);
          },
        },
      ]
    );
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
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      paddingHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    searchInput: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      fontSize: 16,
      color: theme.colors.text,
    },
    searchIcon: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginRight: theme.spacing.sm,
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
    addButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      flexDirection: 'row',
      alignItems: 'center',
    },
    addButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: theme.spacing.sm,
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
        <Text style={styles.title}>Database Connections</Text>

        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search connections..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {!isOnline && (
          <View style={styles.offlineIndicator}>
            <Text style={styles.offlineText}>
              You're offline. Connection status may not be current.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        {filteredConnections.length > 0 ? (
          <FlatList
            data={filteredConnections}
            renderItem={({ item }) => (
              <ConnectionItem
                connection={item}
                onPress={handleConnectionPress}
                onEdit={handleEditConnection}
                onDelete={handleDeleteConnection}
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
            <Text style={styles.emptyIcon}>🔗</Text>
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No connections found' : 'No database connections'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try adjusting your search terms or browse all connections.'
                : 'Add your first database connection to start monitoring and managing your databases.'}
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddConnection}
            >
              <Text style={styles.addButtonText}>+ Add Connection</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

export default ConnectionsScreen;