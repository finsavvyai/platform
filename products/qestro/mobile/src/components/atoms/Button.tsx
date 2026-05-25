import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';
import { radius, spacing, touchTarget } from '../../theme/tokens';
import type { ReactNode } from 'react';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'glass';

export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  onPress?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  children: ReactNode;
  style?: ViewStyle;
  testID?: string;
}

export function Button({
  variant = 'primary',
  size = 'md',
  onPress,
  disabled = false,
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  children,
  style,
  testID,
}: ButtonProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handlePress = () => {
    if (disabled || isLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  const variantStyles = getVariantStyles(variant, colors);
  const sizeStyles = getSizeStyles(size);
  const isDisabled = disabled || isLoading;

  return (
    <AnimatedPressable
      testID={testID}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      style={[
        styles.base,
        variantStyles.container,
        sizeStyles.container,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        animatedStyle,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={variantStyles.textColor} />
      ) : (
        <>
          {leftIcon}
          <Text
            style={[
              styles.text,
              sizeStyles.text,
              { color: variantStyles.textColor },
              leftIcon ? { marginLeft: spacing.sm } : undefined,
              rightIcon ? { marginRight: spacing.sm } : undefined,
            ]}
          >
            {children}
          </Text>
          {rightIcon}
        </>
      )}
    </AnimatedPressable>
  );
}

type VColors = ReturnType<typeof useTheme>['colors'];
type VResult = { container: ViewStyle; textColor: string };

function getVariantStyles(v: ButtonVariant, c: VColors): VResult {
  const map: Record<ButtonVariant, VResult> = {
    primary: { container: { backgroundColor: c.accentPrimary }, textColor: '#fff' },
    secondary: { container: { backgroundColor: c.bgTertiary }, textColor: c.textPrimary },
    outline: { container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.borderColor }, textColor: c.textPrimary },
    ghost: { container: { backgroundColor: 'transparent' }, textColor: c.accentPrimary },
    danger: { container: { backgroundColor: c.accentError }, textColor: '#fff' },
    glass: { container: { backgroundColor: c.glassBg, borderWidth: 1, borderColor: c.glassBorder }, textColor: c.textPrimary },
  };
  return map[v];
}

type SResult = { container: ViewStyle; text: { fontSize: number } };

function getSizeStyles(s: ButtonSize): SResult {
  const map: Record<ButtonSize, SResult> = {
    sm: { container: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 36 }, text: { fontSize: 14 } },
    md: { container: { paddingHorizontal: spacing.base, paddingVertical: spacing.md, minHeight: touchTarget.minHeight }, text: { fontSize: 15 } },
    lg: { container: { paddingHorizontal: spacing.lg, paddingVertical: spacing.base, minHeight: 52 }, text: { fontSize: 17 } },
  };
  return map[s];
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    minWidth: touchTarget.minWidth,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: '600',
  },
});
