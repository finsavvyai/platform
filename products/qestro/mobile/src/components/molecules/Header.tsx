import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { ArrowLeft, Bell, ChevronDown } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';
import { spacing, typography, touchTarget } from '../../theme/tokens';
import type { Project } from '../../types';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  activeProject?: Project | null;
  onProjectPress?: () => void;
  onNotificationsPress?: () => void;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
}

export function Header({
  title,
  showBack,
  activeProject,
  onProjectPress,
  onNotificationsPress,
  rightAction,
  style,
}: HeaderProps) {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.left}>
        <View style={styles.titleRow}>
          {showBack && (
            <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
              <ArrowLeft size={22} color={colors.textPrimary} />
            </Pressable>
          )}
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        </View>
        {activeProject && onProjectPress && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onProjectPress();
            }}
            style={styles.projectBtn}
            accessibilityLabel={`Current project: ${activeProject.name}`}
          >
            <Text style={[styles.projectName, { color: colors.accentPrimary }]}>
              {activeProject.name}
            </Text>
            <ChevronDown size={14} color={colors.accentPrimary} />
          </Pressable>
        )}
      </View>
      <View style={styles.right}>
        {rightAction}
        {onNotificationsPress && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onNotificationsPress();
            }}
            style={styles.iconBtn}
            accessibilityLabel="Notifications"
            accessibilityRole="button"
          >
            <Bell size={22} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  left: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backBtn: { minWidth: touchTarget.minWidth, minHeight: touchTarget.minHeight, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.largeTitle },
  projectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  projectName: { ...typography.footnote, fontWeight: '600' },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: {
    minWidth: touchTarget.minWidth,
    minHeight: touchTarget.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
