import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FlaskConical, Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { explorationsApi } from '../../src/lib/api';
import { spacing, touchTarget, typography } from '../../src/theme/tokens';
import { Badge, Card, EmptyState } from '../../src/components/atoms';
import { Header, SearchBar } from '../../src/components/molecules';
import type { Exploration } from '../../src/types';

export default function ExplorationsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<Exploration[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await explorationsApi.getExplorations();
      if (res.data) setItems(res.data);
    } catch { /* silent */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = items.filter((e) => e.title.toLowerCase().includes(search.toLowerCase()));
  const statusVariant = (s: string) => s === 'active' ? 'success' : s === 'completed' ? 'primary' : 'secondary';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header title="Explorations" showBack />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search explorations..." />
      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.accentPrimary} />}
        ListEmptyComponent={!loading ? <EmptyState title="No explorations" description="Start an exploratory testing session" /> : null}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/explorations/${item.id}` as never)}>
            <Card variant="glass" padding="md">
              <View style={styles.cardRow}>
                <FlaskConical size={16} color={colors.textSecondary} />
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>{item.title}</Text>
                <Badge variant={statusVariant(item.status)} size="xs">{item.status}</Badge>
              </View>
              {item.description && <Text style={[styles.desc, { color: colors.textMuted }]} numberOfLines={2}>{item.description}</Text>}
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {item.findings?.length ?? 0} findings
              </Text>
            </Card>
          </Pressable>
        )}
      />
      <Pressable
        style={[styles.fab, { backgroundColor: colors.accentPrimary }]}
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
        accessibilityLabel="New exploration" accessibilityRole="button"
      >
        <Plus size={24} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.base, gap: spacing.sm, paddingBottom: 100 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { ...typography.headline, flex: 1 },
  desc: { ...typography.caption1, marginTop: spacing.xs },
  meta: { ...typography.caption1, marginTop: spacing.sm },
  fab: {
    position: 'absolute', bottom: 100, right: spacing.base,
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    minWidth: touchTarget.minWidth, minHeight: touchTarget.minHeight,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
});
