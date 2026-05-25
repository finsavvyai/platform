import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link2, RefreshCw, Unlink } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { integrationsApi } from '../../src/lib/api';
import { radius, spacing, touchTarget, typography } from '../../src/theme/tokens';
import { Badge, Card, EmptyState } from '../../src/components/atoms';
import { Header } from '../../src/components/molecules';
import type { Integration } from '../../src/types';

export default function IntegrationsScreen() {
  const { colors } = useTheme();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await integrationsApi.getIntegrations();
      if (res.data) setIntegrations(res.data);
    } catch { /* silent */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSync = async (id: string) => {
    try {
      await integrationsApi.syncIntegration(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchData();
    } catch { Alert.alert('Error', 'Failed to sync'); }
  };

  const handleDisconnect = (id: string) => {
    Alert.alert('Disconnect', 'Disconnect this integration?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive', onPress: async () => {
          try {
            await integrationsApi.deleteIntegration(id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setIntegrations((prev) => prev.filter((i) => i.id !== id));
          } catch { Alert.alert('Error', 'Failed to disconnect'); }
        },
      },
    ]);
  };

  const statusVariant = (s: string) => s === 'connected' ? 'success' : s === 'error' ? 'error' : 'secondary';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header title="Integrations" showBack />
      <FlatList
        data={integrations}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.accentPrimary} />}
        ListEmptyComponent={!loading ? <EmptyState title="No integrations" description="Connect services to enhance your workflow" /> : null}
        renderItem={({ item }) => (
          <Card variant="glass" padding="md">
            <View style={styles.intRow}>
              <Link2 size={18} color={colors.accentPrimary} />
              <View style={styles.intInfo}>
                <Text style={[styles.intName, { color: colors.textPrimary }]}>{item.name}</Text>
                <Text style={[styles.intType, { color: colors.textMuted }]}>{item.type}</Text>
              </View>
              <Badge variant={statusVariant(item.status)} size="xs">{item.status}</Badge>
            </View>
            <View style={styles.actions}>
              {item.status === 'connected' && (
                <Pressable style={[styles.actionBtn, { borderColor: colors.borderColor }]} onPress={() => handleSync(item.id)}>
                  <RefreshCw size={14} color={colors.accentPrimary} />
                  <Text style={[styles.actionTxt, { color: colors.accentPrimary }]}>Sync</Text>
                </Pressable>
              )}
              <Pressable style={[styles.actionBtn, { borderColor: colors.borderColor }]} onPress={() => handleDisconnect(item.id)}>
                <Unlink size={14} color={colors.accentError} />
                <Text style={[styles.actionTxt, { color: colors.accentError }]}>Disconnect</Text>
              </Pressable>
            </View>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.base, gap: spacing.sm, paddingBottom: 100 },
  intRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  intInfo: { flex: 1 },
  intName: { ...typography.headline },
  intType: { ...typography.caption1 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: touchTarget.minHeight - 12,
  },
  actionTxt: { fontSize: 12, fontWeight: '600' },
});
