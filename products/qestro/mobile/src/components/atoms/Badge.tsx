import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { radius, spacing } from '../../theme/tokens';
import type { ReactNode } from 'react';

export type BadgeVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | 'outline'
  | 'glass';

export type BadgeSize = 'xs' | 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: ReactNode;
  children: ReactNode;
  style?: ViewStyle;
}

export function Badge({
  variant = 'primary',
  size = 'sm',
  icon,
  children,
  style,
}: BadgeProps) {
  const { colors } = useTheme();
  const variantStyles = getVariantStyles(variant, colors);
  const sizeStyles = getSizeStyles(size);

  return (
    <View
      style={[styles.base, variantStyles.container, sizeStyles.container, style]}
      accessibilityRole="text"
    >
      {icon && <View style={{ marginRight: spacing.xs }}>{icon}</View>}
      <Text style={[sizeStyles.text, { color: variantStyles.textColor }]}>
        {children}
      </Text>
    </View>
  );
}

function getVariantStyles(variant: BadgeVariant, colors: ReturnType<typeof useTheme>['colors']) {
  switch (variant) {
    case 'primary':
      return {
        container: { backgroundColor: `${colors.accentPrimary}33` } as ViewStyle,
        textColor: colors.accentPrimary,
      };
    case 'secondary':
      return {
        container: { backgroundColor: colors.bgTertiary } as ViewStyle,
        textColor: colors.textSecondary,
      };
    case 'success':
      return {
        container: { backgroundColor: `${colors.accentSuccess}33` } as ViewStyle,
        textColor: colors.accentSuccess,
      };
    case 'warning':
      return {
        container: { backgroundColor: `${colors.accentWarning}33` } as ViewStyle,
        textColor: colors.accentWarning,
      };
    case 'error':
      return {
        container: { backgroundColor: `${colors.accentError}33` } as ViewStyle,
        textColor: colors.accentError,
      };
    case 'outline':
      return {
        container: {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.borderColor,
        } as ViewStyle,
        textColor: colors.textPrimary,
      };
    case 'glass':
      return {
        container: {
          backgroundColor: colors.glassBg,
          borderWidth: 1,
          borderColor: colors.glassBorder,
        } as ViewStyle,
        textColor: colors.textPrimary,
      };
  }
}

function getSizeStyles(size: BadgeSize) {
  switch (size) {
    case 'xs':
      return {
        container: { paddingHorizontal: 6, paddingVertical: 2 } as ViewStyle,
        text: { fontSize: 10, fontWeight: '600' as const },
      };
    case 'sm':
      return {
        container: {
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
        } as ViewStyle,
        text: { fontSize: 12, fontWeight: '600' as const },
      };
    case 'md':
      return {
        container: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
        } as ViewStyle,
        text: { fontSize: 14, fontWeight: '600' as const },
      };
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
});
