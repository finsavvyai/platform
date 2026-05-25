import { Pressable, type PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedPress = Animated.createAnimatedComponent(Pressable);

interface AnimatedPressableProps extends PressableProps {
  scaleDown?: number;
  haptic?: boolean;
}

export function AnimatedPressable({
  scaleDown = 0.97,
  haptic = true,
  onPress,
  children,
  style,
  ...rest
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPress
      onPressIn={() => { scale.value = withSpring(scaleDown, { damping: 15, stiffness: 300 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); }}
      onPress={(e) => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      style={[animatedStyle, style]}
      {...rest}
    >
      {children}
    </AnimatedPress>
  );
}
