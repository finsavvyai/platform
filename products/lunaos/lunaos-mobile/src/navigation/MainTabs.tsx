/**
 * Bottom tab navigator — Agents, History, Settings.
 */

import React from 'react';
import { Text, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useThemeColors } from '../hooks/useThemeColors';
import { typography, spacing } from '../theme';
import { AgentsStack } from './AgentsStack';
import { HistoryScreen } from '../screens/history/HistoryScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import type { MainTabParamList } from '../types/navigation';

const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIcon({ label, focused, color }: {
  label: string;
  focused: boolean;
  color: string;
}): React.ReactElement {
  return (
    <Text style={[styles.icon, { color, opacity: focused ? 1 : 0.5 }]}>
      {label}
    </Text>
  );
}

export function MainTabs(): React.ReactElement {
  const colors = useThemeColors();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopColor: colors.separator,
          paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.sm,
          height: Platform.OS === 'ios' ? 88 : 64,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          ...typography.caption,
          fontWeight: '500',
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Agents"
        component={AgentsStack}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon label="A" color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.headerBackground },
          headerTitleStyle: { color: colors.textPrimary, fontWeight: '600' },
          headerShadowVisible: false,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon label="H" color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.headerBackground },
          headerTitleStyle: { color: colors.textPrimary, fontWeight: '600' },
          headerShadowVisible: false,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon label="S" color={color} focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 20,
    fontWeight: '700',
  },
});
