import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, RunSummary } from '../hooks/useApi';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Card from '../components/Card';
import { colors, spacing, fontSize } from '../theme';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDuration(ms: number | null): string {
  if (!ms) return '--';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function RunItem({ run }: { run: RunSummary }) {
  return (
    <Card style={{ marginBottom: spacing.sm }}>
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={styles.repo} numberOfLines={1}>{run.repo}</Text>
          <Text style={styles.branch} numberOfLines={1}>{run.branch}</Text>
        </View>
        <StatusBadge status={run.status} />
      </View>
      <View style={styles.meta}>
        <Text style={styles.metaText}>{formatDuration(run.duration_ms)}</Text>
        <Text style={styles.metaText}>{timeAgo(run.created_at)}</Text>
      </View>
    </Card>
  );
}

export default function RunsScreen() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setRuns(await api.getRuns()); }
    catch { /* keep existing */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); void load(); }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.header}>CI Runs</Text>
      <FlatList
        data={runs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <RunItem run={item} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListEmptyComponent={loading ? null : <EmptyState icon=">" message="No runs yet. Push code to trigger your first CI run." />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary, padding: spacing.lg },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  info: { flex: 1, marginRight: spacing.sm },
  repo: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  branch: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  metaText: { fontSize: fontSize.xs, color: colors.textMuted },
});
