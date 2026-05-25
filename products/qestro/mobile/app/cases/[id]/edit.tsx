import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '../../../src/hooks/useTheme';
import { Button } from '../../../src/components/atoms';
import { spacing, typography } from '../../../src/theme/tokens';

export default function EditTestCaseScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.header}>
        <Button variant="ghost" size="sm" onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.textPrimary} />
        </Button>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Edit Test Case
        </Text>
        <View style={{ width: 44 }} />
      </View>
      <View style={styles.content}>
        <Text style={{ color: colors.textSecondary }}>
          Edit form coming soon
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  headerTitle: { ...typography.headline },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
});
