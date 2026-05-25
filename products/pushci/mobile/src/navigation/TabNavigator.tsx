import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import RunsScreen from '../screens/RunsScreen';
import ProjectsScreen from '../screens/ProjectsScreen';
import SkillsScreen from '../screens/SkillsScreen';
import BillingScreen from '../screens/BillingScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { colors, fontSize } from '../theme';

const Tab = createBottomTabNavigator();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Runs: '>',
    Projects: '#',
    Skills: '+',
    Billing: '$',
    Settings: '*',
  };
  return (
    <Text style={{
      fontFamily: 'Courier',
      fontSize: fontSize.lg,
      color: focused ? colors.accent : colors.textMuted,
      fontWeight: focused ? '700' : '400',
    }}>
      {icons[label] ?? '?'}
    </Text>
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.surfaceBorder,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: fontSize.xs, fontWeight: '500' },
        tabBarIcon: ({ focused }) => (
          <TabIcon label={route.name} focused={focused} />
        ),
      })}
    >
      <Tab.Screen name="Runs" component={RunsScreen} />
      <Tab.Screen name="Projects" component={ProjectsScreen} />
      <Tab.Screen name="Skills" component={SkillsScreen} />
      <Tab.Screen name="Billing" component={BillingScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
