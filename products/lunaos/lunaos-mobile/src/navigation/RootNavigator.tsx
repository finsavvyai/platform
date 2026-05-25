/**
 * Root navigator — switches between Auth and Main based on auth state.
 */

import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator(): React.ReactElement {
  const { user, isInitialized, restore } = useAuthStore();

  useEffect(() => {
    restore();
  }, [restore]);

  if (!isInitialized) {
    return <LoadingOverlay message="Loading..." />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="Main" component={MainTabs} />
      ) : (
        <Stack.Screen name="Auth" component={AuthStack} />
      )}
    </Stack.Navigator>
  );
}
