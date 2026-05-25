import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ClipboardList, Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { testPlansApi } from '../../src/lib/api';
import { useProjectStore } from '../../src/stores/projectStore';
import { spacing, typography, touchTarget } from '../../src/theme/tokens';
import { Badge, Card, EmptyState, Skeleton } from '../../src/components/atoms';
import { SearchBar, Header } from '../../src/components/molecules';
import type { TestPlan } from '../../src/types';

const statusVariant = { draft: 'secondary', active: 'success', completed: 'primary', archived: 'outline' } as const;

function PlanCard({ item, onPress }: { item: TestPlan; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress}>
      <Card variant="glass" padding="md">
        <View style={styles.cardHeader}>
          <ClipboardList size={18} color={colors.accentPrimary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>{item.name}</Text>
          <Badge variant={statusVariant[item.status]} size="xs">{item.status}</Badge>
        </View>
        {item.description && (
          <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={2}>{item.description}</Text>
        )}
        <View style={styles.cardFooter}>
          <Text style={[styles.caseCount, { color: colors.textMuted }]}>
            {item.testCaseIds.length} test case{item.testCaseIds.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

export default function TestPlansScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const activeProject = useProjectStore((s) => s.activeProject);
  const [plans, setPlans] = useState<TestPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const fetchPlans = useCallback(async () => {
    try {
      const res = await testPlansApi.getTestPlans({ projectId: activeProject?.id });
      if (res.data) setPlans(res.data.items);
    } catch { /* empty */ } finally { setLoading(false); setRefreshing(false); }
  }, [activeProject?.id]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const filtered = useMemo(() => {
    if (!search) return plans;
    const q = search.toLowerCase();
    return plans.filter((p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
  }, [plans, search]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.pad}>
          <Skeleton height={34} width={160} />
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={90} style={{ marginTop: 12 }} />)}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header title="Test Plans" showBack />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search plans..." style={styles.searchBar} />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <PlanCard item={item} onPress={() => router.push(`/plans/${item.id}`)} />
        )}
        ListEmptyComponent={
          <EmptyState title="No test plans" description={search ? 'No results match' : 'Create your first plan'} actionLabel={search ? undefined : 'New Plan'} onAction={search ? undefined : () => router.push('/plans/new')} />
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPlans(); }} tintColor={colors.accentPrimary} />}
      />
      <Pressable
        style={[styles.fab, { backgroundColor: colors.accentPrimary }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/plans/new'); }}
        accessibilityLabel="Create new test plan" accessibilityRole="button"
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
  list: { padding: spacing.base, gap: spacing.md, paddingBottom: 100 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { ...typography.headline, flex: 1 },
  cardDesc: { ...typography.footnote, marginTop: spacing.xs },
  cardFooter: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  caseCount: { ...typography.caption1 },
  fab: {
    position: 'absolute', bottom: 32, right: spacing.base, width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center', minWidth: touchTarget.minWidth, minHeight: touchTarget.minHeight,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
});
