/**
 * Auth navigation stack — Login and Signup screens.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useThemeColors } from '../hooks/useThemeColors';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import type { AuthStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack(): React.ReactElement {
  const colors = useThemeColors();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
}
