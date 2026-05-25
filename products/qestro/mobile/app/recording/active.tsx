import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Circle, Square } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { recordingsApi } from '../../src/lib/api';
import { spacing, typography } from '../../src/theme/tokens';
import { Button, Card } from '../../src/components/atoms';
import { Header, CodeViewer, ConfidenceMeter } from '../../src/components/molecules';
import type { Recording } from '../../src/types';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ActiveRecordingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [stopping, setStopping] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const fetchRecording = useCallback(async () => {
    if (!id) return;
    try {
      const res = await recordingsApi.getRecording(id);
      if (res.data) setRecording(res.data);
    } catch { /* silent */ }
  }, [id]);

  useEffect(() => { fetchRecording(); }, [fetchRecording]);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const handleStop = async () => {
    if (!id) return;
    setStopping(true);
    try {
      const res = await recordingsApi.stopRecording(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (res.data) setRecording(res.data);
      if (timerRef.current) clearInterval(timerRef.current);
    } catch {
      Alert.alert('Error', 'Failed to stop recording');
    } finally {
      setStopping(false);
    }
  };

  const isActive = recording?.status === 'active';
  const confidence = Math.min((recording?.interactionCount ?? 0) * 5, 100);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header title={recording?.name ?? 'Recording'} showBack />
      <View style={styles.content}>
        <View style={styles.timerRow}>
          {isActive && <Circle size={12} color={colors.accentError} fill={colors.accentError} />}
          <Text style={[styles.timer, { color: colors.textPrimary }]}>
            {formatDuration(elapsed)}
          </Text>
        </View>

        <Card variant="glass" padding="md">
          <Text style={[styles.stat, { color: colors.textSecondary }]}>Interactions</Text>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>
            {recording?.interactionCount ?? 0}
          </Text>
          <ConfidenceMeter value={confidence} label="confidence" style={styles.meter} />
        </Card>

        {recording?.url && (
          <Text style={[styles.url, { color: colors.textMuted }]} numberOfLines={1}>
            {recording.url}
          </Text>
        )}

        {recording?.code && (
          <CodeViewer code={recording.code} language={recording.framework} />
        )}

        {isActive ? (
          <Button variant="danger" size="lg" onPress={handleStop} disabled={stopping}>
            <Square size={16} color="#fff" />
            {stopping ? '  Stopping...' : '  Stop Recording'}
          </Button>
        ) : (
          <Button variant="primary" size="lg" onPress={() => router.back()}>
            Done
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: spacing.base, gap: spacing.lg },
  timerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  timer: { ...typography.largeTitle, fontVariant: ['tabular-nums'] },
  stat: { ...typography.caption1 },
  statValue: { ...typography.title1, fontWeight: '700' },
  meter: { marginTop: spacing.sm },
  url: { ...typography.caption1 },
});
