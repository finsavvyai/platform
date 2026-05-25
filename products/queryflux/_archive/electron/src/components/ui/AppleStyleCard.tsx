import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

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
  hoverable?: boolean; // Electron-specific hover effect
  onHover?: (hovered: boolean) => void; // Electron-specific hover callback
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
  hoverable = false,
  onHover,
  ...props
}) => {
  const { theme } = useTheme();
  const [isHovered, setIsHovered] = React.useState(false);

  const getCardStyles = () => {
    const baseStyles = {
      backgroundColor: theme.colors.surface,
      borderRadius: borderRadius || (size === 'small' ? 8 : size === 'large' ? 16 : 12),
      overflow: 'hidden' as const,
      transition: 'all 0.2s ease-in-out', // Electron-specific transition
      cursor: onPress ? 'pointer' : 'default',
      userSelect: 'none' as const,
    };

    switch (variant) {
      case 'primary':
        return {
          ...baseStyles,
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderWidth: 1,
          borderStyle: 'solid' as const,
        };
      case 'secondary':
        return {
          ...baseStyles,
          backgroundColor: 'transparent',
          borderColor: theme.colors.border,
          borderWidth: 1,
          borderStyle: 'solid' as const,
        };
      case 'elevated':
        return {
          ...baseStyles,
          backgroundColor: theme.colors.surface,
          boxShadow: shadow ? '0 4px 16px rgba(0, 0, 0, 0.1)' : 'none',
          ...(isHovered && hoverable && {
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
            transform: 'translateY(-2px)',
          }),
        };
      case 'outlined':
        return {
          ...baseStyles,
          backgroundColor: 'transparent',
          borderColor: theme.colors.border,
          borderWidth: 2,
          borderStyle: 'solid' as const,
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

  const handleMouseEnter = () => {
    if (hoverable && !disabled) {
      setIsHovered(true);
      onHover?.(true);
    }
  };

  const handleMouseLeave = () => {
    if (hoverable) {
      setIsHovered(false);
      onHover?.(false);
    }
  };

  const cardStyles = StyleSheet.create({
    card: {
      ...getCardStyles(),
      padding: getPadding(),
      margin: getMargin(),
      opacity: disabled ? 0.6 : 1,
      boxSizing: 'border-box' as const,
    },
    touchable: {
      // Web-specific touch feedback for Electron
      outline: 'none',
      WebkitTapHighlightColor: 'transparent',
      '&:focus': {
        boxShadow: `0 0 0 2px ${theme.colors.primary}40`,
      },
      '&:active': {
        transform: 'scale(0.98)',
        transition: 'transform 0.1s ease-in-out',
      },
    },
  });

  const CardComponent = onPress ? TouchableOpacity : View;

  return (
    <CardComponent
      style={[
        cardStyles.card,
        onPress && cardStyles.touchable,
        style,
        isHovered && hoverable && {
          backgroundColor: theme.colors.surfaceHover || theme.colors.surface,
        }
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={onPress ? 0.7 : 1}
      accessibilityRole={onPress ? 'button' : 'none'}
      accessibilityState={{ disabled }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...(onPress ? props : {})}
    >
      {children}
    </CardComponent>
  );
};

export default AppleStyleCard;