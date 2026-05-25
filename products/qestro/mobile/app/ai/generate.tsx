import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { aiApi, testCasesApi } from '../../src/lib/api';
import { useProjectStore } from '../../src/stores/projectStore';
import { spacing, typography } from '../../src/theme/tokens';
import { Button, Input } from '../../src/components/atoms';
import { Header, FilterChips, CodeViewer } from '../../src/components/molecules';

const FRAMEWORKS = [
  { id: 'Playwright', label: 'Playwright' },
  { id: 'Cypress', label: 'Cypress' },
  { id: 'Puppeteer', label: 'Puppeteer' },
  { id: 'Jest', label: 'Jest' },
];
const TEST_TYPES = [
  { id: 'E2E', label: 'E2E' },
  { id: 'Integration', label: 'Integration' },
  { id: 'Unit', label: 'Unit' },
  { id: 'API', label: 'API' },
];

export default function AIGenerateScreen() {
  const { colors } = useTheme();
  const [description, setDescription] = useState('');
  const [framework, setFramework] = useState('Playwright');
  const [testType, setTestType] = useState('E2E');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const activeProject = useProjectStore((s) => s.activeProject);

  const canGenerate = description.trim().length > 10;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setLoading(true);
    setGeneratedCode(null);
    try {
      const res = await aiApi.generateTest({
        description: description.trim(),
        framework: framework.toLowerCase(),
        type: testType.toLowerCase(),
      });
      if (res.data?.code) {
        setGeneratedCode(res.data.code);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert('Error', 'Failed to generate test');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!generatedCode) return;
    setSaving(true);
    try {
      await testCasesApi.createTestCase({
        title: description.trim().slice(0, 80),
        description: description.trim(),
        type: 'automated',
        priority: 'medium',
        status: 'draft',
        projectId: activeProject?.id ?? '',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', 'Test case created from generated code');
    } catch {
      Alert.alert('Error', 'Failed to save test case');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header title="Generate with AI" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Input
          label="Describe your test"
          value={description}
          onChangeText={setDescription}
          placeholder="Test that a user can sign up, receive a confirmation email, and log in..."
          multiline
          numberOfLines={4}
        />

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Framework</Text>
          <FilterChips chips={FRAMEWORKS} selected={framework} onSelect={(id) => id && setFramework(id)} />
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Test Type</Text>
          <FilterChips chips={TEST_TYPES} selected={testType} onSelect={(id) => id && setTestType(id)} />
        </View>

        <Button variant="primary" size="lg" onPress={handleGenerate} disabled={!canGenerate || loading}>
          {loading ? 'Generating...' : 'Generate Test'}
        </Button>

        {generatedCode && (
          <View style={styles.resultSection}>
            <CodeViewer code={generatedCode} language={framework.toLowerCase()} />
            <Button variant="secondary" size="md" onPress={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save as Test Case'}
            </Button>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.base, gap: spacing.lg },
  section: { gap: spacing.sm },
  label: { ...typography.caption1, fontWeight: '600' },
  resultSection: { gap: spacing.md },
});
