import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { spacing, typography } from '../../theme/tokens';
import { Button } from './Button';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, style]}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      {description && (
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {description}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button variant="primary" size="md" onPress={onAction} style={styles.action}>
          {actionLabel}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing['2xl'],
  },
  icon: {
    marginBottom: spacing.base,
  },
  title: {
    ...typography.title3,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  action: {
    marginTop: spacing.sm,
  },
});
