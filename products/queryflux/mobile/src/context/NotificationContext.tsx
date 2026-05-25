import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  Platform,
  PushNotificationIOS,
  PermissionsAndroid,
  Alert,
  Linking,
  AppState,
  AppStateStatus
} from 'react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import PushNotification from 'react-native-push-notification';
import { useAppStore } from '@store';
import { Notification } from '@types';

interface NotificationContextType {
  isPermissionGranted: boolean;
  isPushEnabled: boolean;
  notifications: Notification[];
  unreadCount: number;
  requestPermission: () => Promise<boolean>;
  configurePushNotifications: () => void;
  scheduleLocalNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void;
  cancelLocalNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAllNotifications: () => void;
  handleNotificationPress: (notification: Notification) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    notifications,
    pushEnabled,
    settings,
    addNotification,
    markNotificationRead,
    clearNotifications,
    updateSettings,
  } = useAppStore();

  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  // Count unread notifications
  const unreadCount = notifications.filter(n => !n.read).length;

  // Configure push notifications on app start
  useEffect(() => {
    configurePushNotifications();
    requestPermission();

    // Listen for app state changes
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  // Handle notification permissions based on settings
  useEffect(() => {
    if (settings.notifications.enabled && isPermissionGranted) {
      configurePushNotifications();
    }
  }, [settings.notifications.enabled, isPermissionGranted]);

  const requestPermission = async (): Promise<boolean> => {
    try {
      let granted = false;

      if (Platform.OS === 'ios') {
        const result = await request(PERMISSIONS.IOS.NOTIFICATIONS);
        granted = result === RESULTS.GRANTED;
      } else if (Platform.OS === 'android') {
        const result = await request(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
        granted = result === RESULTS.GRANTED;
      }

      setIsPermissionGranted(granted);

      if (granted) {
        updateSettings({
          notifications: { ...settings.notifications, enabled: true }
        });
      }

      return granted;
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  };

  const configurePushNotifications = () => {
    PushNotification.configure({
      onRegister: (token) => {
        console.log('Push notification token:', token);
        // In a real app, send this token to your backend
      },

      onNotification: (notification) => {
        console.log('Notification received:', notification);

        if (notification.userInteraction) {
          // User tapped the notification
          handleNotificationPress({
            id: notification.id || Date.now().toString(),
            title: notification.title || 'New Notification',
            message: notification.message || '',
            type: 'info',
            read: false,
            createdAt: new Date().toISOString(),
            data: notification.data,
          });
        }

        if (Platform.OS === 'ios') {
          notification.finish(PushNotificationIOS.FetchResult.NoData);
        }
      },

      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      popInitialNotification: true,
      requestPermissions: false, // We handle permissions manually
    });

    // Create default notification channel for Android
    if (Platform.OS === 'android') {
      PushNotification.createChannel(
        {
          channelId: 'queryflux-default',
          channelName: 'QueryFlux Notifications',
          channelDescription: 'Default notifications from QueryFlux',
          playSound: true,
          soundName: 'default',
          importance: 4,
          vibrate: true,
        },
        (created) => console.log('Channel created:', created)
      );
    }
  };

  const scheduleLocalNotification = (notificationData: Omit<Notification, 'id' | 'createdAt'>) => {
    const notification: Notification = {
      ...notificationData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };

    // Add to local state
    addNotification(notification);

    // Show local push notification
    if (settings.notifications.enabled && isPermissionGranted) {
      PushNotification.localNotification({
        channelId: 'queryflux-default',
        title: notification.title,
        message: notification.message,
        playSound: settings.notifications.system,
        soundName: 'default',
        actions: notification.type === 'alert' ? ['View', 'Dismiss'] : [],
      });
    }
  };

  const cancelLocalNotification = (id: string) => {
    PushNotification.cancelLocalNotifications({ id });
  };

  const markAsRead = (id: string) => {
    markNotificationRead(id);
  };

  const markAllAsRead = () => {
    notifications.forEach(notification => {
      if (!notification.read) {
        markNotificationRead(notification.id);
      }
    });
  };

  const clearAllNotifications = () => {
    clearNotifications();
  };

  const handleNotificationPress = (notification: Notification) => {
    // Mark as read
    markAsRead(notification.id);

    // Handle different notification types
    switch (notification.type) {
      case 'alert':
        // Navigate to alerts screen
        console.log('Navigate to alerts for notification:', notification.id);
        break;
      case 'query':
        // Navigate to queries screen
        console.log('Navigate to queries for notification:', notification.id);
        break;
      case 'connection':
        // Navigate to connections screen
        console.log('Navigate to connections for notification:', notification.id);
        break;
      case 'system':
        // Show system alert
        Alert.alert(notification.title, notification.message);
        break;
      default:
        // Handle custom data or deep links
        if (notification.data?.url) {
          Linking.openURL(notification.data.url);
        }
        break;
    }
  };

  const value: NotificationContextType = {
    isPermissionGranted,
    isPushEnabled: pushEnabled && settings.notifications.enabled,
    notifications,
    unreadCount,
    requestPermission,
    configurePushNotifications,
    scheduleLocalNotification,
    cancelLocalNotification,
    markAsRead,
    markAllAsRead,
    clearAllNotifications,
    handleNotificationPress,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};