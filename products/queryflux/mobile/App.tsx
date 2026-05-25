/**
 * QueryFlux Mobile App
 * Database monitoring and alerts on the go
 */

import React, { useEffect } from 'react';
import {
  StatusBar,
  Platform,
  LogBox,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppProviders } from './src/context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useTheme } from './src/context';
import { offlineManager } from './src/services/offline';
import { apiClient } from './src/api/client';

// Ignore specific warnings for cleaner console
LogBox.ignoreLogs([
  'VirtualizedLists should never be nested',
  'Setting a timer',
  'Warning: componentWillReceiveProps',
]);

const AppContent: React.FC = () => {
  const { theme } = useTheme();

  useEffect(() => {
    // Initialize services
    const initializeServices = async () => {
      try {
        // Initialize offline manager
        await offlineManager.initialize();
        console.log('Offline manager initialized');

        // Initialize API client and WebSocket
        await apiClient.initialize();
        console.log('API client initialized');
      } catch (error) {
        console.error('Failed to initialize services:', error);
      }
    };

    initializeServices();

    // Cleanup on unmount
    return () => {
      offlineManager.cleanup();
      apiClient.cleanup();
    };
  }, []);

  return (
    <>
      <StatusBar
        barStyle={theme.name === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />
      <AppNavigator />
    </>
  );
};

const App: React.FC = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProviders>
          <NavigationContainer>
            <AppContent />
          </NavigationContainer>
        </AppProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;