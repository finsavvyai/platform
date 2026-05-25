import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, Project } from '../hooks/useApi';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import { colors, spacing, fontSize } from '../theme';

const platformIcons: Record<string, string> = {
  github: 'GH',
  gitlab: 'GL',
  bitbucket: 'BB',
};

function ProjectItem({ project }: { project: Project }) {
  return (
    <Card style={{ marginBottom: spacing.sm }}>
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <Text style={styles.iconText}>
            {platformIcons[project.platform] ?? '??'}
          </Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.repo} numberOfLines={1}>{project.repo}</Text>
          <Text style={styles.date}>
            Connected {new Date(project.created_at).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.platformBadge}>
          <Text style={styles.platformText}>
            {project.platform.toUpperCase()}
          </Text>
        </View>
      </View>
    </Card>
  );
}

export default function ProjectsScreen() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setProjects(await api.getProjects()); }
    catch { /* keep existing */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); void load(); }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.header}>Projects</Text>
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ProjectItem project={item} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListEmptyComponent={loading ? null : <EmptyState icon="#" message="No projects connected. Use the CLI or web dashboard to connect a repo." />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary, padding: spacing.lg },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: '#27272a', alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconText: { fontSize: fontSize.xs, fontWeight: '700', color: colors.textSecondary, fontFamily: 'Courier' },
  info: { flex: 1 },
  repo: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  date: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  platformBadge: { backgroundColor: '#27272a', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  platformText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.5 },
});
