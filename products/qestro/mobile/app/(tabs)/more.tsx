import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  BarChart3,
  Bot,
  Compass,
  CreditCard,
  Link2,
  Bell,
  Smartphone,
  Settings,
  Target,
  Sparkles,
  MessageSquare,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing, typography, radius, touchTarget } from '../../src/theme/tokens';
import { Card } from '../../src/components/atoms';

interface MenuItem {
  label: string;
  icon: typeof Settings;
  route: string;
  description: string;
}

const menuSections: { title: string; items: MenuItem[] }[] = [
  {
    title: 'AI Features',
    items: [
      { label: 'AI Test Generator', icon: Sparkles, route: '/ai/test-gen', description: 'Generate tests with AI' },
      { label: 'AI Command Center', icon: Bot, route: '/ai/command-center', description: 'AI agent status' },
      { label: 'AI Recorder', icon: MessageSquare, route: '/ai/recorder', description: 'AI step recorder' },
    ],
  },
  {
    title: 'Test Management',
    items: [
      { label: 'Test Plans', icon: Target, route: '/plans', description: 'Manage test plans' },
      { label: 'Test Cycles', icon: Compass, route: '/cycles', description: 'Track test cycles' },
      { label: 'Explorations', icon: Compass, route: '/explorations', description: 'Exploratory testing' },
      { label: 'Missions', icon: Target, route: '/missions', description: 'Mission control' },
    ],
  },
  {
    title: 'Platform',
    items: [
      { label: 'Insights', icon: BarChart3, route: '/insights', description: 'Analytics & trends' },
      { label: 'Cloud Devices', icon: Smartphone, route: '/devices', description: 'Device management' },
      { label: 'Integrations', icon: Link2, route: '/integrations', description: 'Connect services' },
      { label: 'Notifications', icon: Bell, route: '/notifications', description: 'Alert rules' },
      { label: 'Billing', icon: CreditCard, route: '/billing', description: 'Plans & usage' },
      { label: 'Settings', icon: Settings, route: '/settings', description: 'App settings' },
    ],
  },
];

function MenuRow({ item, onPress }: { item: MenuItem; onPress: () => void }) {
  const { colors } = useTheme();
  const Icon = item.icon;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.menuRow, { borderBottomColor: colors.borderColor }]}
      accessibilityRole="button"
      accessibilityLabel={item.label}
    >
      <View style={[styles.iconBox, { backgroundColor: `${colors.accentPrimary}20` }]}>
        <Icon size={20} color={colors.accentPrimary} />
      </View>
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{item.label}</Text>
        <Text style={[styles.menuDesc, { color: colors.textMuted }]}>{item.description}</Text>
      </View>
    </Pressable>
  );
}

export default function MoreScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>More</Text>
        {menuSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {section.title}
            </Text>
            <Card variant="glass" padding="none">
              {section.items.map((item) => (
                <MenuRow
                  key={item.route}
                  item={item}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(item.route as never);
                  }}
                />
              ))}
            </Card>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.base, paddingBottom: 100 },
  title: { ...typography.largeTitle, marginBottom: spacing.lg },
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    ...typography.footnote,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: touchTarget.minHeight,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: { flex: 1 },
  menuLabel: { ...typography.body, fontWeight: '500' },
  menuDesc: { ...typography.caption1, marginTop: 2 },
});
