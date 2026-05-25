import { StyleSheet, Text, View } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { spacing, typography } from '../../theme/tokens';

interface OfflineBannerProps {
  visible: boolean;
}

export function OfflineBanner({ visible }: OfflineBannerProps) {
  if (!visible) return null;
  return (
    <View style={styles.container} accessibilityRole="alert" accessibilityLabel="You are offline">
      <WifiOff size={14} color="#000" />
      <Text style={styles.text}>You are offline. Some features may be limited.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: '#f59e0b', paddingVertical: spacing.sm, paddingHorizontal: spacing.base,
  },
  text: { ...typography.caption1, color: '#000', fontWeight: '600' },
});
