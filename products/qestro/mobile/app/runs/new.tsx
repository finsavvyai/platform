import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '../../src/hooks/useTheme';
import { runsApi, testPlansApi, testCasesApi } from '../../src/lib/api';
import { useProjectStore } from '../../src/stores/projectStore';
import { spacing, typography } from '../../src/theme/tokens';
import { Button, Input } from '../../src/components/atoms';
import { ToggleRow, MultiSelect } from '../../src/components/molecules';
import type { TestPlan, TestCase } from '../../src/types';

const envOptions = ['development', 'staging', 'production'] as const;

export default function NewRunScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const activeProject = useProjectStore((s) => s.activeProject);
  const [name, setName] = useState('');
  const [environment, setEnvironment] = useState<string>('staging');
  const [parallel, setParallel] = useState(false);
  const [headless, setHeadless] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedCases, setSelectedCases] = useState<string[]>([]);
  const [plans, setPlans] = useState<TestPlan[]>([]);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        testPlansApi.getTestPlans({ projectId: activeProject?.id }),
        testCasesApi.getTestCases({ projectId: activeProject?.id }),
      ]);
      if (pRes.data) setPlans(pRes.data.items);
      if (cRes.data) setCases(cRes.data.items);
    } catch { /* empty */ }
  }, [activeProject?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async () => {
    if (!name.trim()) { Alert.alert('Validation', 'Run name is required'); return; }
    setSaving(true);
    try {
      const res = await runsApi.createAutomationRun({
        name: name.trim(), environment, projectId: activeProject?.id ?? '',
        testPlanId: selectedPlan ?? undefined, totalTests: selectedCases.length,
        passedTests: 0, failedTests: 0,
      });
      if (res.data) await runsApi.startRun(res.data.id);
      router.back();
    } catch { Alert.alert('Error', 'Failed to create run'); }
    finally { setSaving(false); }
  };

  const caseItems = cases.map((c) => ({ id: c.id, label: c.title, subtitle: `${c.priority} / ${c.type}` }));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.header}>
        <Button variant="ghost" size="sm" onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.textPrimary} />
        </Button>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>New Run</Text>
        <Button variant="primary" size="sm" onPress={handleCreate} isLoading={saving}>Start</Button>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Input label="Run Name" placeholder="e.g. Regression Suite v2.1" value={name} onChangeText={setName} variant="glass" />
          <View>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Environment</Text>
            <View style={styles.chipRow}>
              {envOptions.map((e) => (
                <Button key={e} variant={environment === e ? 'primary' : 'outline'} size="sm" onPress={() => setEnvironment(e)}>{e}</Button>
              ))}
            </View>
          </View>
          {plans.length > 0 && (
            <View>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Test Plan (optional)</Text>
              <View style={styles.chipRow}>
                {plans.map((p) => (
                  <Button key={p.id} variant={selectedPlan === p.id ? 'primary' : 'outline'} size="sm" onPress={() => setSelectedPlan(selectedPlan === p.id ? null : p.id)}>{p.name}</Button>
                ))}
              </View>
            </View>
          )}
          <MultiSelect items={caseItems} selected={selectedCases} onSelectionChange={setSelectedCases} label="Test Cases" />
          <View>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Configuration</Text>
            <ToggleRow label="Parallel Execution" description="Run tests simultaneously" value={parallel} onValueChange={setParallel} />
            <ToggleRow label="Headless Mode" description="Run without browser UI" value={headless} onValueChange={setHeadless} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  headerTitle: { ...typography.headline },
  form: { padding: spacing.base, gap: spacing.lg, paddingBottom: 40 },
  label: { ...typography.footnote, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
