import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { AuthContext, useAuthLoader } from './src/hooks/useAuth';
import { PlanContext, usePlanLoader } from './src/hooks/usePlan';
import TabNavigator from './src/navigation/TabNavigator';
import LoginScreen from './src/screens/LoginScreen';
import { colors } from './src/theme';

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.surfaceBorder,
    notification: colors.accent,
  },
};

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.loadingText}>Loading PushCI...</Text>
    </View>
  );
}

function AuthenticatedApp({ token }: { token: string }) {
  const planCtx = usePlanLoader(token);
  return (
    <PlanContext.Provider value={planCtx}>
      <TabNavigator />
    </PlanContext.Provider>
  );
}

export default function App() {
  const auth = useAuthLoader();

  return (
    <SafeAreaProvider>
      <AuthContext.Provider value={auth}>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="light" />
          {auth.loading ? (
            <LoadingScreen />
          ) : auth.user && auth.token ? (
            <AuthenticatedApp token={auth.token} />
          ) : (
            <LoginScreen />
          )}
        </NavigationContainer>
      </AuthContext.Provider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
