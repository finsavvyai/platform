import { useState, type ReactNode, type Ref } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { radius, spacing, touchTarget } from '../../theme/tokens';

export type InputVariant = 'default' | 'filled' | 'glass';
export type InputSize = 'sm' | 'md' | 'lg';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  variant?: InputVariant;
  inputSize?: InputSize;
  isPassword?: boolean;
  containerStyle?: ViewStyle;
  inputRef?: Ref<TextInput>;
}

export function Input({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  variant = 'default',
  inputSize = 'md',
  isPassword = false,
  containerStyle,
  inputRef,
  ...textInputProps
}: InputProps) {
  const { colors, isDark } = useTheme();
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const variantStyles = getVariantStyles(variant, colors, focused, !!error);
  const sizeStyles = getSizeStyles(inputSize);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && (
        <Text
          style={[styles.label, { color: colors.textSecondary }]}
          accessibilityRole="text"
        >
          {label}
        </Text>
      )}
      <View
        style={[
          styles.container,
          variantStyles,
          sizeStyles.container,
          error && { borderColor: colors.accentError },
        ]}
      >
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            sizeStyles.input,
            { color: colors.textPrimary },
            leftIcon ? { paddingLeft: 0 } : undefined,
          ]}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={isPassword && !showPassword}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardAppearance={isDark ? 'dark' : 'light'}
          accessibilityLabel={label}
          {...textInputProps}
        />
        {isPassword && (
          <Pressable
            onPress={() => setShowPassword(!showPassword)}
            style={styles.iconRight}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            hitSlop={8}
          >
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>
              {showPassword ? 'Hide' : 'Show'}
            </Text>
          </Pressable>
        )}
        {rightIcon && !isPassword && (
          <View style={styles.iconRight}>{rightIcon}</View>
        )}
      </View>
      {error && (
        <Text style={[styles.helperText, { color: colors.accentError }]}>
          {error}
        </Text>
      )}
      {helperText && !error && (
        <Text style={[styles.helperText, { color: colors.textMuted }]}>
          {helperText}
        </Text>
      )}
    </View>
  );
}

function getVariantStyles(
  variant: InputVariant,
  colors: ReturnType<typeof useTheme>['colors'],
  focused: boolean,
  hasError: boolean,
): ViewStyle {
  const borderColor = hasError
    ? colors.accentError
    : focused
      ? colors.accentPrimary
      : colors.borderColor;

  switch (variant) {
    case 'default':
      return {
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderWidth: 1,
        borderColor,
      };
    case 'filled':
      return {
        backgroundColor: colors.bgTertiary,
        borderWidth: 1,
        borderColor: focused ? colors.accentPrimary : 'transparent',
      };
    case 'glass':
      return {
        backgroundColor: colors.glassBg,
        borderWidth: 1,
        borderColor: focused ? colors.accentPrimary : colors.glassBorder,
      };
  }
}

function getSizeStyles(size: InputSize) {
  switch (size) {
    case 'sm':
      return {
        container: { minHeight: 36 } as ViewStyle,
        input: { fontSize: 14, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
      };
    case 'md':
      return {
        container: { minHeight: touchTarget.minHeight } as ViewStyle,
        input: { fontSize: 15, paddingHorizontal: spacing.base, paddingVertical: spacing.md },
      };
    case 'lg':
      return {
        container: { minHeight: 52 } as ViewStyle,
        input: { fontSize: 17, paddingHorizontal: spacing.lg, paddingVertical: spacing.base },
      };
  }
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
  },
  iconLeft: {
    paddingLeft: spacing.md,
  },
  iconRight: {
    paddingRight: spacing.md,
  },
  helperText: {
    fontSize: 12,
    marginTop: 2,
  },
});
