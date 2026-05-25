import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@context';
import { useNetwork } from '@context';
import { useAppStore } from '@store';

const QueryEditorScreen: React.FC = () => {
  const [query, setQuery] = useState('SELECT * FROM users LIMIT 10;');
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [queryName, setQueryName] = useState('');
  const [selectedConnectionId, setSelectedConnectionId] = useState('');

  const { theme } = useTheme();
  const { isOnline } = useNetwork();
  const {
    connections,
    selectedConnection,
    addQueryExecution,
    addSavedQuery,
  } = useAppStore();

  const handleExecuteQuery = async () => {
    if (!query.trim()) {
      Alert.alert('Error', 'Please enter a query to execute');
      return;
    }

    if (!selectedConnection && !selectedConnectionId) {
      Alert.alert('Error', 'Please select a database connection');
      return;
    }

    setIsExecuting(true);

    try {
      // Simulate query execution
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock query results
      const mockResults = [
        { id: 1, name: 'John Doe', email: 'john@example.com', created_at: '2023-01-01' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', created_at: '2023-01-02' },
        { id: 3, name: 'Bob Johnson', email: 'bob@example.com', created_at: '2023-01-03' },
      ];

      setResults(mockResults);

      // Add to query history
      const queryExecution = {
        id: Date.now().toString(),
        query: query.trim(),
        connectionId: selectedConnection?.id || selectedConnectionId,
        connectionName: selectedConnection?.name || 'Selected Connection',
        status: 'success' as const,
        rowsAffected: mockResults.length,
        duration: Math.floor(Math.random() * 1000) + 100,
        executedAt: new Date().toISOString(),
      };

      addQueryExecution(queryExecution);

      Alert.alert(
        'Query Successful',
        `Query executed successfully. Returned ${mockResults.length} rows.`,
        [{ text: 'OK', style: 'default' }]
      );
    } catch (error) {
      const errorQuery = {
        id: Date.now().toString(),
        query: query.trim(),
        connectionId: selectedConnection?.id || selectedConnectionId,
        connectionName: selectedConnection?.name || 'Selected Connection',
        status: 'error' as const,
        rowsAffected: 0,
        duration: 0,
        executedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      addQueryExecution(errorQuery);

      Alert.alert(
        'Query Failed',
        error instanceof Error ? error.message : 'An unknown error occurred',
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSaveQuery = () => {
    if (!query.trim()) {
      Alert.alert('Error', 'Please enter a query to save');
      return;
    }

    setQueryName(`Query ${new Date().toLocaleDateString()}`);
    setShowSaveDialog(true);
  };

  const handleConfirmSave = () => {
    if (!queryName.trim()) {
      Alert.alert('Error', 'Please enter a name for the query');
      return;
    }

    const savedQuery = {
      id: Date.now().toString(),
      name: queryName.trim(),
      query: query.trim(),
      connectionId: selectedConnection?.id || selectedConnectionId,
      connectionName: selectedConnection?.name || 'Selected Connection',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addSavedQuery(savedQuery);
    setShowSaveDialog(false);
    setQueryName('');

    Alert.alert('Success', 'Query saved successfully!');
  };

  const handleClearResults = () => {
    setResults([]);
  };

  const getConnectionForExecution = () => {
    return selectedConnection || connections.find(c => c.id === selectedConnectionId);
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
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    connectionSelector: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    connectionText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    content: {
      flex: 1,
      padding: theme.spacing.lg,
    },
    section: {
      marginBottom: theme.spacing.lg,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    queryContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: theme.spacing.md,
      minHeight: 120,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    queryInput: {
      fontSize: 14,
      color: theme.colors.text,
      fontFamily: 'monospace',
      textAlignVertical: 'top',
      minHeight: 100,
    },
    actions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
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
    resultsContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: theme.spacing.md,
      maxHeight: 300,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    resultsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    resultsTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    clearButton: {
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
    },
    clearButtonText: {
      fontSize: 12,
      color: theme.colors.error,
      fontWeight: '500',
    },
    table: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      overflow: 'hidden',
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    tableHeaderText: {
      flex: 1,
      padding: theme.spacing.sm,
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.text,
      borderRightWidth: 1,
      borderRightColor: theme.colors.border,
    },
    tableHeaderTextLast: {
      borderRightWidth: 0,
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    tableCell: {
      flex: 1,
      padding: theme.spacing.sm,
      fontSize: 12,
      color: theme.colors.text,
      borderRightWidth: 1,
      borderRightColor: theme.colors.border,
    },
    tableCellLast: {
      borderRightWidth: 0,
    },
    noResults: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.xl,
    },
    noResultsText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: theme.spacing.lg,
      width: '80%',
      maxWidth: 300,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
    },
    modalInput: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      fontSize: 16,
      color: theme.colors.text,
      marginBottom: theme.spacing.lg,
    },
    modalActions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    modalButton: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      borderRadius: 8,
      alignItems: 'center',
    },
    modalButtonPrimary: {
      backgroundColor: theme.colors.primary,
    },
    modalButtonSecondary: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    modalTextPrimary: {
      color: 'white',
    },
    modalTextSecondary: {
      color: theme.colors.text,
    },
    offlineIndicator: {
      backgroundColor: theme.colors.warning + '20',
      borderColor: theme.colors.warning,
      borderWidth: 1,
      borderRadius: 8,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
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
          <Text style={styles.title}>Query Editor</Text>
          <View style={styles.connectionSelector}>
            <Text style={styles.connectionText}>
              {getConnectionForExecution()?.name || 'No connection selected'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        {!isOnline && (
          <View style={styles.offlineIndicator}>
            <Text style={styles.offlineText}>
              You're offline. Query execution may not work properly.
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SQL Query</Text>
          <View style={styles.queryContainer}>
            <TextInput
              style={styles.queryInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Enter your SQL query here..."
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              autoFocus
              editable={!isExecuting}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPrimary]}
              onPress={handleExecuteQuery}
              disabled={isExecuting || !query.trim()}
            >
              {isExecuting ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={[styles.actionButtonText, styles.actionTextPrimary]}>
                  Execute
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSecondary]}
              onPress={handleSaveQuery}
              disabled={isExecuting || !query.trim()}
            >
              <Text style={[styles.actionButtonText, styles.actionTextSecondary]}>
                Save
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {results.length > 0 && (
          <View style={styles.section}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>
                Results ({results.length} rows)
              </Text>
              <TouchableOpacity style={styles.clearButton} onPress={handleClearResults}>
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.resultsContainer}>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  {Object.keys(results[0]).map((key, index) => (
                    <Text
                      key={key}
                      style={[
                        styles.tableHeaderText,
                        index === Object.keys(results[0]).length - 1 && styles.tableHeaderTextLast
                      ]}
                    >
                      {key}
                    </Text>
                  ))}
                </View>
                {results.map((row, rowIndex) => (
                  <View key={rowIndex} style={styles.tableRow}>
                    {Object.values(row).map((value, colIndex) => (
                      <Text
                        key={colIndex}
                        style={[
                          styles.tableCell,
                          colIndex === Object.values(row).length - 1 && styles.tableCellLast
                        ]}
                      >
                        {String(value)}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {results.length === 0 && !isExecuting && (
          <View style={styles.section}>
            <View style={styles.resultsContainer}>
              <View style={styles.noResults}>
                <Text style={styles.noResultsText}>
                  Execute a query to see results here
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Save Query Modal */}
      <Modal
        visible={showSaveDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSaveDialog(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Save Query</Text>
            <TextInput
              style={styles.modalInput}
              value={queryName}
              onChangeText={setQueryName}
              placeholder="Enter query name"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowSaveDialog(false)}
              >
                <Text style={[styles.modalButtonText, styles.modalTextSecondary]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleConfirmSave}
              >
                <Text style={[styles.modalButtonText, styles.modalTextPrimary]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default QueryEditorScreen;