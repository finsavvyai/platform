import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TextInput, ScrollView,
  TouchableOpacity, RefreshControl, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, Skill } from '../hooks/useApi';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import { colors, spacing, fontSize } from '../theme';

const categories = ['all', 'pipeline', 'check', 'deploy', 'ai', 'security', 'test'];

function SkillItem({ skill }: { skill: Skill }) {
  return (
    <Card style={{ marginBottom: spacing.sm }}>
      <Text style={styles.name}>{skill.name}</Text>
      <Text style={styles.desc} numberOfLines={2}>{skill.description}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{skill.category}</Text>
        <Text style={styles.meta}>{skill.installs} installs</Text>
      </View>
    </Card>
  );
}

export default function SkillsScreen() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const load = useCallback(async () => {
    try { setSkills(await api.getSkills()); }
    catch { /* keep existing */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); void load(); }, [load]);

  const filtered = useMemo(() => skills.filter((s) => {
    if (category !== 'all' && s.category !== category) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
  }), [skills, category, search]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.header}>Skill Market</Text>
      <TextInput
        style={styles.search}
        placeholder="Search skills..."
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={{ paddingHorizontal: spacing.lg }}>
        {categories.map((c) => (
          <TouchableOpacity key={c} onPress={() => setCategory(c)}
            style={[styles.chip, category === c && styles.chipActive]}>
            <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SkillItem skill={item} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListEmptyComponent={loading ? null : <EmptyState icon="+" message="No skills found." />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary, padding: spacing.lg, paddingBottom: spacing.sm },
  search: {
    marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: colors.surfaceBorder, paddingHorizontal: spacing.md,
    paddingVertical: 10, color: colors.textPrimary, fontSize: fontSize.sm,
  },
  chips: { marginTop: spacing.md, marginBottom: spacing.sm, maxHeight: 40 },
  chip: { backgroundColor: '#27272a', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6, marginRight: 8 },
  chipActive: { backgroundColor: colors.accent },
  chipText: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '500', textTransform: 'capitalize' },
  chipTextActive: { color: colors.black },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  name: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  desc: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  meta: { fontSize: fontSize.xs, color: colors.textMuted, textTransform: 'capitalize' },
});
