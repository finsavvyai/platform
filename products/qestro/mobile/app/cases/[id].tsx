import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Edit, Trash2, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { testCasesApi } from '../../src/lib/api';
import { spacing, typography } from '../../src/theme/tokens';
import { Badge, Button, Card, Skeleton } from '../../src/components/atoms';
import type { TestCase } from '../../src/types';

export default function TestCaseDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tc, setTc] = useState<TestCase | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    if (!id) return;
    try { const r = await testCasesApi.getTestCase(id); if (r.data) setTc(r.data); }
    catch { /* empty */ } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const handleDelete = () => {
    Alert.alert('Delete Test Case', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        if (id) { await testCasesApi.deleteTestCase(id); router.back(); }
      }},
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.content}>
          <Skeleton height={28} width={200} />
          <Skeleton height={100} style={{ marginTop: 16 }} />
          <Skeleton height={200} style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    );
  }
  if (!tc) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.nav}><Button variant="ghost" size="sm" onPress={() => router.back()}><ArrowLeft size={20} color={colors.textPrimary} /></Button></View>
        <Text style={{ color: colors.textSecondary, padding: spacing.lg, textAlign: 'center' }}>Test case not found</Text>
      </SafeAreaView>
    );
  }
  const pv = { critical: 'error', high: 'warning', medium: 'primary', low: 'secondary' } as const;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.nav}>
        <Button variant="ghost" size="sm" onPress={() => router.back()}><ArrowLeft size={20} color={colors.textPrimary} /></Button>
        <View style={styles.navActions}>
          <Pressable onPress={() => router.push(`/cases/${id}/edit`)} style={styles.navBtn}><Edit size={18} color={colors.accentPrimary} /></Pressable>
          <Pressable onPress={handleDelete} style={styles.navBtn}><Trash2 size={18} color={colors.accentError} /></Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{tc.title}</Text>
        <View style={styles.badges}>
          <Badge variant={pv[tc.priority]} size="sm">{tc.priority}</Badge>
          <Badge variant={tc.type === 'automated' ? 'success' : 'outline'} size="sm">{tc.type}</Badge>
          <Badge variant="glass" size="sm">{tc.status}</Badge>
        </View>
        {tc.description && (
          <Card variant="glass" padding="md" style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Description</Text>
            <Text style={{ color: colors.textPrimary, lineHeight: 22 }}>{tc.description}</Text>
          </Card>
        )}
        {tc.steps && tc.steps.length > 0 && (
          <Card variant="glass" padding="md" style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Steps ({tc.steps.length})</Text>
            {tc.steps.map((step, i) => (
              <View key={step.id} style={styles.step}>
                <Text style={[styles.stepNum, { color: colors.accentPrimary }]}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary }}>{step.action}</Text>
                  <Text style={[styles.expected, { color: colors.textMuted }]}>Expected: {step.expectedResult}</Text>
                </View>
              </View>
            ))}
          </Card>
        )}
        {tc.tags && tc.tags.length > 0 && (
          <View style={styles.tagRow}>
            {tc.tags.map((tag) => <Badge key={tag} variant="glass" size="xs">{tag}</Badge>)}
          </View>
        )}
        <Button variant="glass" size="md" fullWidth onPress={() => router.push('/ai/generate' as never)} leftIcon={<Sparkles size={16} color={colors.accentPrimary} />} style={styles.section}>
          Generate with AI
        </Button>
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
  step: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  stepNum: { ...typography.headline, width: 24 },
  expected: { ...typography.caption1, marginTop: spacing.xs },
  tagRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.base },
});
