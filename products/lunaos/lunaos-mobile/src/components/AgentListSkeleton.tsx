import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  useReducedMotion,
} from 'react-native-reanimated';
import { useThemeColors } from '../hooks/useThemeColors';
import { spacing, radii, TOUCH_TARGET } from '../theme';

export function AgentListSkeleton() {
  const colors = useThemeColors();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(reducedMotion ? 0.7 : 0.5);

  React.useEffect(() => {
    if (reducedMotion) return;
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800 }),
        withTiming(0.5, { duration: 800 })
      ),
      -1,
      true
    );
  }, [opacity, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const renderItem = () => (
    <View style={styles.cardContainer}>
      <Animated.View
        style={[
          styles.card,
          animatedStyle,
          {
            backgroundColor: colors.cardBackground,
            borderColor: colors.cardBorder,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: radii.sm,
            elevation: 2,
          },
        ]}
      >
        <View style={[styles.iconCircle, { backgroundColor: colors.fill }]} />
        <View style={[styles.nameLine, { backgroundColor: colors.fill }]} />
        <View style={[styles.nameLineShort, { backgroundColor: colors.fill }]} />
        
        <View style={styles.footer}>
          <View style={[styles.categoryLine, { backgroundColor: colors.fill }]} />
          <View style={[styles.tierBadge, { backgroundColor: colors.fill }]} />
        </View>
      </Animated.View>
    </View>
  );

  return (
    <FlatList
      data={Array.from({ length: 6 })}
      renderItem={renderItem}
      keyExtractor={(_, i) => String(i)}
      numColumns={2}
      contentContainerStyle={styles.list}
      scrollEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.sm, paddingBottom: spacing.xl, marginTop: spacing.xs },
  cardContainer: {
    flex: 1,
    margin: spacing.xs,
  },
  card: {
    flex: 1,
    minHeight: TOUCH_TARGET * 2.5,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: spacing.sm,
  },
  nameLine: {
    height: 14,
    borderRadius: radii.sm,
    marginBottom: spacing.xs,
    width: '90%',
  },
  nameLineShort: {
    height: 14,
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
    width: '60%',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  categoryLine: {
    height: 12,
    width: 50,
    borderRadius: radii.sm,
  },
  tierBadge: {
    height: 16,
    width: 40,
    borderRadius: radii.sm,
  },
});
