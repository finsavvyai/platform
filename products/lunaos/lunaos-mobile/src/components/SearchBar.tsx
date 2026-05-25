/**
 * Search bar with debounced input, styled per Apple HIG.
 */

import React, { useCallback, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { useThemeColors } from '../hooks/useThemeColors';
import { spacing, radii, typography, TOUCH_TARGET } from '../theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search agents...',
}: SearchBarProps): React.ReactElement {
  const colors = useThemeColors();
  const inputRef = useRef<TextInput>(null);

  const handleClear = useCallback(() => {
    onChangeText('');
    inputRef.current?.focus();
  }, [onChangeText]);

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.container,
          { backgroundColor: colors.fill },
        ]}
      >
        <Text style={[styles.icon, { color: colors.textTertiary }]}>
          {'  '}
        </Text>
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: colors.textPrimary }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search"
          accessibilityHint="Search agents by name or keyword"
          allowFontScaling={true}
          maxFontSizeMultiplier={1.5}
        />
        {value.length > 0 ? (
          <TouchableOpacity
            onPress={handleClear}
            style={styles.clearButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Clear search"
          >
            <Text style={[styles.clear, { color: colors.textTertiary }]}>
              X
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_TARGET,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
  },
  icon: {
    ...typography.body,
    marginRight: spacing.xs,
  },
  input: {
    flex: 1,
    ...typography.body,
    paddingVertical: spacing.sm,
  },
  clearButton: {
    minWidth: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clear: {
    ...typography.footnote,
    fontWeight: '700',
    padding: spacing.xs,
  },
});
