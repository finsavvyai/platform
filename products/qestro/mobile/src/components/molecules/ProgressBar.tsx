import { useEffect } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { radius, spacing, typography } from '../../theme/tokens';

interface ProgressBarProps {
  progress: number;
  color?: string;
  label?: string;
  showPercent?: boolean;
  height?: number;
  style?: ViewStyle;
}

export function ProgressBar({
  progress,
  color,
  label,
  showPercent = false,
  height = 6,
  style,
}: ProgressBarProps) {
  const { colors } = useTheme();
  const fillWidth = useSharedValue(0);
  const barColor = color ?? colors.accentPrimary;
  const clamped = Math.min(Math.max(progress, 0), 100);

  useEffect(() => {
    fillWidth.value = withTiming(clamped, { duration: 500 });
  }, [clamped, fillWidth]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${fillWidth.value}%`,
  }));

  return (
    <View style={[styles.wrapper, style]}>
      {(label || showPercent) && (
        <View style={styles.labelRow}>
          {label && (
            <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
          )}
          {showPercent && (
            <Text style={[styles.percent, { color: colors.textMuted }]}>
              {Math.round(clamped)}%
            </Text>
          )}
        </View>
      )}
      <View style={[styles.track, { height, backgroundColor: colors.bgTertiary }]}>
        <Animated.View
          style={[styles.fill, { height, backgroundColor: barColor }, animatedStyle]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { ...typography.caption1 },
  percent: { ...typography.caption1, fontWeight: '600' },
  track: { borderRadius: radius.pill, overflow: 'hidden' },
  fill: { borderRadius: radius.pill },
});
