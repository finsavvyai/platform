import { useCallback, useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Check, Folder } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';
import { useProjectStore } from '../../stores/projectStore';
import { spacing, typography, touchTarget } from '../../theme/tokens';
import type { Project } from '../../types';

interface ProjectSwitcherProps {
  bottomSheetRef: React.RefObject<BottomSheet | null>;
}

export function ProjectSwitcher({ bottomSheetRef }: ProjectSwitcherProps) {
  const { colors } = useTheme();
  const { projects, activeProject, fetchProjects, setActiveProject } = useProjectStore();

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleSelect = (project: Project) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveProject(project);
    bottomSheetRef.current?.close();
  };

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    [],
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={['50%']}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.bgSecondary }}
      handleIndicatorStyle={{ backgroundColor: colors.textMuted }}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Switch Project
        </Text>
      </View>
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isActive = activeProject?.id === item.id;
          return (
            <Pressable
              onPress={() => handleSelect(item)}
              style={[styles.row, { borderBottomColor: colors.borderColor }]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Folder size={20} color={isActive ? colors.accentPrimary : colors.textMuted} />
              <View style={styles.rowText}>
                <Text
                  style={[
                    styles.name,
                    { color: isActive ? colors.accentPrimary : colors.textPrimary },
                  ]}
                >
                  {item.name}
                </Text>
                {item.description && (
                  <Text style={[styles.desc, { color: colors.textMuted }]} numberOfLines={1}>
                    {item.description}
                  </Text>
                )}
              </View>
              {isActive && <Check size={18} color={colors.accentPrimary} />}
            </Pressable>
          );
        }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.base, paddingBottom: spacing.md },
  title: { ...typography.title3 },
  list: { paddingHorizontal: spacing.base },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: touchTarget.minHeight,
  },
  rowText: { flex: 1 },
  name: { ...typography.body, fontWeight: '500' },
  desc: { ...typography.caption1, marginTop: 2 },
});
