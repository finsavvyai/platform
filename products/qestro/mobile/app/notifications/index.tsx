import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { notificationsApi } from '../../src/lib/api';
import { spacing, typography } from '../../src/theme/tokens';
import { Button, Card, EmptyState } from '../../src/components/atoms';
import { Header } from '../../src/components/molecules';
import type { NotificationRule } from '../../src/types';

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRules = useCallback(async () => {
    try {
      const res = await notificationsApi.getNotificationRules();
      if (res.data) setRules(res.data);
    } catch { /* silent */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleToggle = async (id: string) => {
    try {
      await notificationsApi.toggleNotificationRule(id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setRules((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));
    } catch { Alert.alert('Error', 'Failed to toggle rule'); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Rule', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await notificationsApi.deleteNotificationRule(id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setRules((prev) => prev.filter((r) => r.id !== id));
          } catch { Alert.alert('Error', 'Failed to delete rule'); }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header title="Notification Rules" showBack />
      <FlatList
        data={rules}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRules(); }} tintColor={colors.accentPrimary} />}
        ListEmptyComponent={!loading ? <EmptyState title="No rules" description="Create notification rules to stay informed" /> : null}
        renderItem={({ item }) => (
          <Card variant="glass" padding="md">
            <View style={styles.ruleRow}>
              <Bell size={16} color={colors.textSecondary} />
              <View style={styles.ruleInfo}>
                <Text style={[styles.ruleName, { color: colors.textPrimary }]}>{item.name}</Text>
                <Text style={[styles.ruleDetail, { color: colors.textMuted }]}>{item.event} → {item.channel}</Text>
              </View>
              <Switch value={item.enabled} onValueChange={() => handleToggle(item.id)} trackColor={{ true: colors.accentPrimary }} />
            </View>
            <Button variant="ghost" size="sm" onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
              <Trash2 size={14} color={colors.accentError} />
            </Button>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.base, gap: spacing.sm, paddingBottom: 100 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ruleInfo: { flex: 1 },
  ruleName: { ...typography.headline },
  ruleDetail: { ...typography.caption1 },
  deleteBtn: { alignSelf: 'flex-end', marginTop: spacing.xs },
});
