import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CreditCard, ExternalLink } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { billingApi } from '../../src/lib/api';
import { radius, spacing, touchTarget, typography } from '../../src/theme/tokens';
import { Badge, Card, Skeleton } from '../../src/components/atoms';
import { Header } from '../../src/components/molecules';
import type { BillingPlan } from '../../src/types';

export default function BillingScreen() {
  const { colors } = useTheme();
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [subscription, setSub] = useState<{ planId?: string; status?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [pr, sr] = await Promise.all([billingApi.getBillingPlans(), billingApi.getSubscription()]);
      if (pr.data) setPlans(pr.data);
      if (sr.data) setSub(sr.data as { planId?: string; status?: string });
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpgrade = async (planId: string) => {
    try {
      const res = await billingApi.createCheckout({ planId });
      if (res.data?.url) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await WebBrowser.openBrowserAsync(res.data.url);
      }
    } catch { Alert.alert('Error', 'Failed to start checkout'); }
  };

  const handleManage = async () => {
    try {
      const res = await billingApi.getBillingPortal();
      if (res.data?.url) await WebBrowser.openBrowserAsync(res.data.url);
    } catch { Alert.alert('Error', 'Failed to open billing portal'); }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.content}><Skeleton height={34} width={140} /><Skeleton height={120} style={{ marginTop: 12 }} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header title="Billing" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        {subscription && (
          <Card variant="glass" padding="md">
            <View style={styles.subRow}>
              <CreditCard size={18} color={colors.accentPrimary} />
              <Text style={[styles.subTitle, { color: colors.textPrimary }]}>Current Plan</Text>
              <Badge variant="success" size="xs">{subscription.status ?? 'active'}</Badge>
            </View>
            <Pressable style={[styles.manageBtn, { borderColor: colors.borderColor }]} onPress={handleManage}>
              <Text style={[styles.manageTxt, { color: colors.accentPrimary }]}>Manage Billing</Text>
              <ExternalLink size={14} color={colors.accentPrimary} />
            </Pressable>
          </Card>
        )}
        <Text style={[styles.section, { color: colors.textPrimary }]}>Available Plans</Text>
        {plans.map((plan) => {
          const isCurrent = subscription?.planId === plan.id;
          return (
            <Card key={plan.id} variant="glass" padding="md">
              <View style={styles.planHeader}>
                <Text style={[styles.planName, { color: colors.textPrimary }]}>{plan.name}</Text>
                <Text style={[styles.planPrice, { color: colors.accentPrimary }]}>${plan.price}/{plan.interval === 'monthly' ? 'mo' : 'yr'}</Text>
              </View>
              {plan.features.slice(0, 3).map((f) => (
                <Text key={f} style={[styles.feature, { color: colors.textSecondary }]}>- {f}</Text>
              ))}
              {!isCurrent && (
                <Pressable style={[styles.upgradeBtn, { backgroundColor: colors.accentPrimary }]} onPress={() => handleUpgrade(plan.id)}>
                  <Text style={styles.upgradeTxt}>Upgrade</Text>
                </Pressable>
              )}
              {isCurrent && <Badge variant="primary" size="xs" style={styles.badge}>Current</Badge>}
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.base, gap: spacing.md },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  subTitle: { ...typography.headline, flex: 1 },
  manageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md,
    alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: touchTarget.minHeight - 8,
  },
  manageTxt: { fontSize: 13, fontWeight: '600' },
  section: { ...typography.title3, fontWeight: '600' },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  planName: { ...typography.headline },
  planPrice: { ...typography.headline, fontWeight: '700' },
  feature: { ...typography.caption1, marginTop: 2 },
  upgradeBtn: { marginTop: spacing.md, alignSelf: 'flex-end', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  upgradeTxt: { color: '#fff', fontWeight: '600', fontSize: 13 },
  badge: { marginTop: spacing.md },
});
