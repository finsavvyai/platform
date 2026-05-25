import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { AlertTriangle, Bug, Lightbulb } from 'lucide-react-native';
import { useTheme } from '../../src/hooks/useTheme';
import { explorationsApi } from '../../src/lib/api';
import { spacing, typography } from '../../src/theme/tokens';
import { Badge, Card, Skeleton } from '../../src/components/atoms';
import { Header } from '../../src/components/molecules';
import type { Exploration } from '../../src/types';

function findingIcon(type: string, color: string) {
  if (type === 'bug') return <Bug size={16} color={color} />;
  if (type === 'improvement') return <Lightbulb size={16} color={color} />;
  return <AlertTriangle size={16} color={color} />;
}

function severityVariant(s?: string) {
  if (s === 'critical' || s === 'high') return 'error' as const;
  if (s === 'medium') return 'warning' as const;
  return 'secondary' as const;
}

export default function ExplorationDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [exploration, setExploration] = useState<Exploration | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const res = await explorationsApi.getExploration(id);
      if (res.data) setExploration(res.data);
    } catch { /* silent */ }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.content}>
          <Skeleton height={34} width={200} />
          <Skeleton height={60} style={{ marginTop: 12 }} />
        </View>
      </SafeAreaView>
    );
  }

  const findings = exploration?.findings ?? [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header title={exploration?.title ?? 'Exploration'} showBack />
      <FlatList
        data={findings}
        keyExtractor={(f) => f.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            {exploration?.description && (
              <Text style={[styles.desc, { color: colors.textSecondary }]}>{exploration.description}</Text>
            )}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Findings ({findings.length})</Text>
          </>
        }
        ListEmptyComponent={<Text style={[styles.empty, { color: colors.textMuted }]}>No findings yet</Text>}
        renderItem={({ item }) => (
          <Card variant="glass" padding="sm">
            <View style={styles.findingRow}>
              {findingIcon(item.type, colors.textSecondary)}
              <View style={styles.findingInfo}>
                <Text style={[styles.findingTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                <Text style={[styles.findingDesc, { color: colors.textMuted }]} numberOfLines={2}>{item.description}</Text>
              </View>
              {item.severity && <Badge variant={severityVariant(item.severity)} size="xs">{item.severity}</Badge>}
            </View>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.base, gap: spacing.sm },
  desc: { ...typography.body, marginBottom: spacing.md },
  sectionTitle: { ...typography.headline, marginBottom: spacing.xs },
  empty: { ...typography.body, textAlign: 'center', marginTop: spacing.lg },
  findingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  findingInfo: { flex: 1 },
  findingTitle: { ...typography.headline },
  findingDesc: { ...typography.caption1, marginTop: 2 },
});
