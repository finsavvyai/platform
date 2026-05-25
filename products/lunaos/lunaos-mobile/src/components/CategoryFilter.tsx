/**
 * Horizontal scrollable category filter chips.
 */

import React from 'react';
import {
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { useThemeColors } from '../hooks/useThemeColors';
import { spacing, radii, typography, TOUCH_TARGET } from '../theme';

interface CategoryFilterProps {
  categories: string[];
  selected: string | null;
  onSelect: (cat: string | null) => void;
}

export function CategoryFilter({
  categories,
  selected,
  onSelect,
}: CategoryFilterProps): React.ReactElement {
  const colors = useThemeColors();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      <TouchableOpacity
        onPress={() => onSelect(null)}
        style={[
          styles.chip,
          {
            backgroundColor: selected === null ? colors.accent : colors.fill,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="All categories"
        accessibilityHint="Show all agents"
      >
        <Text
          style={[
            styles.chipText,
            { color: selected === null ? '#FFFFFF' : colors.textSecondary },
          ]}
        >
          All
        </Text>
      </TouchableOpacity>

      {categories.map((cat) => {
        const isActive = selected === cat;
        return (
          <TouchableOpacity
            key={cat}
            onPress={() => onSelect(isActive ? null : cat)}
            style={[
              styles.chip,
              {
                backgroundColor: isActive ? colors.accent : colors.fill,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Category ${cat}`}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color: isActive ? '#FFFFFF' : colors.textSecondary,
                },
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  chip: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    ...typography.footnote,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
