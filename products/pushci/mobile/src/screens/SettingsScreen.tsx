import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { usePlan } from '../hooks/usePlan';
import PlanBadge from '../components/PlanBadge';
import Card from '../components/Card';
import { colors, spacing, fontSize } from '../theme';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { plan } = usePlan();

  if (!user) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>Settings</Text>

        <Card style={{ marginBottom: spacing.lg }}>
          <View style={styles.profileRow}>
            {user.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>
                  {(user.name || user.login).charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{user.name || user.login}</Text>
              <Text style={styles.login}>@{user.login}</Text>
            </View>
            <PlanBadge plan={plan} />
          </View>
        </Card>

        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Provider</Text>
            <Text style={styles.rowValue}>{user.provider ?? 'GitHub'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Plan</Text>
            <Text style={styles.rowValue}>{plan.charAt(0).toUpperCase() + plan.slice(1)}</Text>
          </View>
        </Card>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 48 },
  header: { fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.lg },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: spacing.md },
  avatarFallback: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  profileInfo: { flex: 1 },
  name: { fontSize: fontSize.lg, fontWeight: '600', color: colors.textPrimary },
  login: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.surfaceBorder },
  rowLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  rowValue: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '500' },
  logoutBtn: {
    backgroundColor: '#27272a', borderRadius: 10, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: colors.surfaceBorder,
  },
  logoutText: { color: colors.error, fontWeight: '600', fontSize: fontSize.md },
});
