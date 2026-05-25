/**
 * Push notification service for database alerts and updates
 */

import PushNotification, {Importance} from 'react-native-push-notification';
import {Platform, PermissionsAndroid} from 'react-native';
import {showMessage} from 'react-native-flash-message';

import {StorageService} from './StorageService';

export interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: 'alert' | 'info' | 'warning' | 'error';
  connectionId?: string;
  timestamp: string;
  data?: any;
}

class NotificationServiceClass {
  private isInitialized: boolean = false;

  initialize() {
    if (this.isInitialized) {
      return;
    }

    PushNotification.configure({
      // Called when token is generated
      onRegister: (token) => {
        console.log('FCM Token:', token);
        this.saveFCMToken(token.token);
      },

      // Called when a remote notification is received
      onNotification: (notification) => {
        console.log('Notification received:', notification);
        this.handleNotification(notification);
      },

      // Called when a remote notification is received while app is in foreground
      onRemoteNotification: (notification) => {
        console.log('Remote notification:', notification);
        this.handleRemoteNotification(notification);
      },

      // Android only
      senderID: '1234567890', // Replace with your FCM sender ID
      
      // iOS only
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });

    // Create notification channels for Android
    if (Platform.OS === 'android') {
      this.createNotificationChannels();
    }

    this.isInitialized = true;
  }

  private createNotificationChannels() {
    const channels = [
      {
        channelId: 'database-alerts',
        channelName: 'Database Alerts',
        channelDescription: 'Critical database alerts and errors',
        importance: Importance.HIGH,
        vibrate: true,
      },
      {
        channelId: 'database-info',
        channelName: 'Database Info',
        channelDescription: 'Database status and information updates',
        importance: Importance.DEFAULT,
        vibrate: false,
      },
      {
        channelId: 'query-results',
        channelName: 'Query Results',
        channelDescription: 'Query execution results and notifications',
        importance: Importance.LOW,
        vibrate: false,
      },
    ];

    channels.forEach(channel => {
      PushNotification.createChannel(channel, () => {
        console.log(`Created notification channel: ${channel.channelId}`);
      });
    });
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          {
            title: 'Notification Permission',
            message: 'Multi-Database Manager needs notification permissions to alert you about database issues.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (error) {
        console.error('Failed to request notification permissions:', error);
        return false;
      }
    }

    // iOS permissions are handled in PushNotification.configure
    return true;
  }

  private async saveFCMToken(token: string) {
    try {
      await StorageService.setSecureItem('fcm_token', token);
      
      // Send token to server for push notifications
      // This would be implemented when the API service is available
      console.log('FCM token saved:', token);
    } catch (error) {
      console.error('Failed to save FCM token:', error);
    }
  }

  private handleNotification(notification: any) {
    // Handle notification tap
    if (notification.userInteraction) {
      this.handleNotificationTap(notification);
    } else {
      // Show in-app notification
      this.showInAppNotification(notification);
    }
  }

  private handleRemoteNotification(notification: any) {
    // Process remote notification data
    const notificationData: NotificationData = {
      id: notification.id || Date.now().toString(),
      title: notification.title || 'Database Alert',
      message: notification.message || notification.body || '',
      type: notification.data?.type || 'info',
      connectionId: notification.data?.connectionId,
      timestamp: new Date().toISOString(),
      data: notification.data,
    };

    // Store notification for history
    this.storeNotification(notificationData);

    // Show local notification if app is in foreground
    if (notification.foreground) {
      this.showLocalNotification(notificationData);
    }
  }

  private handleNotificationTap(notification: any) {
    // Navigate to relevant screen based on notification data
    const {data} = notification;
    
    if (data?.connectionId) {
      // Navigate to connection details
      console.log('Navigate to connection:', data.connectionId);
    } else if (data?.screen) {
      // Navigate to specific screen
      console.log('Navigate to screen:', data.screen);
    }
  }

  private showInAppNotification(notification: any) {
    const type = notification.data?.type || 'info';
    let messageType: 'success' | 'info' | 'warning' | 'danger' = 'info';

    switch (type) {
      case 'error':
        messageType = 'danger';
        break;
      case 'warning':
        messageType = 'warning';
        break;
      case 'alert':
        messageType = 'danger';
        break;
      default:
        messageType = 'info';
    }

    showMessage({
      message: notification.title || 'Database Notification',
      description: notification.message || notification.body,
      type: messageType,
      duration: 5000,
    });
  }

  showLocalNotification(data: NotificationData) {
    const channelId = this.getChannelId(data.type);

    PushNotification.localNotification({
      id: data.id,
      title: data.title,
      message: data.message,
      channelId,
      userInfo: data.data,
      importance: data.type === 'error' || data.type === 'alert' ? 'high' : 'default',
      vibrate: data.type === 'error' || data.type === 'alert',
      playSound: true,
      soundName: 'default',
    });
  }

  private getChannelId(type: string): string {
    switch (type) {
      case 'error':
      case 'alert':
        return 'database-alerts';
      case 'warning':
        return 'database-info';
      default:
        return 'database-info';
    }
  }

  private async storeNotification(notification: NotificationData) {
    try {
      const notifications = await this.getStoredNotifications();
      notifications.unshift(notification);
      
      // Keep only last 100 notifications
      const trimmedNotifications = notifications.slice(0, 100);
      
      await StorageService.setObject('notifications', trimmedNotifications);
    } catch (error) {
      console.error('Failed to store notification:', error);
    }
  }

  async getStoredNotifications(): Promise<NotificationData[]> {
    try {
      return (await StorageService.getObject('notifications')) || [];
    } catch (error) {
      console.error('Failed to get stored notifications:', error);
      return [];
    }
  }

  async clearNotifications() {
    try {
      await StorageService.removeItem('notifications');
      PushNotification.cancelAllLocalNotifications();
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  }

  async getFCMToken(): Promise<string | null> {
    return await StorageService.getSecureItem('fcm_token');
  }

  // Schedule local notifications
  scheduleNotification(data: NotificationData, date: Date) {
    PushNotification.localNotificationSchedule({
      id: data.id,
      title: data.title,
      message: data.message,
      date,
      channelId: this.getChannelId(data.type),
      userInfo: data.data,
    });
  }

  cancelNotification(notificationId: string) {
    PushNotification.cancelLocalNotifications({id: notificationId});
  }

  cancelAllNotifications() {
    PushNotification.cancelAllLocalNotifications();
  }

  // Badge management (iOS)
  setBadgeCount(count: number) {
    if (Platform.OS === 'ios') {
      PushNotification.setApplicationIconBadgeNumber(count);
    }
  }

  clearBadge() {
    this.setBadgeCount(0);
  }

  cleanup() {
    this.cancelAllNotifications();
    this.clearBadge();
  }
}

export const NotificationService = new NotificationServiceClass();