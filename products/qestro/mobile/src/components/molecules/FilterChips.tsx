import { Pressable, ScrollView, StyleSheet, Text, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';
import { radius, spacing } from '../../theme/tokens';

interface FilterChip {
  id: string;
  label: string;
}

interface FilterChipsProps {
  chips: FilterChip[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  style?: ViewStyle;
}

export function FilterChips({ chips, selected, onSelect, style }: FilterChipsProps) {
  const { colors } = useTheme();

  const handlePress = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(selected === id ? null : id);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.container, style]}
    >
      {chips.map((chip) => {
        const isActive = selected === chip.id;
        return (
          <Pressable
            key={chip.id}
            onPress={() => handlePress(chip.id)}
            style={[
              styles.chip,
              {
                backgroundColor: isActive ? `${colors.accentPrimary}20` : colors.glassBg,
                borderColor: isActive ? colors.accentPrimary : colors.glassBorder,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <Text
              style={[
                styles.chipText,
                { color: isActive ? colors.accentPrimary : colors.textSecondary },
              ]}
            >
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm, paddingHorizontal: spacing.base },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 32,
    justifyContent: 'center',
  },
  chipText: { fontSize: 13, fontWeight: '500' },
});
