import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, fontSize } from '../theme';

interface Props {
  icon: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon, message, actionLabel, onAction }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.button} onPress={onAction}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 48 },
  icon: { fontSize: 32, marginBottom: spacing.md },
  message: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center' },
  button: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  buttonText: { color: colors.white, fontWeight: '600', fontSize: fontSize.sm },
});
