/**
 * Styled text input following Apple HIG.
 */

import React, { useState } from 'react';
import {
  View,
  TextInput as RNTextInput,
  Text,
  StyleSheet,
  type TextInputProps as RNTextInputProps,
} from 'react-native';
import { useThemeColors } from '../hooks/useThemeColors';
import { spacing, radii, typography, TOUCH_TARGET } from '../theme';

interface TextInputProps extends Omit<RNTextInputProps, 'style'> {
  label: string;
  error?: string;
}

export function TextInput({
  label,
  error,
  ...props
}: TextInputProps): React.ReactElement {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.error
    : focused
      ? colors.accent
      : colors.inputBorder;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <RNTextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.inputBackground,
            borderColor,
            color: colors.textPrimary,
          },
        ]}
        placeholderTextColor={colors.textTertiary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={label}
        allowFontScaling={true}
        maxFontSizeMultiplier={1.5}
        {...props}
      />
      {error ? (
        <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.subheadline,
    marginBottom: spacing.xs,
  },
  input: {
    minHeight: TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    ...typography.body,
  },
  error: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
});
