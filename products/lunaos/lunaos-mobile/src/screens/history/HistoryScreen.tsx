/**
 * History screen — list of past agent executions.
 */

import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '../../hooks/useThemeColors';
import { spacing, radii, typography, TOUCH_TARGET } from '../../theme';
import { useExecutionStore } from '../../store/executionStore';
import { EmptyState } from '../../components/EmptyState';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import type { Execution } from '../../types/api';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function HistoryScreen(): React.ReactElement {
  const colors = useThemeColors();
  const { history, isLoadingHistory, fetchHistory } = useExecutionStore();

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const renderItem = useCallback(
    ({ item }: { item: Execution }) => (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.cardBackground,
            borderColor: colors.cardBorder,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text
            style={[styles.agentName, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {item.agent}
          </Text>
          <Text style={[styles.duration, { color: colors.accent }]}>
            {formatDuration(item.duration_ms)}
          </Text>
        </View>

        <View style={styles.cardMeta}>
          <Text style={[styles.metaText, { color: colors.textTertiary }]}>
            {item.provider} / {item.model}
          </Text>
          <Text style={[styles.metaText, { color: colors.textTertiary }]}>
            {item.output_length.toLocaleString()} chars
          </Text>
        </View>

        <Text style={[styles.dateText, { color: colors.textTertiary }]}>
          {formatDate(item.created_at)}
        </Text>
      </View>
    ),
    [colors],
  );

  if (isLoadingHistory && history.length === 0) {
    return <LoadingOverlay message="Loading history..." />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={history}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isLoadingHistory}
            onRefresh={fetchHistory}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="No executions yet"
            subtitle="Run an agent to see results here"
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.md, paddingBottom: spacing.xxl },
  card: {
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
    minHeight: TOUCH_TARGET,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  agentName: {
    ...typography.headline,
    flex: 1,
    marginRight: spacing.sm,
  },
  duration: { ...typography.footnote, fontWeight: '600' },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  metaText: { ...typography.caption },
  dateText: { ...typography.caption },
});
