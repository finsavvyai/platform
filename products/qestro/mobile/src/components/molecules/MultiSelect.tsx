import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';
import { radius, spacing, touchTarget, typography } from '../../theme/tokens';

interface MultiSelectItem {
  id: string;
  label: string;
  subtitle?: string;
}

interface MultiSelectProps {
  items: MultiSelectItem[];
  selected: string[];
  onSelectionChange: (selected: string[]) => void;
  label?: string;
  maxHeight?: number;
  style?: ViewStyle;
}

export function MultiSelect({ items, selected, onSelectionChange, label, maxHeight = 250, style }: MultiSelectProps) {
  const { colors } = useTheme();

  const toggle = (id: string) => {
    Haptics.selectionAsync();
    const next = selected.includes(id)
      ? selected.filter((s) => s !== id)
      : [...selected, id];
    onSelectionChange(next);
  };

  return (
    <View style={style}>
      {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
      <ScrollView style={[styles.list, { maxHeight, borderColor: colors.glassBorder }]}>
        {items.map((item) => {
          const isSelected = selected.includes(item.id);
          return (
            <Pressable
              key={item.id}
              onPress={() => toggle(item.id)}
              style={[styles.row, { borderBottomColor: colors.borderColor, backgroundColor: isSelected ? `${colors.accentPrimary}10` : 'transparent' }]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
            >
              <View style={styles.rowText}>
                <Text style={[styles.itemLabel, { color: colors.textPrimary }]}>{item.label}</Text>
                {item.subtitle && <Text style={[styles.itemSub, { color: colors.textMuted }]}>{item.subtitle}</Text>}
              </View>
              {isSelected && <Check size={18} color={colors.accentPrimary} />}
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={[styles.count, { color: colors.textMuted }]}>{selected.length} selected</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.footnote, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },
  list: { borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, minHeight: touchTarget.minHeight,
  },
  rowText: { flex: 1 },
  itemLabel: { ...typography.body },
  itemSub: { ...typography.caption1, marginTop: 2 },
  count: { ...typography.caption1, marginTop: spacing.xs, textAlign: 'right' },
});
