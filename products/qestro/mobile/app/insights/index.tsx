import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/hooks/useTheme';
import { insightsApi } from '../../src/lib/api';
import { radius, spacing, typography } from '../../src/theme/tokens';
import { Card, Skeleton } from '../../src/components/atoms';
import { Header, ProgressBar } from '../../src/components/molecules';
import type { InsightsOverview } from '../../src/types';

export default function InsightsScreen() {
  const { colors } = useTheme();
  const [overview, setOverview] = useState<InsightsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await insightsApi.getInsightsOverview();
      if (res.data) setOverview(res.data);
    } catch { /* silent */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.content}>
          <Skeleton height={34} width={160} />
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={80} style={{ marginTop: 12 }} />)}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header title="Insights" showBack />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.accentPrimary} />}
      >
        <View style={styles.statsGrid}>
          <StatBox label="Pass Rate" value={`${overview?.passRate ?? 0}%`} color={colors.accentSuccess} bgColor={colors.bgSecondary} textMuted={colors.textMuted} />
          <StatBox label="Total Runs" value={String(overview?.totalExecutions ?? 0)} color={colors.accentPrimary} bgColor={colors.bgSecondary} textMuted={colors.textMuted} />
          <StatBox label="Avg Duration" value={`${overview?.avgDuration ?? 0}s`} color={colors.accentWarning} bgColor={colors.bgSecondary} textMuted={colors.textMuted} />
        </View>

        {overview?.passRate != null && (
          <Card variant="glass" padding="md">
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Pass Rate</Text>
            <ProgressBar progress={overview.passRate} showPercent />
          </Card>
        )}

        {overview?.topFailures && overview.topFailures.length > 0 && (
          <Card variant="glass" padding="md">
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Top Failures</Text>
            {overview.topFailures.slice(0, 5).map((f) => (
              <View key={f.name} style={styles.failRow}>
                <Text style={[styles.failName, { color: colors.textSecondary }]} numberOfLines={1}>{f.name}</Text>
                <Text style={[styles.failCount, { color: colors.accentError }]}>{f.count}</Text>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ label, value, color, bgColor, textMuted }: {
  label: string; value: string; color: string; bgColor: string; textMuted: string;
}) {
  return (
    <View style={[styles.statBox, { backgroundColor: bgColor }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.base, gap: spacing.lg },
  statsGrid: { flexDirection: 'row', gap: spacing.md },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.card },
  statValue: { ...typography.title2, fontWeight: '700' },
  statLabel: { ...typography.caption1, marginTop: 2 },
  sectionTitle: { ...typography.headline, marginBottom: spacing.md },
  failRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  failName: { ...typography.body, flex: 1 },
  failCount: { ...typography.headline, fontWeight: '700' },
});
