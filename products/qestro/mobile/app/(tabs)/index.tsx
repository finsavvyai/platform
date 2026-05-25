import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type BottomSheetType from '@gorhom/bottom-sheet';
import { useTheme } from '../../src/hooks/useTheme';
import { dashboardApi, runsApi } from '../../src/lib/api';
import { useProjectStore } from '../../src/stores/projectStore';
import { spacing, typography } from '../../src/theme/tokens';
import { Card, Skeleton } from '../../src/components/atoms';
import { StatCard, ProgressBar, LiveFeedItem, Header, ProjectSwitcher } from '../../src/components/molecules';
import type { DashboardStats, AutomationRun } from '../../src/types';

function StatsSkeleton() {
  return (
    <View style={styles.statsGrid}>
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} style={styles.skeletonCard}>
          <Skeleton height={32} width={60} />
          <Skeleton height={14} width={80} style={{ marginTop: 8 }} />
        </View>
      ))}
    </View>
  );
}

export default function DashboardScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const sheetRef = useRef<BottomSheetType>(null);
  const activeProject = useProjectStore((s) => s.activeProject);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentRuns, setRecentRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, runsRes] = await Promise.all([
        dashboardApi.getDashboardStats(),
        runsApi.getAutomationRuns(),
      ]);
      if (statsRes.data) setStats(statsRes.data);
      if (runsRes.data) setRecentRuns(runsRes.data.items.slice(0, 10));
    } catch {
      // Will show empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const passRate = stats ? (stats.totalTests > 0 ? (stats.passedTests / stats.totalTests) * 100 : 0) : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header
        title="Dashboard"
        activeProject={activeProject}
        onProjectPress={() => sheetRef.current?.expand()}
        onNotificationsPress={() => router.push('/notifications' as never)}
      />
      <FlatList
        data={recentRuns}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.content}>
            {loading ? <StatsSkeleton /> : stats ? (
              <>
                <View style={styles.statsGrid}>
                  <StatCard label="Total Tests" value={stats.totalTests} color={colors.accentPrimary} />
                  <StatCard label="Passed" value={stats.passedTests} color={colors.accentSuccess} />
                  <StatCard label="Failed" value={stats.failedTests} color={colors.accentError} />
                  <StatCard label="Active Runs" value={stats.activeRuns} color={colors.accentWarning} />
                </View>
                <Card variant="glass" padding="md" style={styles.section}>
                  <ProgressBar progress={passRate} label="Pass Rate" showPercent color={colors.accentSuccess} />
                </Card>
              </>
            ) : (
              <Card variant="glass" padding="lg">
                <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>No data available</Text>
              </Card>
            )}
            {recentRuns.length > 0 && (
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Recent Activity</Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: spacing.base }}>
            <LiveFeedItem title={item.name} status={item.status === 'passed' || item.status === 'failed' || item.status === 'running' || item.status === 'pending' ? item.status : 'pending'} timestamp={item.createdAt} environment={item.environment} />
          </View>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentPrimary} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
      <ProjectSwitcher bottomSheetRef={sheetRef} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.base },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  skeletonCard: { flex: 1, minWidth: '45%', padding: spacing.base },
  section: { marginTop: spacing.base },
  sectionTitle: { ...typography.footnote, textTransform: 'uppercase', letterSpacing: 1, marginTop: spacing.lg, marginBottom: spacing.sm },
});
