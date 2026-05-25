import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Pause, Play, Square, Share2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { runsApi } from '../../src/lib/api';
import { useWebSocket } from '../../src/hooks/useWebSocket';
import { spacing, typography } from '../../src/theme/tokens';
import { Badge, Button, Card, Skeleton } from '../../src/components/atoms';
import { ProgressBar, LiveConsole } from '../../src/components/molecules';
import type { LogEntry } from '../../src/components/molecules';
import type { AutomationRun } from '../../src/types';

const sv = { pending: 'warning', running: 'primary', passed: 'success', failed: 'error', cancelled: 'secondary', paused: 'warning' } as const;

export default function RunDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [run, setRun] = useState<AutomationRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const fetchRun = useCallback(async () => {
    if (!id) return;
    try { const r = await runsApi.getAutomationRun(id); if (r.data) setRun(r.data); }
    catch { /* empty */ } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchRun(); }, [fetchRun]);

  const { isConnected } = useWebSocket({
    path: `/ws/runs/${id}/logs`,
    autoConnect: !!id && run?.status === 'running',
    onMessage: (msg) => {
      if (msg.type === 'log') {
        const entry = msg.data as LogEntry;
        setLogs((prev) => [...prev, { ...entry, id: entry.id ?? `${Date.now()}` }]);
      }
      if (msg.type === 'status') setRun((prev) => prev ? { ...prev, ...(msg.data as Partial<AutomationRun>) } : prev);
    },
  });

  const handleAction = async (action: 'start' | 'pause' | 'cancel') => {
    if (!id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (action === 'start') await runsApi.startRun(id);
      else if (action === 'pause') await runsApi.pauseRun(id);
      else await runsApi.cancelRun(id);
      fetchRun();
    } catch { Alert.alert('Error', `Failed to ${action} run`); }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.content}>
          <Skeleton height={28} width={200} />
          <Skeleton height={80} style={{ marginTop: 16 }} />
          <Skeleton height={200} style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    );
  }

  if (!run) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.nav}>
          <Button variant="ghost" size="sm" onPress={() => router.back()}>
            <ArrowLeft size={20} color={colors.textPrimary} />
          </Button>
        </View>
        <Text style={{ color: colors.textSecondary, padding: spacing.lg, textAlign: 'center' }}>Run not found</Text>
      </SafeAreaView>
    );
  }

  const total = run.totalTests || 1;
  const progress = ((run.passedTests + run.failedTests) / total) * 100;
  const isActive = run.status === 'running' || run.status === 'pending';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.nav}>
        <Button variant="ghost" size="sm" onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.textPrimary} />
        </Button>
        <View style={styles.navActions}>
          {run.status === 'paused' && (
            <Pressable onPress={() => handleAction('start')} style={styles.navBtn}><Play size={18} color={colors.accentSuccess} /></Pressable>
          )}
          {run.status === 'running' && (
            <Pressable onPress={() => handleAction('pause')} style={styles.navBtn}><Pause size={18} color={colors.accentWarning} /></Pressable>
          )}
          {isActive && (
            <Pressable onPress={() => handleAction('cancel')} style={styles.navBtn}><Square size={18} color={colors.accentError} /></Pressable>
          )}
          <Pressable style={styles.navBtn}><Share2 size={18} color={colors.textSecondary} /></Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{run.name}</Text>
        <View style={styles.badges}>
          <Badge variant={sv[run.status]} size="sm">{run.status}</Badge>
          <Badge variant="glass" size="sm">{run.environment}</Badge>
          {isConnected && <Badge variant="success" size="xs">live</Badge>}
        </View>
        <Card variant="glass" padding="md" style={styles.section}>
          <ProgressBar progress={progress} label="Execution Progress" showPercent color={colors.accentPrimary} />
        </Card>
        <Card variant="glass" padding="md" style={styles.section}>
          <View style={styles.statsRow}>
            <StatItem label="Passed" value={run.passedTests} color={colors.accentSuccess} />
            <StatItem label="Failed" value={run.failedTests} color={colors.accentError} />
            <StatItem label="Total" value={run.totalTests} color={colors.textSecondary} />
          </View>
        </Card>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Console Output</Text>
        <LiveConsole logs={logs} style={styles.section} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: '#8e8e93' }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  navActions: { flexDirection: 'row', gap: spacing.xs },
  navBtn: { padding: spacing.sm },
  content: { padding: spacing.base, paddingBottom: 40 },
  title: { ...typography.title1, marginBottom: spacing.md },
  badges: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  section: { marginBottom: spacing.base },
  sectionLabel: { ...typography.footnote, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { ...typography.title1 },
  statLabel: { ...typography.caption1, marginTop: 2 },
});
