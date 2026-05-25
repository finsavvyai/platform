import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Play, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { testPlansApi } from '../../src/lib/api';
import { spacing, typography } from '../../src/theme/tokens';
import { Badge, Button, Card, Skeleton } from '../../src/components/atoms';
import type { TestPlan } from '../../src/types';

const statusVariant = { draft: 'secondary', active: 'success', completed: 'primary', archived: 'outline' } as const;

export default function TestPlanDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<TestPlan | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPlan = useCallback(async () => {
    if (!id) return;
    try { const r = await testPlansApi.getTestPlan(id); if (r.data) setPlan(r.data); }
    catch { /* empty */ } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  const handleRun = async () => {
    if (!id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try { await testPlansApi.runTestPlan(id); Alert.alert('Started', 'Test plan execution started'); }
    catch { Alert.alert('Error', 'Failed to start execution'); }
  };

  const handleDelete = () => {
    Alert.alert('Delete Test Plan', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        if (id) { await testPlansApi.deleteTestPlan(id); router.back(); }
      }},
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.content}>
          <Skeleton height={28} width={200} />
          <Skeleton height={100} style={{ marginTop: 16 }} />
          <Skeleton height={120} style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    );
  }

  if (!plan) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.nav}>
          <Button variant="ghost" size="sm" onPress={() => router.back()}>
            <ArrowLeft size={20} color={colors.textPrimary} />
          </Button>
        </View>
        <Text style={{ color: colors.textSecondary, padding: spacing.lg, textAlign: 'center' }}>
          Test plan not found
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
        <View style={styles.navActions}>
          <Pressable onPress={handleRun} style={styles.navBtn}>
            <Play size={18} color={colors.accentSuccess} />
          </Pressable>
          <Pressable onPress={handleDelete} style={styles.navBtn}>
            <Trash2 size={18} color={colors.accentError} />
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{plan.name}</Text>
        <View style={styles.badges}>
          <Badge variant={statusVariant[plan.status]} size="sm">{plan.status}</Badge>
          <Badge variant="glass" size="sm">{plan.testCaseIds.length} cases</Badge>
        </View>
        {plan.description && (
          <Card variant="glass" padding="md" style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Description</Text>
            <Text style={{ color: colors.textPrimary, lineHeight: 22 }}>{plan.description}</Text>
          </Card>
        )}
        <Card variant="glass" padding="md" style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            Test Cases ({plan.testCaseIds.length})
          </Text>
          {plan.testCaseIds.length === 0 ? (
            <Text style={{ color: colors.textMuted }}>No test cases assigned</Text>
          ) : (
            plan.testCaseIds.map((caseId, i) => (
              <Pressable key={caseId} onPress={() => router.push(`/cases/${caseId}`)}>
                <View style={styles.caseRow}>
                  <Text style={[styles.caseNum, { color: colors.accentPrimary }]}>{i + 1}</Text>
                  <Text style={{ color: colors.textPrimary, flex: 1 }} numberOfLines={1}>
                    {caseId}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </Card>
        {plan.status === 'draft' && (
          <Button variant="primary" size="md" fullWidth onPress={handleRun} leftIcon={<Play size={16} color="#fff" />} style={styles.section}>
            Run Test Plan
          </Button>
        )}
      </ScrollView>
    </SafeAreaView>
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
  caseRow: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm },
  caseNum: { ...typography.headline, width: 24 },
});
