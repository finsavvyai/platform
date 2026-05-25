/**
 * Empty state placeholder for lists with no data.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '../hooks/useThemeColors';
import { spacing, typography } from '../theme';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
}

export function EmptyState({
  title,
  subtitle,
}: EmptyStateProps): React.ReactElement {
  const colors = useThemeColors();

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.textSecondary }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
          {subtitle}
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
    padding: spacing.xl,
  },
  title: {
    ...typography.title2,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    textAlign: 'center',
  },
});
