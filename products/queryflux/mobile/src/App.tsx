/**
 * Multi-Database Manager Mobile App
 * Main application component
 */

import React, {useEffect} from 'react';
import {StatusBar, Platform} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import FlashMessage from 'react-native-flash-message';
import {QueryClient, QueryClientProvider} from 'react-query';

import {AppNavigator} from './navigation/AppNavigator';
import {AuthProvider} from './contexts/AuthContext';
import {DatabaseProvider} from './contexts/DatabaseContext';
import {NotificationService} from './services/NotificationService';
import {theme} from './styles/theme';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

const App: React.FC = () => {
  useEffect(() => {
    // Initialize notification service
    NotificationService.initialize();
    
    // Request notification permissions
    NotificationService.requestPermissions();
    
    return () => {
      // Cleanup when app unmounts
      NotificationService.cleanup();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AuthProvider>
          <DatabaseProvider>
            <NavigationContainer theme={theme.navigation}>
              <StatusBar
                barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'}
                backgroundColor={theme.colors.primary}
              />
              <AppNavigator />
              <FlashMessage position="top" />
            </NavigationContainer>
          </DatabaseProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
};

export default App;