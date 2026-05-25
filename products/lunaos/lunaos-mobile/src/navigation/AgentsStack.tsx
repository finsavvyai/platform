/**
 * Agents navigation stack — list and execute screens.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useThemeColors } from '../hooks/useThemeColors';
import { AgentListScreen } from '../screens/agents/AgentListScreen';
import { AgentExecuteScreen } from '../screens/agents/AgentExecuteScreen';
import type { AgentsStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<AgentsStackParamList>();

export function AgentsStack(): React.ReactElement {
  const colors = useThemeColors();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.headerBackground },
        headerTintColor: colors.accent,
        headerTitleStyle: { color: colors.textPrimary, fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="AgentList"
        component={AgentListScreen}
        options={{ title: 'Agents' }}
      />
      <Stack.Screen
        name="AgentExecute"
        component={AgentExecuteScreen}
        options={({ route }) => ({ title: route.params.name })}
      />
    </Stack.Navigator>
  );
}
