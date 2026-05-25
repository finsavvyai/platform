import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { testCasesApi } from '../../src/lib/api';
import { spacing, typography, touchTarget } from '../../src/theme/tokens';
import { Badge, Card, EmptyState, Skeleton } from '../../src/components/atoms';
import { SearchBar, FilterChips, Header } from '../../src/components/molecules';
import { useProjectStore } from '../../src/stores/projectStore';
import type { TestCase } from '../../src/types';

const priorityVariant = { critical: 'error', high: 'warning', medium: 'primary', low: 'secondary' } as const;
const filterChips = [
  { id: 'active', label: 'Active' }, { id: 'draft', label: 'Draft' },
  { id: 'automated', label: 'Automated' }, { id: 'manual', label: 'Manual' },
];

function TestCaseCard({ item, onPress }: { item: TestCase; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress}>
      <Card variant="glass" padding="md">
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>{item.title}</Text>
          <Badge variant={priorityVariant[item.priority]} size="xs">{item.priority}</Badge>
        </View>
        {item.description && (
          <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={2}>{item.description}</Text>
        )}
        <View style={styles.cardFooter}>
          <Badge variant={item.type === 'automated' ? 'success' : 'outline'} size="xs">{item.type}</Badge>
          <Badge variant="glass" size="xs">{item.status}</Badge>
        </View>
      </Card>
    </Pressable>
  );
}

export default function TestCasesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const activeProject = useProjectStore((s) => s.activeProject);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string | null>(null);

  const fetchCases = useCallback(async () => {
    try {
      const res = await testCasesApi.getTestCases({ projectId: activeProject?.id });
      if (res.data) setCases(res.data.items);
    } catch { /* empty */ } finally { setLoading(false); setRefreshing(false); }
  }, [activeProject?.id]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const filtered = useMemo(() => {
    let result = cases;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) => c.title.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q));
    }
    if (filter) {
      result = result.filter((c) => c.status === filter || c.type === filter);
    }
    return result;
  }, [cases, search, filter]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.pad}>
          <Skeleton height={34} width={160} />
          <Skeleton height={44} style={{ marginTop: 16 }} />
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={100} style={{ marginTop: 12 }} />)}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header title="Test Cases" />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search test cases..." style={styles.searchBar} />
      <FilterChips chips={filterChips} selected={filter} onSelect={setFilter} style={styles.chips} />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TestCaseCard item={item} onPress={() => router.push(`/cases/${item.id}`)} />
        )}
        ListEmptyComponent={
          <EmptyState title="No test cases" description={search ? 'No results match your search' : 'Create your first test case'} actionLabel={search ? undefined : 'New Test Case'} onAction={search ? undefined : () => router.push('/cases/new')} />
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCases(); }} tintColor={colors.accentPrimary} />}
      />
      <Pressable
        style={[styles.fab, { backgroundColor: colors.accentPrimary }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/cases/new'); }}
        accessibilityLabel="Create new test case" accessibilityRole="button"
      >
        <Plus size={24} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pad: { padding: spacing.base },
  searchBar: { marginHorizontal: spacing.base, marginBottom: spacing.sm },
  chips: { marginBottom: spacing.sm },
  list: { padding: spacing.base, gap: spacing.md, paddingBottom: 100 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  cardTitle: { ...typography.headline, flex: 1 },
  cardDesc: { ...typography.footnote, marginTop: spacing.xs },
  cardFooter: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  fab: {
    position: 'absolute', bottom: 100, right: spacing.base, width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center', minWidth: touchTarget.minWidth, minHeight: touchTarget.minHeight,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
});
