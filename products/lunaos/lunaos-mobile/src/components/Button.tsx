/**
 * Primary button with loading state. 44px min touch target.
 */

import React, { useCallback } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../hooks/useThemeColors';
import { spacing, radii, typography, TOUCH_TARGET } from '../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive';
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
}: ButtonProps): React.ReactElement {
  const colors = useThemeColors();
  const isDisabled = disabled || loading;

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  const bgColor = {
    primary: colors.accent,
    secondary: colors.fill,
    destructive: colors.destructive,
  }[variant];

  const textColor = variant === 'secondary' ? colors.accent : '#FFFFFF';

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[
        styles.button,
        { backgroundColor: bgColor, opacity: isDisabled ? 0.5 : 1 },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text style={[styles.text, { color: textColor }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: TOUCH_TARGET,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...typography.headline,
  },
});
