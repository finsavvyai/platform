import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@context';
import { useAuth } from '@context';
import { useNotifications } from '@context';
import { useAppStore } from '@store';

interface SettingItemProps {
  title: string;
  subtitle?: string;
  value?: boolean;
  onToggle?: (value: boolean) => void;
  onPress?: () => void;
  type?: 'toggle' | 'navigation' | 'action';
  actionText?: string;
  actionColor?: string;
}

const SettingItem: React.FC<SettingItemProps> = ({
  title,
  subtitle,
  value,
  onToggle,
  onPress,
  type = 'toggle',
  actionText,
  actionColor,
}) => {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    content: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    textContainer: {
      flex: 1,
      marginRight: theme.spacing.md,
    },
    title: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text,
      marginBottom: 2,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
    control: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: 6,
      backgroundColor: actionColor ? `${actionColor}20` : theme.colors.surface,
      borderWidth: 1,
      borderColor: actionColor || theme.colors.border,
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: actionColor || theme.colors.primary,
    },
    arrow: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
  });

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={type === 'navigation' ? onPress : undefined}
      activeOpacity={type === 'navigation' ? 0.7 : 1}
      disabled={type !== 'navigation'}
    >
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        <View style={styles.control}>
          {type === 'toggle' && (
            <Switch
              value={value}
              onValueChange={onToggle}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            />
          )}
          {type === 'navigation' && (
            <Text style={styles.arrow}>›</Text>
          )}
          {type === 'action' && actionText && (
            <TouchableOpacity style={styles.actionButton} onPress={onPress}>
              <Text style={[styles.actionButtonText, { color: actionColor }]}>
                {actionText}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const SettingsScreen: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const { isPermissionGranted, requestPermission } = useNotifications();
  const {
    settings,
    updateSettings,
    resetSettings,
    clearNotifications,
    resetState,
  } = useAppStore();

  const handleThemeChange = (isDark: boolean) => {
    setTheme(isDark ? 'dark' : 'light');
  };

  const handleNotificationToggle = (field: string, value: boolean) => {
    updateSettings({
      notifications: {
        ...settings.notifications,
        [field]: value,
      },
    });
  };

  const handleSyncToggle = (field: string, value: boolean) => {
    updateSettings({
      sync: {
        ...settings.sync,
        [field]: value,
      },
    });
  };

  const handleSecurityToggle = (field: string, value: boolean) => {
    updateSettings({
      security: {
        ...settings.security,
        [field]: value,
      },
    });
  };

  const handlePerformanceToggle = (field: string, value: boolean) => {
    updateSettings({
      performance: {
        ...settings.performance,
        [field]: value,
      },
    });
  };

  const handleRequestNotificationPermission = async () => {
    const granted = await requestPermission();
    if (granted) {
      Alert.alert('Success', 'Notification permission granted!');
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            clearNotifications();
            Alert.alert('Success', 'Cache cleared successfully!');
          },
        },
      ]
    );
  };

  const handleResetSettings = () => {
    Alert.alert(
      'Reset Settings',
      'This will reset all settings to their default values. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetSettings();
            Alert.alert('Success', 'Settings reset to defaults!');
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    scrollView: {
      flex: 1,
    },
    section: {
      marginBottom: theme.spacing.lg,
    },
    sectionHeader: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      backgroundColor: theme.colors.background,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
    },
    sectionCard: {
      backgroundColor: theme.colors.surface,
      marginHorizontal: theme.spacing.lg,
      borderRadius: 12,
      overflow: 'hidden',
    },
    footer: {
      padding: theme.spacing.lg,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    version: {
      textAlign: 'center',
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    userInfo: {
      backgroundColor: theme.colors.surface,
      margin: theme.spacing.lg,
      borderRadius: 12,
      padding: theme.spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
    },
    userAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.spacing.md,
    },
    userAvatarText: {
      fontSize: 20,
      fontWeight: 'bold',
      color: 'white',
    },
    userDetails: {
      flex: 1,
    },
    userName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 2,
    },
    userEmail: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* User Info */}
        <View style={styles.userInfo}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{user?.name || 'Unknown User'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'user@queryflux.com'}</Text>
          </View>
        </View>

        {/* Appearance */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Appearance</Text>
          </View>
          <View style={styles.sectionCard}>
            <SettingItem
              title="Dark Mode"
              subtitle="Enable dark theme for the app"
              value={theme.name === 'dark'}
              onToggle={handleThemeChange}
            />
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Notifications</Text>
          </View>
          <View style={styles.sectionCard}>
            <SettingItem
              title="Enable Notifications"
              subtitle="Allow push notifications"
              value={settings.notifications.enabled}
              onToggle={(value) => handleNotificationToggle('enabled', value)}
            />
            <SettingItem
              title="Alert Notifications"
              subtitle="Get notified about database alerts"
              value={settings.notifications.alerts}
              onToggle={(value) => handleNotificationToggle('alerts', value)}
              disabled={!settings.notifications.enabled}
            />
            <SettingItem
              title="Query Notifications"
              subtitle="Get notified about query completions"
              value={settings.notifications.queries}
              onToggle={(value) => handleNotificationToggle('queries', value)}
              disabled={!settings.notifications.enabled}
            />
            <SettingItem
              title="System Notifications"
              subtitle="Get notified about system events"
              value={settings.notifications.system}
              onToggle={(value) => handleNotificationToggle('system', value)}
              disabled={!settings.notifications.enabled}
            />
            {!isPermissionGranted && (
              <SettingItem
                title="Grant Permission"
                subtitle="Enable notification access in system settings"
                type="action"
                actionText="Grant"
                actionColor={theme.colors.primary}
                onPress={handleRequestNotificationPermission}
              />
            )}
          </View>
        </View>

        {/* Sync */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Sync & Backup</Text>
          </View>
          <View style={styles.sectionCard}>
            <SettingItem
              title="Auto Sync"
              subtitle="Automatically sync data across devices"
              value={settings.sync.enabled}
              onToggle={(value) => handleSyncToggle('enabled', value)}
            />
            <SettingItem
              title="WiFi Only"
              subtitle="Only sync when connected to WiFi"
              value={settings.sync.wifiOnly}
              onToggle={(value) => handleSyncToggle('wifiOnly', value)}
              disabled={!settings.sync.enabled}
            />
          </View>
        </View>

        {/* Security */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Security</Text>
          </View>
          <View style={styles.sectionCard}>
            <SettingItem
              title="Biometric Authentication"
              subtitle="Use fingerprint or Face ID to unlock"
              value={settings.security.biometric}
              onToggle={(value) => handleSecurityToggle('biometric', value)}
            />
            <SettingItem
              title="Auto Lock"
              subtitle="Automatically lock the app when inactive"
              value={settings.security.autoLock}
              onToggle={(value) => handleSecurityToggle('autoLock', value)}
            />
          </View>
        </View>

        {/* Performance */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Performance</Text>
          </View>
          <View style={styles.sectionCard}>
            <SettingItem
              title="Offline Mode"
              subtitle="Enable offline data access"
              value={settings.performance.offlineMode}
              onToggle={(value) => handlePerformanceToggle('offlineMode', value)}
            />
            <SettingItem
              title="Clear Cache"
              subtitle="Clear temporary data and cache"
              type="action"
              actionText="Clear"
              actionColor={theme.colors.warning}
              onPress={handleClearCache}
            />
          </View>
        </View>

        {/* Data Management */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Data Management</Text>
          </View>
          <View style={styles.sectionCard}>
            <SettingItem
              title="Offline Status"
              subtitle="View offline data and sync status"
              type="navigation"
              onPress={() => console.log('Navigate to offline status')}
            />
            <SettingItem
              title="Reset Settings"
              subtitle="Reset all settings to default values"
              type="action"
              actionText="Reset"
              actionColor={theme.colors.warning}
              onPress={handleResetSettings}
            />
            <SettingItem
              title="Sign Out"
              subtitle="Sign out of your account"
              type="action"
              actionText="Sign Out"
              actionColor={theme.colors.error}
              onPress={handleLogout}
            />
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.version}>QueryFlux Mobile v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SettingsScreen;