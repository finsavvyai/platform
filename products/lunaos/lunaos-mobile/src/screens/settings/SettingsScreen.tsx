/**
 * Settings screen — user info, tier, logout.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '../../hooks/useThemeColors';
import { spacing, radii, typography, TOUCH_TARGET } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/Button';

export function SettingsScreen(): React.ReactElement {
  const colors = useThemeColors();
  const { user, logout } = useAuthStore();

  const handleLogout = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  }, [logout]);

  const tierColor = user?.tier === 'free' ? colors.tierFree : colors.tierPro;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <View
        style={[
          styles.profileCard,
          { backgroundColor: colors.surface, borderColor: colors.cardBorder },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
          <Text style={styles.avatarText}>
            {(user?.name || user?.email || '?')[0]?.toUpperCase()}
          </Text>
        </View>

        <Text style={[styles.userName, { color: colors.textPrimary }]}>
          {user?.name || 'LunaOS User'}
        </Text>
        <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
          {user?.email}
        </Text>

        <View style={[styles.tierBadge, { backgroundColor: tierColor }]}>
          <Text style={styles.tierText}>
            {(user?.tier ?? 'free').toUpperCase()} PLAN
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          ACCOUNT
        </Text>

        <SettingsRow
          label="Subscription"
          value={user?.tier === 'pro' ? 'Pro' : 'Free'}
          colors={colors}
        />
        <SettingsRow
          label="User ID"
          value={user?.id?.slice(0, 8) ?? '---'}
          colors={colors}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          ABOUT
        </Text>
        <SettingsRow label="Version" value="0.1.0" colors={colors} />
        <SettingsRow label="Build" value="1" colors={colors} />
      </View>

      <Button
        title="Sign Out"
        onPress={handleLogout}
        variant="destructive"
        style={styles.logoutButton}
      />
    </ScrollView>
    </SafeAreaView>
  );
}

interface SettingsRowProps {
  label: string;
  value: string;
  colors: ReturnType<typeof useThemeColors>;
}

function SettingsRow({ label, value, colors }: SettingsRowProps): React.ReactElement {
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.separator }]}
      activeOpacity={0.6}
      accessibilityRole="button"
    >
      <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
        {label}
      </Text>
      <Text style={[styles.rowValue, { color: colors.textTertiary }]}>
        {value}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  profileCard: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  userName: { ...typography.title2, marginBottom: 2 },
  userEmail: { ...typography.subheadline, marginBottom: spacing.sm },
  tierBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  tierText: {
    ...typography.caption,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    ...typography.footnote,
    fontWeight: '600',
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: TOUCH_TARGET,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.xs,
  },
  rowLabel: { ...typography.body },
  rowValue: { ...typography.body },
  logoutButton: { marginTop: spacing.md },
});
