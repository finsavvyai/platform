/**
 * App entry point — wraps navigation with providers.
 */

import React, { useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  type Theme,
} from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { RootNavigator } from './src/navigation/RootNavigator';
import { lightColors, darkColors } from './src/theme/colors';

SplashScreen.preventAutoHideAsync();

const LunaLightTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: lightColors.accent,
    background: lightColors.background,
    card: lightColors.headerBackground,
    text: lightColors.textPrimary,
    border: lightColors.separator,
    notification: lightColors.accent,
  },
};

const LunaDarkTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: darkColors.accent,
    background: darkColors.background,
    card: darkColors.headerBackground,
    text: darkColors.textPrimary,
    border: darkColors.separator,
    notification: darkColors.accent,
  },
};

export default function App(): React.ReactElement {
  const scheme = useColorScheme();

  const onReady = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    onReady();
  }, [onReady]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer
        theme={scheme === 'light' ? LunaLightTheme : LunaDarkTheme}
      >
        <StatusBar style="auto" />
        <RootNavigator />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
