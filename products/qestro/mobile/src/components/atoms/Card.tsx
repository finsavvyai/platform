import { StyleSheet, View, type ViewStyle, type ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../hooks/useTheme';
import { radius, spacing, shadows } from '../../theme/tokens';
import type { ReactNode } from 'react';

export type CardVariant = 'default' | 'glass' | 'elevated' | 'flat';
type CardPadding = 'none' | 'sm' | 'md' | 'lg' | 'xl';

interface CardProps extends ViewProps {
  variant?: CardVariant;
  padding?: CardPadding;
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  style?: ViewStyle;
}

const paddingMap: Record<CardPadding, number> = {
  none: 0,
  sm: spacing.sm,
  md: spacing.base,
  lg: spacing.lg,
  xl: spacing['2xl'],
};

export function Card({
  variant = 'default',
  padding = 'md',
  header,
  footer,
  children,
  style,
  ...rest
}: CardProps) {
  const { colors, isDark } = useTheme();
  const padVal = paddingMap[padding];

  if (variant === 'glass') {
    return (
      <BlurView
        intensity={isDark ? 20 : 40}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.base,
          {
            borderColor: colors.glassBorder,
            borderWidth: 1,
            overflow: 'hidden',
          },
          style,
        ]}
        {...rest}
      >
        {header && <View style={styles.header}>{header}</View>}
        <View style={{ padding: padVal }}>{children}</View>
        {footer && <View style={styles.footer}>{footer}</View>}
      </BlurView>
    );
  }

  const variantStyles = getVariantStyles(variant, colors);

  return (
    <View style={[styles.base, variantStyles, { padding: padVal }, style]} {...rest}>
      {header && <View style={styles.header}>{header}</View>}
      {children}
      {footer && <View style={styles.footer}>{footer}</View>}
    </View>
  );
}

function getVariantStyles(
  variant: CardVariant,
  colors: ReturnType<typeof useTheme>['colors'],
): ViewStyle {
  switch (variant) {
    case 'default':
      return {
        backgroundColor: colors.cardBg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        ...shadows.md,
      };
    case 'elevated':
      return {
        backgroundColor: colors.bgSecondary,
        ...shadows.lg,
      };
    case 'flat':
      return {
        backgroundColor: colors.bgSecondary,
      };
    case 'glass':
      return {};
  }
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
});
