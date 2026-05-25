import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native';
import { useTheme } from '@context';

// Apple HIG Card Styles
type CardVariant = 'primary' | 'secondary' | 'elevated' | 'outlined';
type CardSize = 'small' | 'medium' | 'large';

interface AppleStyleCardProps extends TouchableOpacityProps {
  children: React.ReactNode;
  variant?: CardVariant;
  size?: CardSize;
  padding?: number;
  margin?: number;
  borderRadius?: number;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  shadow?: boolean;
}

const AppleStyleCard: React.FC<AppleStyleCardProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  padding,
  margin,
  borderRadius,
  onPress,
  disabled = false,
  style,
  shadow = true,
  ...props
}) => {
  const { theme } = useTheme();

  const getCardStyles = () => {
    const baseStyles = {
      backgroundColor: theme.colors.surface,
      borderRadius: borderRadius || (size === 'small' ? 8 : size === 'large' ? 16 : 12),
      overflow: 'hidden' as const,
    };

    switch (variant) {
      case 'primary':
        return {
          ...baseStyles,
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderWidth: 1,
        };
      case 'secondary':
        return {
          ...baseStyles,
          backgroundColor: 'transparent',
          borderColor: theme.colors.border,
          borderWidth: 1,
        };
      case 'elevated':
        return {
          ...baseStyles,
          backgroundColor: theme.colors.surface,
          ...Platform.select({
            ios: {
              // Apple HIG card shadow
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
            },
            android: {
              elevation: 4,
            },
          }),
        };
      case 'outlined':
        return {
          ...baseStyles,
          backgroundColor: 'transparent',
          borderColor: theme.colors.border,
          borderWidth: 2,
        };
      default:
        return baseStyles;
    }
  };

  const getPadding = () => {
    if (padding !== undefined) return padding;
    switch (size) {
      case 'small':
        return theme.spacing.sm;
      case 'medium':
        return theme.spacing.md;
      case 'large':
        return theme.spacing.lg;
      default:
        return theme.spacing.md;
    }
  };

  const getMargin = () => {
    if (margin !== undefined) return margin;
    return theme.spacing.sm;
  };

  const cardStyles = StyleSheet.create({
    card: {
      ...getCardStyles(),
      padding: getPadding(),
      margin: getMargin(),
      opacity: disabled ? 0.6 : 1,
    },
    touchable: {
      // Apple HIG touch feedback
      ...Platform.select({
        ios: {
          // iOS provides native touch feedback
        },
        android: {
          // Android ripple effect
          borderRadius: borderRadius || (size === 'small' ? 8 : size === 'large' ? 16 : 12),
        },
      }),
    },
  });

  const CardComponent = onPress ? TouchableOpacity : View;

  return (
    <CardComponent
      style={[cardStyles.card, onPress && cardStyles.touchable, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={onPress ? 0.7 : 1}
      accessibilityRole={onPress ? 'button' : 'none'}
      accessibilityState={{ disabled }}
      {...(onPress ? props : {})}
    >
      {children}
    </CardComponent>
  );
};

export default AppleStyleCard;