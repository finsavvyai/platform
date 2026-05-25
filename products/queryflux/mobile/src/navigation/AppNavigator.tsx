/**
 * Main app navigation component
 */

import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialIcons';

import {useAuth} from '../contexts/AuthContext';
import {theme} from '../styles/theme';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import ConnectionsScreen from '../screens/connections/ConnectionsScreen';
import MonitoringScreen from '../screens/monitoring/MonitoringScreen';
import QueryScreen from '../screens/query/QueryScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import ConnectionDetailScreen from '../screens/connections/ConnectionDetailScreen';
import QueryResultScreen from '../screens/query/QueryResultScreen';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  ConnectionDetail: {connectionId: string};
  QueryResult: {query: string; connectionId: string};
};

export type MainTabParamList = {
  Dashboard: undefined;
  Connections: undefined;
  Monitoring: undefined;
  Query: undefined;
  Settings: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        tabBarIcon: ({focused, color, size}) => {
          let iconName: string;

          switch (route.name) {
            case 'Dashboard':
              iconName = 'dashboard';
              break;
            case 'Connections':
              iconName = 'storage';
              break;
            case 'Monitoring':
              iconName = 'monitor';
              break;
            case 'Query':
              iconName = 'code';
              break;
            case 'Settings':
              iconName = 'settings';
              break;
            default:
              iconName = 'help';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: theme.colors.white,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}>
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{title: 'Dashboard'}}
      />
      <Tab.Screen
        name="Connections"
        component={ConnectionsScreen}
        options={{title: 'Connections'}}
      />
      <Tab.Screen
        name="Monitoring"
        component={MonitoringScreen}
        options={{title: 'Monitoring'}}
      />
      <Tab.Screen
        name="Query"
        component={QueryScreen}
        options={{title: 'Query'}}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{title: 'Settings'}}
      />
    </Tab.Navigator>
  );
};

export const AppNavigator: React.FC = () => {
  const {isAuthenticated} = useAuth();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: theme.colors.white,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}>
      {!isAuthenticated ? (
        <Stack.Screen
          name="Auth"
          component={LoginScreen}
          options={{headerShown: false}}
        />
      ) : (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabNavigator}
            options={{headerShown: false}}
          />
          <Stack.Screen
            name="ConnectionDetail"
            component={ConnectionDetailScreen}
            options={{title: 'Connection Details'}}
          />
          <Stack.Screen
            name="QueryResult"
            component={QueryResultScreen}
            options={{title: 'Query Results'}}
          />
        </>
      )}
    </Stack.Navigator>
  );
};