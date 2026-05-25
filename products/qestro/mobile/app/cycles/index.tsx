import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';
import { useTheme } from '../../src/hooks/useTheme';
import { cyclesApi } from '../../src/lib/api';
import { useProjectStore } from '../../src/stores/projectStore';
import { spacing, typography } from '../../src/theme/tokens';
import { Badge, Card, EmptyState, Skeleton } from '../../src/components/atoms';
import { SearchBar, FilterChips, Header } from '../../src/components/molecules';
import type { TestCycle } from '../../src/types';

const statusVariant = { planned: 'secondary', in_progress: 'warning', completed: 'success' } as const;
const filterChips = [
  { id: 'planned', label: 'Planned' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
];

function CycleCard({ item, onPress }: { item: TestCycle; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress}>
      <Card variant="glass" padding="md">
        <View style={styles.cardHeader}>
          <RefreshCw size={16} color={colors.accentPrimary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>{item.name}</Text>
          <Badge variant={statusVariant[item.status]} size="xs">{item.status.replace('_', ' ')}</Badge>
        </View>
        <View style={styles.cardFooter}>
          <Badge variant="glass" size="xs">{item.environment}</Badge>
          {item.startDate && (
            <Text style={[styles.dateText, { color: colors.textMuted }]}>
              {new Date(item.startDate).toLocaleDateString()}
            </Text>
          )}
        </View>
      </Card>
    </Pressable>
  );
}

export default function CyclesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const activeProject = useProjectStore((s) => s.activeProject);
  const [cycles, setCycles] = useState<TestCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string | null>(null);

  const fetchCycles = useCallback(async () => {
    try {
      const res = await cyclesApi.getCycles({ projectId: activeProject?.id });
      if (res.data) setCycles(res.data.items);
    } catch { /* empty */ } finally { setLoading(false); setRefreshing(false); }
  }, [activeProject?.id]);

  useEffect(() => { fetchCycles(); }, [fetchCycles]);

  const filtered = useMemo(() => {
    let result = cycles;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(q) || c.environment.toLowerCase().includes(q));
    }
    if (filter) result = result.filter((c) => c.status === filter);
    return result;
  }, [cycles, search, filter]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.pad}>
          <Skeleton height={34} width={160} />
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={80} style={{ marginTop: 12 }} />)}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header title="Test Cycles" showBack />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search cycles..." style={styles.searchBar} />
      <FilterChips chips={filterChips} selected={filter} onSelect={setFilter} style={styles.chips} />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <CycleCard item={item} onPress={() => router.push(`/cycles/${item.id}`)} />
        )}
        ListEmptyComponent={
          <EmptyState title="No test cycles" description={search ? 'No results match' : 'No cycles created yet'} />
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCycles(); }} tintColor={colors.accentPrimary} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pad: { padding: spacing.base },
  searchBar: { marginHorizontal: spacing.base, marginBottom: spacing.sm },
  chips: { marginBottom: spacing.sm },
  list: { padding: spacing.base, gap: spacing.md, paddingBottom: 40 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { ...typography.headline, flex: 1 },
  cardFooter: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, alignItems: 'center' },
  dateText: { ...typography.caption1 },
});
