import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '../../src/hooks/useTheme';
import { testPlansApi } from '../../src/lib/api';
import { useProjectStore } from '../../src/stores/projectStore';
import { spacing, typography } from '../../src/theme/tokens';
import { Button, Input } from '../../src/components/atoms';

export default function NewTestPlanScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const activeProject = useProjectStore((s) => s.activeProject);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Plan name is required');
      return;
    }
    setSaving(true);
    try {
      await testPlansApi.createTestPlan({
        name: name.trim(),
        description: description.trim() || undefined,
        status: 'draft',
        projectId: activeProject?.id ?? '',
        testCaseIds: [],
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to create test plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.header}>
        <Button variant="ghost" size="sm" onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.textPrimary} />
        </Button>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>New Test Plan</Text>
        <Button variant="primary" size="sm" onPress={handleSave} isLoading={saving}>
          Save
        </Button>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Input label="Name" placeholder="Enter plan name" value={name} onChangeText={setName} variant="glass" />
          <Input
            label="Description"
            placeholder="Describe the test plan scope and goals"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            variant="glass"
          />
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            You can add test cases after creating the plan.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
  },
  headerTitle: { ...typography.headline },
  form: { padding: spacing.base, gap: spacing.lg },
  hint: { ...typography.caption1, textAlign: 'center', marginTop: spacing.sm },
});
