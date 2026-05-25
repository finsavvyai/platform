import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import {
  LayoutDashboard,
  FileText,
  Play,
  Video,
  MoreHorizontal,
} from 'lucide-react-native';
import { useTheme } from '../../src/hooks/useTheme';
import { useAuthStore } from '../../src/stores/authStore';
import { spacing } from '../../src/theme/tokens';

function TabIcon({
  icon: Icon,
  label,
  focused,
}: {
  icon: typeof LayoutDashboard;
  label: string;
  focused: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.tabItem}>
      <Icon
        size={22}
        color={focused ? colors.accentPrimary : colors.textMuted}
        strokeWidth={focused ? 2.5 : 2}
      />
      <Text
        style={[
          styles.tabLabel,
          { color: focused ? colors.accentPrimary : colors.textMuted },
          focused && styles.tabLabelActive,
        ]}
      >
        {label}
      </Text>
      {focused && (
        <View style={[styles.indicator, { backgroundColor: colors.accentPrimary }]} />
      )}
    </View>
  );
}

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  const handleTabPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <BlurView
            intensity={isDark ? 40 : 80}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ),
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.accentPrimary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
      screenListeners={{
        tabPress: handleTabPress,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={LayoutDashboard} label="Dashboard" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="cases"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={FileText} label="Cases" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="runs"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={Play} label="Runs" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="recording"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={Video} label="Record" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={MoreHorizontal} label="More" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'transparent',
    elevation: 0,
    height: Platform.OS === 'ios' ? 85 : 65,
    paddingTop: spacing.sm,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 50,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  tabLabelActive: {
    fontWeight: '600',
  },
  indicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
});
