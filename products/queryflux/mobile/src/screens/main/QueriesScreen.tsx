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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@context';
import { useNetwork } from '@context';
import { useAppStore } from '@store';
import { QueryExecution, SavedQuery } from '@types';

interface QueryItemProps {
  query: QueryExecution;
  onPress: (query: QueryExecution) => void;
  onDelete: (query: QueryExecution) => void;
  onSave: (query: QueryExecution) => void;
}

const QueryItem: React.FC<QueryItemProps> = ({
  query,
  onPress,
  onDelete,
  onSave,
}) => {
  const { theme } = useTheme();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return theme.colors.success;
      case 'error':
        return theme.colors.error;
      case 'running':
        return theme.colors.warning;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success':
        return 'Success';
      case 'error':
        return 'Error';
      case 'running':
        return 'Running';
      default:
        return 'Unknown';
    }
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return 'N/A';
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(2)}s`;
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
      backgroundColor: `${getStatusColor(query.status)}20`,
      borderRadius: 12,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: getStatusColor(query.status),
      marginRight: theme.spacing.xs,
    },
    statusText: {
      fontSize: 12,
      color: getStatusColor(query.status),
      fontWeight: '500',
    },
    queryText: {
      fontSize: 12,
      color: theme.colors.text,
      backgroundColor: theme.colors.background,
      padding: theme.spacing.sm,
      borderRadius: 6,
      fontFamily: 'monospace',
      marginBottom: theme.spacing.sm,
      maxHeight: 60,
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
      onPress={() => onPress(query)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {query.connectionName}
          </Text>
          <Text style={styles.subtitle}>
            {new Date(query.executedAt).toLocaleString()}
          </Text>
        </View>
        <View style={styles.statusContainer}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>
            {getStatusText(query.status)}
          </Text>
        </View>
      </View>

      <Text style={styles.queryText} numberOfLines={3}>
        {query.query}
      </Text>

      <View style={styles.details}>
        <Text style={styles.detailText}>
          {query.rowsAffected !== undefined ? `${query.rowsAffected} rows` : 'N/A'} • {formatDuration(query.duration)}
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              onSave(query);
            }}
          >
            <Text style={styles.actionText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              onDelete(query);
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

const QueriesScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredQueries, setFilteredQueries] = useState<QueryExecution[]>([]);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const { theme } = useTheme();
  const { isOnline } = useNetwork();
  const {
    recentQueries,
    savedQueries: storeSavedQueries,
    addSavedQuery,
    removeSavedQuery,
    addQueryExecution,
  } = useAppStore();

  useEffect(() => {
    filterQueries();
    setSavedQueries(storeSavedQueries);
  }, [recentQueries, storeSavedQueries, searchQuery, showSavedOnly]);

  const filterQueries = () => {
    let queries = showSavedOnly
      ? recentQueries.filter(q => storeSavedQueries.some(sq => sq.originalQueryId === q.id))
      : recentQueries;

    if (searchQuery.trim()) {
      queries = queries.filter(query =>
        query.query.toLowerCase().includes(searchQuery.toLowerCase()) ||
        query.connectionName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredQueries(queries);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Simulate refreshing queries
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleQueryPress = (query: QueryExecution) => {
    // Navigate to query detail
    console.log('Navigate to query detail:', query.id);
  };

  const handleNewQuery = () => {
    // Navigate to query editor
    console.log('Navigate to query editor');
  };

  const handleSaveQuery = (query: QueryExecution) => {
    const savedQuery: SavedQuery = {
      id: Date.now().toString(),
      name: `Query ${new Date().toLocaleString()}`,
      query: query.query,
      connectionId: query.connectionId,
      connectionName: query.connectionName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      originalQueryId: query.id,
    };

    addSavedQuery(savedQuery);
    Alert.alert('Success', 'Query saved successfully!');
  };

  const handleDeleteQuery = (query: QueryExecution) => {
    Alert.alert(
      'Delete Query',
      'Are you sure you want to delete this query from history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Remove from recent queries (in a real app, this would be an API call)
            console.log('Query deleted:', query.id);
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
    tabsContainer: {
      flexDirection: 'row',
      marginBottom: theme.spacing.md,
    },
    tab: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: theme.colors.primary,
    },
    tabText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    tabTextActive: {
      color: theme.colors.primary,
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
        <Text style={styles.title}>Query History</Text>

        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, !showSavedOnly && styles.tabActive]}
            onPress={() => setShowSavedOnly(false)}
          >
            <Text style={[styles.tabText, !showSavedOnly && styles.tabTextActive]}>
              Recent ({recentQueries.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, showSavedOnly && styles.tabActive]}
            onPress={() => setShowSavedOnly(true)}
          >
            <Text style={[styles.tabText, showSavedOnly && styles.tabTextActive]}>
              Saved ({storeSavedQueries.length})
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search queries..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {!isOnline && (
          <View style={styles.offlineIndicator}>
            <Text style={styles.offlineText}>
              You're offline. You can view saved queries but cannot execute new ones.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        {filteredQueries.length > 0 ? (
          <FlatList
            data={filteredQueries}
            renderItem={({ item }) => (
              <QueryItem
                query={item}
                onPress={handleQueryPress}
                onDelete={handleDeleteQuery}
                onSave={handleSaveQuery}
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
            <Text style={styles.emptyIcon}>💾</Text>
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No queries found' : showSavedOnly ? 'No saved queries' : 'No recent queries'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try adjusting your search terms or browse all queries.'
                : showSavedOnly
                ? 'Save queries from your history to access them quickly later.'
                : 'Execute queries to see them appear here.'}
            </Text>
            {!showSavedOnly && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleNewQuery}
              >
                <Text style={styles.addButtonText}>+ New Query</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

export default QueriesScreen;