import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Video } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { recordingsApi } from '../../src/lib/api';
import { spacing, typography, touchTarget } from '../../src/theme/tokens';
import { Badge, Card, EmptyState, Skeleton } from '../../src/components/atoms';
import { Header, ConfidenceMeter } from '../../src/components/molecules';
import type { Recording } from '../../src/types';

function RecordingCard({ item, onPress }: { item: Recording; onPress: () => void }) {
  const { colors } = useTheme();
  const statusVariant = item.status === 'active' ? 'success' : item.status === 'completed' ? 'primary' : 'secondary';

  return (
    <Pressable onPress={onPress}>
      <Card variant="glass" padding="md">
        <View style={styles.cardHeader}>
          <Video size={16} color={colors.textSecondary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Badge variant={statusVariant} size="xs">{item.status}</Badge>
        </View>
        <Text style={[styles.cardUrl, { color: colors.textMuted }]} numberOfLines={1}>
          {item.url}
        </Text>
        <ConfidenceMeter value={Math.min(item.interactionCount * 5, 100)} label="confidence" style={styles.confidence} />
        <View style={styles.cardFooter}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>{item.interactionCount} interactions</Text>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>{item.framework}</Text>
        </View>
      </Card>
    </Pressable>
  );
}

export default function RecordingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRecordings = useCallback(async () => {
    try {
      const res = await recordingsApi.getRecordingSessions();
      if (res.data) setRecordings(res.data);
    } catch {
      // Handle silently
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRecordings();
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.content}>
          <Skeleton height={34} width={180} />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={90} style={{ marginTop: 12 }} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header title="Recording Studio" />
      <FlatList
        data={recordings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <RecordingCard item={item} onPress={() => router.push(`/recording/${item.id}` as never)} />
        )}
        ListEmptyComponent={
          <EmptyState
            title="No recordings"
            description="Start recording browser interactions to generate test code"
            actionLabel="New Recording"
            onAction={() => router.push('/recording/new')}
          />
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentPrimary} />
        }
      />
      <Pressable
        style={[styles.fab, { backgroundColor: colors.accentPrimary }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/recording/new');
        }}
        accessibilityLabel="Start new recording"
        accessibilityRole="button"
      >
        <Plus size={24} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.base },
  list: { padding: spacing.base, gap: spacing.md, paddingBottom: 100 },
  confidence: { marginTop: spacing.sm },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: { ...typography.headline, flex: 1 },
  cardUrl: { ...typography.caption1, marginTop: spacing.xs },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  footerText: { ...typography.caption1 },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: spacing.base,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: touchTarget.minWidth,
    minHeight: touchTarget.minHeight,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
