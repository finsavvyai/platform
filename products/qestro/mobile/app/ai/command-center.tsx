import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bot, FlaskConical, Mic, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { aiApi } from '../../src/lib/api';
import { radius, spacing, touchTarget, typography } from '../../src/theme/tokens';
import { Badge, Card } from '../../src/components/atoms';
import { Header } from '../../src/components/molecules';

interface AgentStatus {
  status: string;
  activeAgents?: number;
  queuedTasks?: number;
}

const QUICK_ACTIONS = [
  { key: 'gen', label: 'Generate Test', icon: Zap, route: '/ai/generate' },
  { key: 'chat', label: 'AI Chat', icon: Bot, route: '/ai/test-gen' },
  { key: 'record', label: 'AI Recorder', icon: Mic, route: '/ai/recorder' },
  { key: 'explore', label: 'Explorations', icon: FlaskConical, route: '/explorations' },
] as const;

export default function CommandCenterScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [agent, setAgent] = useState<AgentStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await aiApi.getOpenClawStatus();
      if (res.data) setAgent(res.data as AgentStatus);
    } catch { /* silent */ }
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const statusVariant = agent?.status === 'active' ? 'success' : agent?.status === 'error' ? 'error' : 'secondary';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header title="AI Command Center" showBack />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchStatus(); }} tintColor={colors.accentPrimary} />}
      >
        <Card variant="glass" padding="md">
          <View style={styles.statusRow}>
            <Bot size={20} color={colors.accentPrimary} />
            <Text style={[styles.statusTitle, { color: colors.textPrimary }]}>Agent Status</Text>
            <Badge variant={statusVariant} size="xs">{agent?.status ?? 'unknown'}</Badge>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{agent?.activeAgents ?? 0}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Active</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{agent?.queuedTasks ?? 0}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Queued</Text>
            </View>
          </View>
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map((a) => (
            <Pressable
              key={a.key}
              style={[styles.actionCard, { backgroundColor: colors.bgSecondary }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(a.route as never); }}
              accessibilityLabel={a.label}
              accessibilityRole="button"
            >
              <a.icon size={24} color={colors.accentPrimary} />
              <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.base, gap: spacing.lg },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusTitle: { ...typography.headline, flex: 1 },
  statsRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
  statItem: { alignItems: 'center' },
  statValue: { ...typography.title2, fontWeight: '700' },
  statLabel: { ...typography.caption1 },
  sectionTitle: { ...typography.title3, fontWeight: '600' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  actionCard: {
    width: '47%', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: spacing.lg, borderRadius: radius.card,
    minHeight: touchTarget.minHeight * 2,
  },
  actionLabel: { ...typography.caption1, fontWeight: '600' },
});
