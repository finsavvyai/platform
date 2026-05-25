import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { recordingsApi } from '../../src/lib/api';
import { spacing, typography } from '../../src/theme/tokens';
import { Button, Input } from '../../src/components/atoms';
import { Header, FilterChips } from '../../src/components/molecules';

const FRAMEWORKS = [
  { id: 'Playwright', label: 'Playwright' },
  { id: 'Cypress', label: 'Cypress' },
  { id: 'Puppeteer', label: 'Puppeteer' },
  { id: 'Selenium', label: 'Selenium' },
];
const VIEWPORTS = [
  { id: 'Desktop (1920x1080)', label: 'Desktop' },
  { id: 'Tablet (768x1024)', label: 'Tablet' },
  { id: 'Mobile (375x812)', label: 'Mobile' },
];

export default function NewRecordingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [framework, setFramework] = useState('Playwright');
  const [viewport, setViewport] = useState('Desktop (1920x1080)');
  const [loading, setLoading] = useState(false);

  const canStart = url.trim().length > 0 && name.trim().length > 0;

  const handleStart = async () => {
    if (!canStart) return;
    setLoading(true);
    try {
      const res = await recordingsApi.startRecording({
        url: url.trim(),
        name: name.trim(),
        framework: framework.toLowerCase(),
        viewport: viewport.match(/\((.+)\)/)?.[1] ?? '1920x1080',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (res.data) {
        router.replace(`/recording/active?id=${res.data.id}` as never);
      }
    } catch {
      Alert.alert('Error', 'Failed to start recording session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header title="New Recording" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Input label="Target URL" value={url} onChangeText={setUrl} placeholder="https://example.com" autoCapitalize="none" keyboardType="url" />
        <Input label="Session Name" value={name} onChangeText={setName} placeholder="Login flow recording" />

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Framework</Text>
          <FilterChips chips={FRAMEWORKS} selected={framework} onSelect={(id) => id && setFramework(id)} />
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Viewport</Text>
          <FilterChips chips={VIEWPORTS} selected={viewport} onSelect={(id) => id && setViewport(id)} />
        </View>

        <Button variant="primary" size="lg" onPress={handleStart} disabled={!canStart || loading} style={styles.startBtn}>
          {loading ? 'Starting...' : 'Start Recording'}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.base, gap: spacing.lg },
  section: { gap: spacing.sm },
  label: { ...typography.caption1, fontWeight: '600' },
  startBtn: { marginTop: spacing.md },
});
