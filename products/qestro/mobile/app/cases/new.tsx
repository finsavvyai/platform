import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '../../src/hooks/useTheme';
import { testCasesApi } from '../../src/lib/api';
import { useProjectStore } from '../../src/stores/projectStore';
import { spacing, typography } from '../../src/theme/tokens';
import { Button, Input } from '../../src/components/atoms';

export default function NewTestCaseScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const activeProject = useProjectStore((s) => s.activeProject);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [type, setType] = useState<'manual' | 'automated'>('manual');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Validation', 'Title is required');
      return;
    }
    setSaving(true);
    try {
      await testCasesApi.createTestCase({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        type,
        status: 'draft',
        projectId: activeProject?.id ?? '',
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to create test case');
    } finally {
      setSaving(false);
    }
  };

  const priorities = ['low', 'medium', 'high', 'critical'] as const;
  const types = ['manual', 'automated'] as const;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.header}>
        <Button variant="ghost" size="sm" onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.textPrimary} />
        </Button>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          New Test Case
        </Text>
        <Button
          variant="primary"
          size="sm"
          onPress={handleSave}
          isLoading={saving}
        >
          Save
        </Button>
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Input
            label="Title"
            placeholder="Enter test case title"
            value={title}
            onChangeText={setTitle}
            variant="glass"
          />
          <Input
            label="Description"
            placeholder="Describe what this test case verifies"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            variant="glass"
          />
          <View>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Priority</Text>
            <View style={styles.chipRow}>
              {priorities.map((p) => (
                <Button
                  key={p}
                  variant={priority === p ? 'primary' : 'outline'}
                  size="sm"
                  onPress={() => setPriority(p)}
                >
                  {p}
                </Button>
              ))}
            </View>
          </View>
          <View>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Type</Text>
            <View style={styles.chipRow}>
              {types.map((t) => (
                <Button
                  key={t}
                  variant={type === t ? 'primary' : 'outline'}
                  size="sm"
                  onPress={() => setType(t)}
                >
                  {t}
                </Button>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  headerTitle: { ...typography.headline },
  form: { padding: spacing.base, gap: spacing.lg },
  label: {
    ...typography.footnote,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
