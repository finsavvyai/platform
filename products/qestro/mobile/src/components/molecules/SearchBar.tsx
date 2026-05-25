import { StyleSheet, TextInput, View, type ViewStyle } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { radius, spacing, touchTarget } from '../../theme/tokens';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: ViewStyle;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search...',
  style,
}: SearchBarProps) {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.glassBg, borderColor: colors.glassBorder },
        style,
      ]}
    >
      <Search size={18} color={colors.textMuted} />
      <TextInput
        style={[styles.input, { color: colors.textPrimary }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardAppearance={isDark ? 'dark' : 'light'}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={placeholder}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={8}
          accessibilityLabel="Clear search"
        >
          <X size={18} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    minHeight: touchTarget.minHeight,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: spacing.sm,
  },
});
