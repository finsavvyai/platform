import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

// Apple HIG Button Styles
type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';
type ButtonSize = 'small' | 'medium' | 'large';

interface AppleStyleButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: any;
  onPress?: () => void;
}

const AppleStyleButton: React.FC<AppleStyleButtonProps> = ({
  title,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
  onPress,
  ...props
}) => {
  const { theme } = useTheme();

  const getButtonStyles = () => {
    const baseStyles = {
      borderRadius: getBorderRadius(),
      paddingHorizontal: getHorizontalPadding(),
      paddingVertical: getVerticalPadding(),
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      flexDirection: 'row' as const,
      minWidth: getMinWidth(),
      height: getHeight(),
      cursor: disabled || loading ? 'not-allowed' : 'pointer',
      transition: 'all 0.2s ease-in-out',
      outline: 'none',
      WebkitTapHighlightColor: 'transparent',
      boxSizing: 'border-box' as const,
    };

    switch (variant) {
      case 'primary':
        return {
          ...baseStyles,
          backgroundColor: disabled ? theme.colors.disabled : theme.colors.primary,
          '&:hover:not(:disabled)': {
            backgroundColor: theme.colors.primaryHover,
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          },
          '&:active:not(:disabled)': {
            transform: 'translateY(0)',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
          },
        };
      case 'secondary':
        return {
          ...baseStyles,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: disabled ? theme.colors.disabled : theme.colors.primary,
          borderStyle: 'solid' as const,
          '&:hover:not(:disabled)': {
            backgroundColor: theme.colors.primary + '10',
            borderColor: theme.colors.primaryHover,
          },
          '&:active:not(:disabled)': {
            backgroundColor: theme.colors.primary + '20',
          },
        };
      case 'tertiary':
        return {
          ...baseStyles,
          backgroundColor: 'transparent',
          '&:hover:not(:disabled)': {
            backgroundColor: theme.colors.surfaceHover || theme.colors.surface,
          },
          '&:active:not(:disabled)': {
            backgroundColor: theme.colors.surfaceActive || theme.colors.surface,
          },
        };
      case 'destructive':
        return {
          ...baseStyles,
          backgroundColor: disabled ? theme.colors.disabled : theme.colors.error,
          '&:hover:not(:disabled)': {
            backgroundColor: theme.colors.errorHover,
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px rgba(255, 59, 48, 0.15)',
          },
          '&:active:not(:disabled)': {
            transform: 'translateY(0)',
            boxShadow: '0 2px 6px rgba(255, 59, 48, 0.1)',
          },
        };
      default:
        return baseStyles;
    }
  };

  const getTextStyles = () => {
    const baseTextStyles = {
      fontSize: getFontSize(),
      fontWeight: '600' as const,
      textAlign: 'center' as const,
      transition: 'all 0.2s ease-in-out',
    };

    switch (variant) {
      case 'primary':
      case 'destructive':
        return {
          ...baseTextStyles,
          color: '#FFFFFF',
        };
      case 'secondary':
        return {
          ...baseTextStyles,
          color: disabled ? theme.colors.textSecondary : theme.colors.primary,
        };
      case 'tertiary':
        return {
          ...baseTextStyles,
          color: disabled ? theme.colors.textSecondary : theme.colors.text,
        };
      default:
        return baseTextStyles;
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'small':
        return 14;
      case 'medium':
        return 16;
      case 'large':
        return 18;
      default:
        return 16;
    }
  };

  const getBorderRadius = () => {
    switch (size) {
      case 'small':
        return 6;
      case 'medium':
        return 8;
      case 'large':
        return 12;
      default:
        return 8;
    }
  };

  const getHorizontalPadding = () => {
    switch (size) {
      case 'small':
        return 16;
      case 'medium':
        return 24;
      case 'large':
        return 32;
      default:
        return 24;
    }
  };

  const getVerticalPadding = () => {
    switch (size) {
      case 'small':
        return 8;
      case 'medium':
        return 12;
      case 'large':
        return 16;
      default:
        return 12;
    }
  };

  const getMinWidth = () => {
    switch (size) {
      case 'small':
        return 64;
      case 'medium':
        return 96;
      case 'large':
        return 128;
      default:
        return 96;
    }
  };

  const getHeight = () => {
    switch (size) {
      case 'small':
        return 32;
      case 'medium':
        return 44;
      case 'large':
        return 50;
      default:
        return 44;
    }
  };

  const buttonStyles = StyleSheet.create({
    button: {
      ...getButtonStyles(),
      width: fullWidth ? '100%' : 'auto',
      '&:focus-visible': {
        boxShadow: `0 0 0 2px ${theme.colors.primary}40`,
      },
    },
    text: getTextStyles(),
    icon: {
      marginHorizontal: 4,
    },
    iconLeft: {
      marginRight: 8,
    },
    iconRight: {
      marginLeft: 8,
    },
    loading: {
      marginLeft: 8,
    },
  });

  const renderContent = () => {
    if (loading) {
      return (
        <>
          <Text style={buttonStyles.text}>
            {title}
          </Text>
          <ActivityIndicator
            size="small"
            color={variant === 'primary' || variant === 'destructive' ? '#FFFFFF' : theme.colors.primary}
            style={buttonStyles.loading}
          />
        </>
      );
    }

    return (
      <>
        {icon && iconPosition === 'left' && (
          <View style={buttonStyles.iconLeft}>{icon}</View>
        )}
        <Text style={buttonStyles.text}>{title}</Text>
        {icon && iconPosition === 'right' && (
          <View style={buttonStyles.iconRight}>{icon}</View>
        )}
      </>
    );
  };

  return (
    <TouchableOpacity
      style={[buttonStyles.button, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      accessibilityBusy={loading}
      {...props}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

export default AppleStyleButton;