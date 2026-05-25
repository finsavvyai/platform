import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Calendar, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { cyclesApi } from '../../src/lib/api';
import { spacing, typography } from '../../src/theme/tokens';
import { Badge, Button, Card, Skeleton } from '../../src/components/atoms';
import type { TestCycle } from '../../src/types';

const statusVariant = { planned: 'secondary', in_progress: 'warning', completed: 'success' } as const;

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Not set';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CycleDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [cycle, setCycle] = useState<TestCycle | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCycle = useCallback(async () => {
    if (!id) return;
    try { const r = await cyclesApi.getCycle(id); if (r.data) setCycle(r.data); }
    catch { /* empty */ } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchCycle(); }, [fetchCycle]);

  const handleDelete = () => {
    Alert.alert('Delete Cycle', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        if (id) { await cyclesApi.deleteCycle(id); router.back(); }
      }},
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.content}>
          <Skeleton height={28} width={200} />
          <Skeleton height={80} style={{ marginTop: 16 }} />
          <Skeleton height={120} style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    );
  }

  if (!cycle) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.nav}>
          <Button variant="ghost" size="sm" onPress={() => router.back()}>
            <ArrowLeft size={20} color={colors.textPrimary} />
          </Button>
        </View>
        <Text style={{ color: colors.textSecondary, padding: spacing.lg, textAlign: 'center' }}>
          Test cycle not found
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.nav}>
        <Button variant="ghost" size="sm" onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.textPrimary} />
        </Button>
        <Button variant="ghost" size="sm" onPress={handleDelete}>
          <Trash2 size={18} color={colors.accentError} />
        </Button>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{cycle.name}</Text>
        <View style={styles.badges}>
          <Badge variant={statusVariant[cycle.status]} size="sm">{cycle.status.replace('_', ' ')}</Badge>
          <Badge variant="glass" size="sm">{cycle.environment}</Badge>
        </View>
        <Card variant="glass" padding="md" style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Schedule</Text>
          <View style={styles.dateRow}>
            <Calendar size={14} color={colors.textMuted} />
            <Text style={{ color: colors.textPrimary }}>Start: {formatDate(cycle.startDate)}</Text>
          </View>
          <View style={styles.dateRow}>
            <Calendar size={14} color={colors.textMuted} />
            <Text style={{ color: colors.textPrimary }}>End: {formatDate(cycle.endDate)}</Text>
          </View>
        </Card>
        {cycle.testPlanId && (
          <Card variant="glass" padding="md" style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Linked Test Plan</Text>
            <Button variant="outline" size="sm" onPress={() => router.push(`/plans/${cycle.testPlanId}`)}>
              View Test Plan
            </Button>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  content: { padding: spacing.base, paddingBottom: 40 },
  title: { ...typography.title1, marginBottom: spacing.md },
  badges: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  section: { marginBottom: spacing.base },
  sectionLabel: { ...typography.footnote, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },
  dateRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginBottom: spacing.sm },
});
