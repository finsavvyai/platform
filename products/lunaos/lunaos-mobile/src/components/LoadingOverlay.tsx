/**
 * Full-screen loading spinner with optional message.
 */

import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '../hooks/useThemeColors';
import { typography, spacing } from '../theme';

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({
  message,
}: LoadingOverlayProps): React.ReactElement {
  const colors = useThemeColors();

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      accessibilityRole="progressbar"
      accessibilityLabel={message ?? 'Loading'}
    >
      <ActivityIndicator size="large" color={colors.accent} />
      {message ? (
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    ...typography.body,
    marginTop: spacing.md,
  },
});
