import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Crosshair, Search, Ticket } from 'lucide-react-native';
import { useTheme } from '../../src/hooks/useTheme';
import { missionsApi } from '../../src/lib/api';
import { spacing, typography } from '../../src/theme/tokens';
import { Badge, Card, EmptyState } from '../../src/components/atoms';
import { Header, FilterChips } from '../../src/components/molecules';
import type { Mission } from '../../src/types';

const STATUS_CHIPS = [
  { id: 'pending', label: 'Pending' },
  { id: 'running', label: 'Running' },
  { id: 'completed', label: 'Completed' },
  { id: 'failed', label: 'Failed' },
];

function missionIcon(type: string, color: string) {
  if (type === 'TICKET') return <Ticket size={16} color={color} />;
  if (type === 'SCOUT') return <Search size={16} color={color} />;
  return <Crosshair size={16} color={color} />;
}

function statusVariant(s: string) {
  if (s === 'completed') return 'success' as const;
  if (s === 'running') return 'primary' as const;
  if (s === 'failed') return 'error' as const;
  return 'secondary' as const;
}

export default function MissionsScreen() {
  const { colors } = useTheme();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await missionsApi.getMissions(filter ? { status: filter } : undefined);
      if (res.data) setMissions(res.data);
    } catch { /* silent */ }
    setLoading(false);
    setRefreshing(false);
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header title="Mission Control" showBack />
      <FilterChips chips={STATUS_CHIPS} selected={filter} onSelect={setFilter} />
      <FlatList
        data={missions}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.accentPrimary} />}
        ListEmptyComponent={!loading ? <EmptyState title="No missions" description="Launch AI missions to automate testing workflows" /> : null}
        renderItem={({ item }) => (
          <Card variant="glass" padding="md">
            <View style={styles.missionRow}>
              {missionIcon(item.type, colors.textSecondary)}
              <View style={styles.missionInfo}>
                <Text style={[styles.missionTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                <Text style={[styles.missionType, { color: colors.textMuted }]}>{item.type}</Text>
              </View>
              <Badge variant={statusVariant(item.status)} size="xs">{item.status}</Badge>
            </View>
            {item.description && (
              <Text style={[styles.desc, { color: colors.textMuted }]} numberOfLines={2}>{item.description}</Text>
            )}
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.base, gap: spacing.sm, paddingBottom: 100 },
  missionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  missionInfo: { flex: 1 },
  missionTitle: { ...typography.headline },
  missionType: { ...typography.caption1 },
  desc: { ...typography.caption1, marginTop: spacing.xs },
});
