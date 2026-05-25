import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { radius, spacing, typography } from '../../theme/tokens';

interface ConfidenceMeterProps {
  value: number;
  label?: string;
  style?: ViewStyle;
}

function getColor(value: number, colors: ReturnType<typeof useTheme>['colors']): string {
  if (value >= 80) return colors.accentSuccess;
  if (value >= 50) return colors.accentWarning;
  return colors.accentError;
}

export function ConfidenceMeter({ value, label, style }: ConfidenceMeterProps) {
  const { colors } = useTheme();
  const clamped = Math.min(Math.max(value, 0), 100);
  const color = getColor(clamped, colors);

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>}
      <View style={styles.row}>
        <View style={[styles.track, { backgroundColor: colors.bgTertiary }]}>
          <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: color }]} />
        </View>
        <Text style={[styles.value, { color }]}>{Math.round(clamped)}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 2 },
  label: { ...typography.caption2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: { flex: 1, height: 4, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  value: { ...typography.caption1, fontWeight: '600', width: 36, textAlign: 'right' },
});
