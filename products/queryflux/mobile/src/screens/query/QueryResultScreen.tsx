/**
 * Query result screen for displaying query execution results
 */

import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {RouteProp, useRoute} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import {theme} from '../../styles/theme';
import {RootStackParamList} from '../../navigation/AppNavigator';

type QueryResultRouteProp = RouteProp<RootStackParamList, 'QueryResult'>;

const QueryResultScreen: React.FC = () => {
  const route = useRoute<QueryResultRouteProp>();
  const {query, connectionId} = route.params;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Icon name="table_chart" size={64} color={theme.colors.primary} />
        <Text style={styles.title}>Query Results</Text>
        <Text style={styles.subtitle}>
          Query: {query}
        </Text>
        <Text style={styles.subtitle}>
          Connection: {connectionId}
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
    marginBottom: theme.spacing.sm,
  },
  comingSoon: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.primary,
    marginTop: theme.spacing.lg,
  },
});

export default QueryResultScreen;