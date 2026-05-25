import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Clock, CheckCircle, XCircle, Loader } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { runsApi } from '../../src/lib/api';
import { spacing, typography, touchTarget } from '../../src/theme/tokens';
import { Badge, Card, EmptyState, Skeleton } from '../../src/components/atoms';
import { SearchBar, FilterChips, Header } from '../../src/components/molecules';
import type { AutomationRun } from '../../src/types';

const statusConfig = {
  passed: { variant: 'success' as const, icon: CheckCircle },
  failed: { variant: 'error' as const, icon: XCircle },
  running: { variant: 'primary' as const, icon: Loader },
  pending: { variant: 'warning' as const, icon: Clock },
  cancelled: { variant: 'secondary' as const, icon: XCircle },
  paused: { variant: 'warning' as const, icon: Clock },
};
const filterChips = [
  { id: 'running', label: 'Running' }, { id: 'passed', label: 'Passed' },
  { id: 'failed', label: 'Failed' }, { id: 'pending', label: 'Pending' },
];

function RunCard({ item, onPress }: { item: AutomationRun; onPress: () => void }) {
  const { colors } = useTheme();
  const config = statusConfig[item.status] ?? statusConfig.pending;
  const Icon = config.icon;
  const total = item.totalTests || 1;
  const progress = ((item.passedTests + item.failedTests) / total) * 100;

  return (
    <Pressable onPress={onPress}>
      <Card variant="glass" padding="md">
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Icon size={16} color={colors.textSecondary} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
          <Badge variant={config.variant} size="xs">{item.status}</Badge>
        </View>
        <View style={[styles.progressBar, { backgroundColor: colors.bgTertiary }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(progress, 100)}%`, backgroundColor: colors.accentPrimary },
            ]}
          />
        </View>
        <View style={styles.cardStats}>
          <Text style={[styles.statText, { color: colors.accentSuccess }]}>
            {item.passedTests} passed
          </Text>
          <Text style={[styles.statText, { color: colors.accentError }]}>
            {item.failedTests} failed
          </Text>
          <Text style={[styles.statText, { color: colors.textMuted }]}>
            {item.totalTests} total
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

export default function RunsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await runsApi.getAutomationRuns();
      if (res.data) setRuns(res.data.items);
    } catch { /* empty */ } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  const filtered = useMemo(() => {
    let result = runs;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) => r.name.toLowerCase().includes(q));
    }
    if (filter) result = result.filter((r) => r.status === filter);
    return result;
  }, [runs, search, filter]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.content}>
          <Skeleton height={34} width={120} />
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={110} style={{ marginTop: 12 }} />)}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header title="Test Runs" />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search runs..." style={styles.searchBar} />
      <FilterChips chips={filterChips} selected={filter} onSelect={setFilter} style={styles.chips} />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <RunCard item={item} onPress={() => router.push(`/runs/${item.id}`)} />}
        ListEmptyComponent={
          <EmptyState title="No test runs" description={search ? 'No results match' : 'Start your first run'} actionLabel={search ? undefined : 'New Run'} onAction={search ? undefined : () => router.push('/runs/new')} />
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRuns(); }} tintColor={colors.accentPrimary} />}
      />
      <Pressable
        style={[styles.fab, { backgroundColor: colors.accentPrimary }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/runs/new'); }}
        accessibilityLabel="Create new test run" accessibilityRole="button"
      >
        <Plus size={24} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.base },
  searchBar: { marginHorizontal: spacing.base, marginBottom: spacing.sm },
  chips: { marginBottom: spacing.sm },
  list: { padding: spacing.base, gap: spacing.md, paddingBottom: 100 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  cardTitle: { ...typography.headline, flex: 1 },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
  cardStats: { flexDirection: 'row', gap: spacing.base, marginTop: spacing.sm },
  statText: { ...typography.caption1 },
  fab: {
    position: 'absolute', bottom: 100, right: spacing.base,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    minWidth: touchTarget.minWidth, minHeight: touchTarget.minHeight,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
});
