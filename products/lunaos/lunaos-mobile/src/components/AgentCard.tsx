/**
 * Agent card for the grid. Shows name, category, tier badge.
 */

import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../hooks/useThemeColors';
import { spacing, radii, typography, TOUCH_TARGET } from '../theme';
import type { AgentListItem } from '../types/api';

interface AgentCardProps {
  agent: AgentListItem;
  onPress: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  'code-quality': 'Q',
  solution: 'S',
  planning: 'P',
  devops: 'D',
  testing: 'T',
  custom: 'C',
};

export function AgentCard({
  agent,
  onPress,
}: AgentCardProps): React.ReactElement {
  const colors = useThemeColors();
  const icon = CATEGORY_ICONS[agent.category] ?? 'A';
  const tierColor = agent.tier === 'free' ? colors.tierFree : colors.tierPro;
  const reducedMotion = useReducedMotion();

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!reducedMotion) {
      scale.value = withSpring(0.95, {
        mass: 0.5,
        stiffness: 300,
        damping: 20,
      });
    }
  };

  const handlePressOut = () => {
    if (!reducedMotion) {
      scale.value = withSpring(1, {
        mass: 0.5,
        stiffness: 300,
        damping: 20,
      });
    }
  };

  return (
    <Animated.View style={[styles.cardContainer, animatedStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.card,
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
        accessibilityRole="button"
        accessibilityLabel={`${agent.name}, ${agent.tier} tier`}
      >
        <View style={[styles.iconCircle, { backgroundColor: colors.fill }]}>
          <Text style={[styles.iconText, { color: colors.accent }]}>
            {icon}
          </Text>
        </View>

        <Text
          style={[styles.name, { color: colors.textPrimary }]}
          numberOfLines={2}
        >
          {agent.name}
        </Text>

        <View style={styles.footer}>
          <Text style={[styles.category, { color: colors.textTertiary }]}>
            {agent.category}
          </Text>
          <View style={[styles.tierBadge, { backgroundColor: tierColor }]}>
            <Text style={styles.tierText}>
              {agent.tier.toUpperCase()}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  iconText: {
    ...typography.headline,
  },
  name: {
    ...typography.subheadline,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  category: {
    ...typography.caption,
    textTransform: 'capitalize',
  },
  tierBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  tierText: {
    ...typography.caption,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
