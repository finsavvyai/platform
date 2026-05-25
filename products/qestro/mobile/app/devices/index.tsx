import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Monitor, Smartphone, Tablet } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { devicesApi } from '../../src/lib/api';
import { radius, spacing, touchTarget, typography } from '../../src/theme/tokens';
import { Badge, Card } from '../../src/components/atoms';
import { Header, SearchBar, FilterChips } from '../../src/components/molecules';

interface Device { id: string; name: string; platform: string; status: string; provider: string; }

const FILTERS = [
  { id: 'available', label: 'Available' },
  { id: 'reserved', label: 'Reserved' },
  { id: 'offline', label: 'Offline' },
];

function getIcon(platform: string, color: string) {
  if (platform === 'ios') return <Smartphone size={18} color={color} />;
  if (platform === 'android') return <Tablet size={18} color={color} />;
  return <Monitor size={18} color={color} />;
}

export default function DevicesScreen() {
  const { colors } = useTheme();
  const [devices, setDevices] = useState<Device[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await devicesApi.getDevices(filter ? { status: filter } : undefined);
      if (res.data) setDevices(res.data as Device[]);
    } catch { /* silent */ }
    setRefreshing(false);
  }, [filter]);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const filtered = devices.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));

  const handleReserve = async (id: string) => {
    try {
      await devicesApi.reserveDevice(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchDevices();
    } catch {
      Alert.alert('Error', 'Failed to reserve device');
    }
  };

  const statusVariant = (s: string) => s === 'available' ? 'success' : s === 'reserved' ? 'warning' : 'secondary';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header title="Cloud Devices" showBack />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search devices..." />
      <FilterChips chips={FILTERS} selected={filter} onSelect={setFilter} />
      <FlatList
        data={filtered}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDevices(); }} tintColor={colors.accentPrimary} />}
        renderItem={({ item }) => (
          <Card variant="glass" padding="md">
            <View style={styles.deviceRow}>
              {getIcon(item.platform, colors.textSecondary)}
              <View style={styles.deviceInfo}>
                <Text style={[styles.deviceName, { color: colors.textPrimary }]}>{item.name}</Text>
                <Text style={[styles.deviceProvider, { color: colors.textMuted }]}>{item.provider}</Text>
              </View>
              <Badge variant={statusVariant(item.status)} size="xs">{item.status}</Badge>
            </View>
            {item.status === 'available' && (
              <Pressable style={[styles.reserveBtn, { backgroundColor: colors.accentPrimary }]} onPress={() => handleReserve(item.id)}>
                <Text style={styles.reserveText}>Reserve</Text>
              </Pressable>
            )}
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.base, gap: spacing.sm, paddingBottom: 100 },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  deviceInfo: { flex: 1 },
  deviceName: { ...typography.headline },
  deviceProvider: { ...typography.caption1 },
  reserveBtn: {
    marginTop: spacing.sm, alignSelf: 'flex-end', paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, borderRadius: radius.md, minHeight: touchTarget.minHeight - 8,
  },
  reserveText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
