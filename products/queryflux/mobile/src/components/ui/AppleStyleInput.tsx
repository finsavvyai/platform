import React, { useState } from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useTheme } from '@context';
import { Eye, EyeOff } from 'lucide-react-native';

// Apple HIG Input Variants
type InputVariant = 'primary' | 'secondary' | 'search';
type InputSize = 'small' | 'medium' | 'large';

interface AppleStyleInputProps extends TextInputProps {
  label?: string;
  error?: string;
  helper?: string;
  variant?: InputVariant;
  size?: InputSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  secureTextEntry?: boolean;
  showPasswordToggle?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
  errorStyle?: TextStyle;
  required?: boolean;
}

const AppleStyleInput: React.FC<AppleStyleInputProps> = ({
  label,
  error,
  helper,
  variant = 'primary',
  size = 'medium',
  leftIcon,
  rightIcon,
  secureTextEntry = false,
  showPasswordToggle = false,
  containerStyle,
  inputStyle,
  labelStyle,
  errorStyle,
  required = false,
  value,
  onFocus,
  onBlur,
  ...props
}) => {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [animatedBorder] = useState(new Animated.Value(0));

  const handleFocus = (e: any) => {
    setIsFocused(true);
    Animated.timing(animatedBorder, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    Animated.timing(animatedBorder, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    onBlur?.(e);
  };

  const getInputStyles = () => {
    const baseStyles = {
      backgroundColor: theme.colors.surface,
      borderRadius: size === 'small' ? 8 : size === 'large' ? 12 : 10,
      borderWidth: 1,
      borderColor: error
        ? theme.colors.error
        : isFocused
        ? theme.colors.primary
        : theme.colors.border,
      fontSize: size === 'small' ? 14 : size === 'large' ? 18 : 16,
      paddingHorizontal: leftIcon ? theme.spacing.lg : theme.spacing.md,
      paddingVertical: size === 'small' ? theme.spacing.sm : size === 'large' ? theme.spacing.lg : theme.spacing.md,
      minHeight: size === 'small' ? 36 : size === 'large' ? 56 : 44, // Apple HIG touch targets
      ...Platform.select({
        ios: {
          // Apple's system font
          fontFamily: 'System',
          // iOS specific styling
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
        },
        android: {
          fontFamily: 'Roboto',
          elevation: 1,
        },
      }),
    };

    switch (variant) {
      case 'primary':
        return {
          ...baseStyles,
          backgroundColor: theme.colors.surface,
        };
      case 'secondary':
        return {
          ...baseStyles,
          backgroundColor: 'transparent',
          borderWidth: 2,
        };
      case 'search':
        return {
          ...baseStyles,
          backgroundColor: theme.colors.surface,
          borderRadius: 20, // Apple HIG rounded search field
          paddingHorizontal: theme.spacing.lg,
        };
      default:
        return baseStyles;
    }
  };

  const getLabelColor = () => {
    if (error) return theme.colors.error;
    if (isFocused) return theme.colors.primary;
    return theme.colors.textSecondary;
  };

  const styles = StyleSheet.create({
    container: {
      marginBottom: theme.spacing.md,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: getLabelColor(),
      marginBottom: theme.spacing.xs,
      ...Platform.select({
        ios: {
          fontFamily: 'System',
          fontWeight: '600',
        },
        android: {
          fontFamily: 'Roboto',
          fontWeight: '600',
        },
      }),
    },
    inputContainer: {
      position: 'relative',
    },
    input: {
      ...getInputStyles(),
      color: theme.colors.text,
      flex: 1,
    },
    leftIcon: {
      position: 'absolute',
      left: theme.spacing.md,
      top: '50%',
      marginTop: -12,
      zIndex: 1,
      color: theme.colors.textSecondary,
    },
    rightIcon: {
      position: 'absolute',
      right: theme.spacing.md,
      top: '50%',
      marginTop: -12,
      zIndex: 1,
    },
    passwordToggle: {
      padding: theme.spacing.xs,
    },
    errorText: {
      fontSize: 12,
      color: theme.colors.error,
      marginTop: theme.spacing.xs,
      ...Platform.select({
        ios: {
          fontFamily: 'System',
        },
        android: {
          fontFamily: 'Roboto',
        },
      }),
    },
    helperText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
      ...Platform.select({
        ios: {
          fontFamily: 'System',
        },
        android: {
          fontFamily: 'Roboto',
        },
      }),
    },
    animatedBorder: {
      height: 2,
      backgroundColor: theme.colors.primary,
      marginHorizontal: theme.spacing.sm,
      borderRadius: 1,
      transform: [{ scaleX: animatedBorder }],
      opacity: 0.6,
    },
  });

  const actualSecureTextEntry = secureTextEntry && !showPassword;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, labelStyle]}>
          {label}
          {required && (
            <Text style={{ color: theme.colors.error }}> *</Text>
          )}
        </Text>
      )}

      <View style={styles.inputContainer}>
        {leftIcon && (
          <View style={styles.leftIcon}>
            {leftIcon}
          </View>
        )}

        <TextInput
          style={[
            styles.input,
            leftIcon && { paddingLeft: theme.spacing.xl * 2 },
            (rightIcon || showPasswordToggle) && { paddingRight: theme.spacing.xl * 2 },
            inputStyle,
          ]}
          value={value}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={actualSecureTextEntry}
          placeholderTextColor={theme.colors.textSecondary}
          selectionColor={theme.colors.primary}
          underlineColorAndroid="transparent"
          {...props}
        />

        {(rightIcon || (secureTextEntry && showPasswordToggle)) && (
          <View style={styles.rightIcon}>
            {secureTextEntry && showPasswordToggle ? (
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowPassword(!showPassword)}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                accessibilityRole="button"
              >
                {showPassword ? (
                  <EyeOff size={20} color={theme.colors.textSecondary} />
                ) : (
                  <Eye size={20} color={theme.colors.textSecondary} />
                )}
              </TouchableOpacity>
            ) : (
              rightIcon
            )}
          </View>
        )}
      </View>

      {/* Apple HIG animated focus border */}
      {variant === 'primary' && (
        <Animated.View style={styles.animatedBorder} />
      )}

      {error && (
        <Text style={[styles.errorText, errorStyle]}>
          {error}
        </Text>
      )}

      {helper && !error && (
        <Text style={styles.helperText}>
          {helper}
        </Text>
      )}
    </View>
  );
};

export default AppleStyleInput;