import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
  StyleProp,
} from 'react-native';
import { useTheme } from '@context';

// Apple HIG Button Variants
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
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
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
  titleStyle,
  onPress,
  ...props
}) => {
  const { theme } = useTheme();

  const getButtonColors = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: disabled ? theme.colors.border : theme.colors.primary,
          borderColor: 'transparent',
        };
      case 'secondary':
        return {
          backgroundColor: 'transparent',
          borderColor: disabled ? theme.colors.border : theme.colors.border,
        };
      case 'tertiary':
        return {
          backgroundColor: disabled ? `${theme.colors.border}20` : 'transparent',
          borderColor: 'transparent',
        };
      case 'destructive':
        return {
          backgroundColor: disabled ? theme.colors.border : theme.colors.error,
          borderColor: 'transparent',
        };
      default:
        return {
          backgroundColor: theme.colors.primary,
          borderColor: 'transparent',
        };
    }
  };

  const getTextColors = () => {
    switch (variant) {
      case 'primary':
      case 'destructive':
        return disabled ? theme.colors.textSecondary : '#FFFFFF';
      case 'secondary':
      case 'tertiary':
        return disabled ? theme.colors.textSecondary : theme.colors.primary;
      default:
        return '#FFFFFF';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm,
          borderRadius: 6,
          minHeight: 32,
        };
      case 'medium':
        return {
          paddingHorizontal: theme.spacing.xl,
          paddingVertical: theme.spacing.md,
          borderRadius: 8,
          minHeight: 44, // Apple HIG minimum touch target
        };
      case 'large':
        return {
          paddingHorizontal: theme.spacing.xl * 2,
          paddingVertical: theme.spacing.lg,
          borderRadius: 12,
          minHeight: 50,
        };
      default:
        return {
          paddingHorizontal: theme.spacing.xl,
          paddingVertical: theme.spacing.md,
          borderRadius: 8,
          minHeight: 44,
        };
    }
  };

  const getTextSize = () => {
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

  const buttonColors = getButtonColors();
  const textColor = getTextColors();
  const sizeStyles = getSizeStyles();
  const fontSize = getTextSize();

  const styles = StyleSheet.create({
    button: {
      ...sizeStyles,
      backgroundColor: buttonColors.backgroundColor,
      borderColor: buttonColors.borderColor,
      borderWidth: variant === 'secondary' ? 1 : 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: disabled ? 0.5 : 1,
      ...Platform.select({
        ios: {
          // Apple HIG subtle shadow for iOS
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    buttonText: {
      color: textColor,
      fontSize,
      fontWeight: '600',
      textAlign: 'center',
      ...Platform.select({
        ios: {
          // Apple's San Francisco font weights
          fontFamily: 'System',
          fontWeight: '600',
        },
        android: {
          fontFamily: 'Roboto',
          fontWeight: '600',
        },
      }),
    },
    iconContainer: {
      marginHorizontal: theme.spacing.xs,
    },
    content: {
      flexDirection: iconPosition === 'left' ? 'row' : 'row-reverse',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        fullWidth && { width: '100%' },
        style,
      ]}
      disabled={isDisabled}
      onPress={onPress}
      activeOpacity={0.6} // Apple HIG recommends 0.6 for touch feedback
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'secondary' || variant === 'tertiary' ? theme.colors.primary : '#FFFFFF'}
          size="small"
        />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'left' && (
            <View style={styles.iconContainer}>
              {icon}
            </View>
          )}
          <Text style={[styles.buttonText, titleStyle]}>{title}</Text>
          {icon && iconPosition === 'right' && (
            <View style={styles.iconContainer}>
              {icon}
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

export default AppleStyleButton;