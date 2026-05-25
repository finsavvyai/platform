import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Circle, Plus, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { aiApi } from '../../src/lib/api';
import { spacing, typography } from '../../src/theme/tokens';
import { Button, Card, Input } from '../../src/components/atoms';
import { Header, CodeViewer } from '../../src/components/molecules';

interface Step {
  id: string;
  action: string;
  target: string;
}

export default function AIRecorderScreen() {
  const { colors } = useTheme();
  const [steps, setSteps] = useState<Step[]>([]);
  const [action, setAction] = useState('');
  const [target, setTarget] = useState('');
  const recording = false;
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const addStep = () => {
    if (!action.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSteps((prev) => [...prev, { id: Date.now().toString(), action: action.trim(), target: target.trim() }]);
    setAction('');
    setTarget('');
  };

  const removeStep = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSteps((prev) => prev.filter((s) => s.id !== id));
  };

  const handleGenerate = useCallback(async () => {
    if (steps.length === 0) return;
    setLoading(true);
    const description = steps.map((s, i) => `${i + 1}. ${s.action}${s.target ? ` on "${s.target}"` : ''}`).join('\n');
    try {
      const res = await aiApi.generateTest({ description, framework: 'playwright', type: 'e2e' });
      if (res.data?.code) {
        setGeneratedCode(res.data.code);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert('Error', 'Failed to generate test from steps');
    } finally {
      setLoading(false);
    }
  }, [steps]);

  const renderStep = ({ item, index }: { item: Step; index: number }) => (
    <Card variant="glass" padding="sm">
      <View style={styles.stepRow}>
        <Text style={[styles.stepNum, { color: colors.accentPrimary }]}>{index + 1}</Text>
        <View style={styles.stepInfo}>
          <Text style={[styles.stepAction, { color: colors.textPrimary }]}>{item.action}</Text>
          {item.target ? <Text style={[styles.stepTarget, { color: colors.textMuted }]}>{item.target}</Text> : null}
        </View>
        <Pressable onPress={() => removeStep(item.id)} hitSlop={8} accessibilityLabel="Remove step">
          <Trash2 size={16} color={colors.accentError} />
        </Pressable>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header title="AI Step Recorder" showBack />
      <FlatList
        data={steps}
        keyExtractor={(s) => s.id}
        renderItem={renderStep}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.inputSection}>
            <View style={styles.recRow}>
              {recording ? <Circle size={10} color={colors.accentError} fill={colors.accentError} /> : null}
              <Text style={[styles.recLabel, { color: colors.textSecondary }]}>
                {recording ? 'Recording steps...' : `${steps.length} step${steps.length !== 1 ? 's' : ''} recorded`}
              </Text>
            </View>
            <Input label="Action" value={action} onChangeText={setAction} placeholder="Click, type, navigate..." />
            <Input label="Target (optional)" value={target} onChangeText={setTarget} placeholder="Button label or selector" />
            <Button variant="secondary" size="md" onPress={addStep} disabled={!action.trim()}>
              <Plus size={16} color={colors.accentPrimary} />{'  Add Step'}
            </Button>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {generatedCode && <CodeViewer code={generatedCode} language="typescript" />}
            <Button variant="primary" size="lg" onPress={handleGenerate} disabled={steps.length === 0 || loading}>
              {loading ? 'Generating...' : 'Generate Test Code'}
            </Button>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.base, gap: spacing.sm },
  inputSection: { gap: spacing.md, marginBottom: spacing.md },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  recLabel: { ...typography.caption1 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepNum: { ...typography.headline, fontWeight: '700', width: 24, textAlign: 'center' },
  stepInfo: { flex: 1 },
  stepAction: { ...typography.body },
  stepTarget: { ...typography.caption1, marginTop: 2 },
  footer: { gap: spacing.lg, marginTop: spacing.md },
});
