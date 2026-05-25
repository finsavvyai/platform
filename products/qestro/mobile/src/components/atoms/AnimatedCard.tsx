import { type ReactNode } from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';
import { type ViewStyle } from 'react-native';

interface AnimatedCardProps {
  children: ReactNode;
  index?: number;
  style?: ViewStyle;
}

export function AnimatedCard({ children, index = 0, style }: AnimatedCardProps) {
  const delay = Math.min(index * 50, 300);

  return (
    <Animated.View
      entering={FadeIn.duration(300).delay(delay)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
