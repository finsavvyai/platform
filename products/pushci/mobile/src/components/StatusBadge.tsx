import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize } from '../theme';

type Status = 'passed' | 'failed' | 'running' | 'pending' | 'cancelled';

const statusColors: Record<Status, { bg: string; text: string }> = {
  passed: { bg: colors.successBg, text: colors.success },
  failed: { bg: colors.errorBg, text: colors.error },
  running: { bg: colors.warningBg, text: colors.warning },
  pending: { bg: '#27272a', text: colors.textSecondary },
  cancelled: { bg: '#27272a', text: colors.textMuted },
};

export default function StatusBadge({ status }: { status: Status }) {
  const c = statusColors[status] ?? statusColors.pending;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.text }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontSize: fontSize.xs, fontWeight: '600', textTransform: 'uppercase' },
});
