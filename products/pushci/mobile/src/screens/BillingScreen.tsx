import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../hooks/useAuth';
import { usePlan } from '../hooks/usePlan';
import PlanBadge from '../components/PlanBadge';
import Card from '../components/Card';
import { API_BASE_URL } from '../config';
import { colors, spacing, fontSize } from '../theme';

interface Usage { ai_usage: number; ai_limit: number }

const plans = [
  { id: 'free', name: 'Free', price: '$0', features: ['Unlimited local runs', '3 projects', 'Community support'] },
  { id: 'pro', name: 'Pro', price: '$9/mo', features: ['Cloud runners', 'AI diagnosis', 'Priority support', '50 projects'] },
  { id: 'team', name: 'Team', price: '$29/mo', features: ['Everything in Pro', 'Team RBAC', 'Audit logs', 'SSO', 'Unlimited projects'] },
] as const;

export default function BillingScreen() {
  const { token } = useAuth();
  const { plan } = usePlan();
  const [usage, setUsage] = useState<Usage>({ ai_usage: 0, ai_limit: 0 });

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/api/user/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d: { ai_usage?: number; ai_limit?: number }) => {
        setUsage({ ai_usage: d.ai_usage ?? 0, ai_limit: d.ai_limit ?? 0 });
      })
      .catch(() => {});
  }, [token]);

  async function handleCheckout(planId: string) {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json() as { url?: string };
      if (data.url) await WebBrowser.openBrowserAsync(data.url);
    } catch { /* ignore */ }
  }

  const pct = usage.ai_limit > 0 ? Math.min(usage.ai_usage / usage.ai_limit, 1) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>Billing</Text>

        <Card style={{ marginBottom: spacing.lg }}>
          <View style={styles.planRow}>
            <Text style={styles.label}>Current Plan</Text>
            <PlanBadge plan={plan} />
          </View>
          {usage.ai_limit > 0 && (
            <View style={styles.usageSection}>
              <Text style={styles.usageLabel}>AI Usage: {usage.ai_usage} / {usage.ai_limit}</Text>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
              </View>
            </View>
          )}
        </Card>

        {plans.map((p) => (
          <Card key={p.id} style={{ marginBottom: spacing.md }}>
            <View style={styles.planHeader}>
              <Text style={styles.planName}>{p.name}</Text>
              <Text style={styles.planPrice}>{p.price}</Text>
            </View>
            {p.features.map((f) => (
              <Text key={f} style={styles.feature}>{f}</Text>
            ))}
            {p.id !== 'free' && p.id !== plan && (
              <TouchableOpacity style={styles.upgradeBtn} onPress={() => void handleCheckout(p.id)}>
                <Text style={styles.upgradeBtnText}>Upgrade to {p.name}</Text>
              </TouchableOpacity>
            )}
            {p.id === plan && (
              <Text style={styles.currentLabel}>Current plan</Text>
            )}
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 48 },
  header: { fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.lg },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: fontSize.sm, color: colors.textSecondary },
  usageSection: { marginTop: spacing.md },
  usageLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: 6 },
  barBg: { height: 6, borderRadius: 3, backgroundColor: '#27272a' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  planName: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary },
  planPrice: { fontSize: fontSize.md, fontWeight: '600', color: colors.accent },
  feature: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4, paddingLeft: 8 },
  upgradeBtn: { marginTop: spacing.md, backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  upgradeBtnText: { color: colors.black, fontWeight: '600', fontSize: fontSize.sm },
  currentLabel: { marginTop: spacing.md, fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center' },
});
