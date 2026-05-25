import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize } from '../theme';
import type { Plan } from '../hooks/usePlan';

const planColors: Record<Plan, { bg: string; text: string }> = {
  free: { bg: '#27272a', text: colors.textSecondary },
  pro: { bg: colors.successBg, text: colors.success },
  team: { bg: '#78350f', text: '#fbbf24' },
};

export default function PlanBadge({ plan }: { plan: Plan }) {
  const c = planColors[plan];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.text }]}>
        {plan.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontSize: fontSize.xs, fontWeight: '700', letterSpacing: 0.8 },
});
