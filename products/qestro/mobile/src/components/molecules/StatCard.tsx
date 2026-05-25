import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Card } from '../atoms';
import { spacing, typography } from '../../theme/tokens';

interface StatCardProps {
  label: string;
  value: number | string;
  color: string;
  suffix?: string;
  subtitle?: string;
}

export function StatCard({ label, value, color, suffix, subtitle }: StatCardProps) {
  const { colors } = useTheme();
  return (
    <Card variant="glass" padding="md" style={styles.card}>
      <View style={styles.row}>
        <Text style={[styles.value, { color }]}>
          {value}
          {suffix && <Text style={styles.suffix}>{suffix}</Text>}
        </Text>
      </View>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      {subtitle && (
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: '45%' },
  row: { flexDirection: 'row', alignItems: 'baseline' },
  value: { ...typography.title1, marginBottom: spacing.xs },
  suffix: { fontSize: 16, fontWeight: '400' },
  label: { ...typography.caption1 },
  subtitle: { ...typography.caption2, marginTop: 2 },
});
