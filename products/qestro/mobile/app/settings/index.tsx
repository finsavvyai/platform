import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bell, ChevronRight, LogOut, Moon, Shield, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { useAuthStore } from '../../src/stores/authStore';
import { radius, spacing, touchTarget, typography } from '../../src/theme/tokens';
import { Header } from '../../src/components/molecules';

function SettingsRow({ icon, label, onPress, trailing }: {
  icon: React.ReactNode; label: string; onPress?: () => void; trailing?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable style={[styles.row, { borderBottomColor: colors.borderColor }]} onPress={onPress} accessibilityRole="button">
      <View style={styles.rowLeft}>
        {icon}
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
      </View>
      {trailing ?? <ChevronRight size={16} color={colors.textMuted} />}
    </Pressable>
  );
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: colors.textMuted }]}>{title}</Text>
      <View style={[styles.groupCard, { backgroundColor: colors.bgSecondary }]}>{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => { logout(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header title="Settings" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.profileCard, { backgroundColor: colors.bgSecondary }]}>
          <View style={[styles.avatar, { backgroundColor: colors.accentPrimary }]}>
            <Text style={styles.avatarText}>{(user?.name?.[0] ?? 'U').toUpperCase()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.textPrimary }]}>{user?.name ?? 'User'}</Text>
            <Text style={[styles.profileEmail, { color: colors.textMuted }]}>{user?.email ?? ''}</Text>
          </View>
        </View>

        <SettingsGroup title="PREFERENCES">
          <SettingsRow icon={<Moon size={18} color={colors.textSecondary} />} label="Dark Mode"
            trailing={<Switch value={isDark} onValueChange={toggleTheme} trackColor={{ true: colors.accentPrimary }} />} />
          <SettingsRow icon={<Bell size={18} color={colors.textSecondary} />} label="Notifications"
            onPress={() => router.push('/notifications')} />
        </SettingsGroup>

        <SettingsGroup title="ACCOUNT">
          <SettingsRow icon={<User size={18} color={colors.textSecondary} />} label="Profile" />
          <SettingsRow icon={<Shield size={18} color={colors.textSecondary} />} label="Security" />
        </SettingsGroup>

        <SettingsGroup title="">
          <SettingsRow icon={<LogOut size={18} color={colors.accentError} />} label="Log Out"
            onPress={handleLogout} trailing={null} />
        </SettingsGroup>

        <Text style={[styles.version, { color: colors.textMuted }]}>Qestro v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.base, gap: spacing.lg },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.card },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  profileInfo: { flex: 1 },
  profileName: { ...typography.headline },
  profileEmail: { ...typography.caption1 },
  group: { gap: spacing.xs },
  groupTitle: { ...typography.caption1, fontWeight: '600', paddingHorizontal: spacing.sm },
  groupCard: { borderRadius: radius.card, overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, minHeight: touchTarget.minHeight,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowLabel: { ...typography.body },
  version: { ...typography.caption1, textAlign: 'center' },
});
