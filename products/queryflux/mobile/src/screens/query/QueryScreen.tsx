/**
 * Query screen for executing database queries
 */

import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import {theme} from '../../styles/theme';

const QueryScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Icon name="code" size={64} color={theme.colors.primary} />
        <Text style={styles.title}>Query Editor</Text>
        <Text style={styles.subtitle}>
          Execute SQL queries and view results on your mobile device
        </Text>
        <Text style={styles.comingSoon}>Coming Soon</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  title: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.md,
    marginBottom: theme.spacing.lg,
  },
  comingSoon: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.primary,
  },
});

export default QueryScreen;