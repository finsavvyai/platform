/**
 * Agent list screen — grid of agents with search and category filter.
 */

import React, { useEffect, useMemo, useCallback } from 'react';
import {
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useThemeColors } from '../../hooks/useThemeColors';
import { spacing } from '../../theme';
import { useAgentStore } from '../../store/agentStore';
import { AgentCard } from '../../components/AgentCard';
import { SearchBar } from '../../components/SearchBar';
import { CategoryFilter } from '../../components/CategoryFilter';
import { EmptyState } from '../../components/EmptyState';
import { AgentListSkeleton } from '../../components/AgentListSkeleton';
import type { AgentsStackParamList } from '../../types/navigation';
import type { AgentListItem } from '../../types/api';

type Props = NativeStackScreenProps<AgentsStackParamList, 'AgentList'>;

export function AgentListScreen({ navigation }: Props): React.ReactElement {
  const colors = useThemeColors();
  const {
    agents,
    isLoading,
    searchQuery,
    selectedCategory,
    fetchAgents,
    setSearchQuery,
    setCategory,
    filteredAgents,
  } = useAgentStore();

  useEffect(() => {
    if (agents.length === 0) {
      fetchAgents();
    }
  }, [agents.length, fetchAgents]);

  const categories = useMemo(() => {
    const cats = new Set(agents.map((a) => a.category));
    return Array.from(cats).sort();
  }, [agents]);

  const data = filteredAgents();

  const handlePress = useCallback(
    (agent: AgentListItem) => {
      navigation.navigate('AgentExecute', {
        slug: agent.slug,
        name: agent.name,
        category: agent.category,
      });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: AgentListItem }) => (
      <AgentCard agent={item} onPress={() => handlePress(item)} />
    ),
    [handlePress],
  );

  if (isLoading && agents.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
        <AgentListSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
      <CategoryFilter
        categories={categories}
        selected={selectedCategory}
        onSelect={setCategory}
      />
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.slug}
        numColumns={2}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={fetchAgents}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="No agents found"
            subtitle="Try adjusting your search or filter"
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: spacing.sm, paddingBottom: spacing.xl },
});
