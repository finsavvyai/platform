/**
 * Settings screen for app configuration
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import {useAuth} from '../../contexts/AuthContext';
import {theme} from '../../styles/theme';

const SettingsScreen: React.FC = () => {
  const {logout, user} = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Logout', style: 'destructive', onPress: logout},
      ]
    );
  };

  const renderSettingItem = (
    icon: string,
    title: string,
    subtitle?: string,
    onPress?: () => void,
    showChevron: boolean = true
  ) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress}>
      <View style={styles.settingIcon}>
        <Icon name={icon} size={24} color={theme.colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {showChevron && onPress && (
        <Icon name="chevron_right" size={24} color={theme.colors.textSecondary} />
      )}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      {/* User Info */}
      <View style={styles.section}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Icon name="person" size={32} color={theme.colors.white} />
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{user?.username || 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'No email'}</Text>
          </View>
        </View>
      </View>

      {/* General Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>General</Text>
        {renderSettingItem(
          'notifications',
          'Notifications',
          'Manage push notifications',
          () => console.log('Notifications')
        )}
        {renderSettingItem(
          'language',
          'Language',
          'English',
          () => console.log('Language')
        )}
        {renderSettingItem(
          'palette',
          'Theme',
          'System default',
          () => console.log('Theme')
        )}
      </View>

      {/* Connection Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection</Text>
        {renderSettingItem(
          'wifi',
          'Server Settings',
          'Configure server connection',
          () => console.log('Server Settings')
        )}
        {renderSettingItem(
          'sync',
          'Sync Settings',
          'Auto-sync every 5 minutes',
          () => console.log('Sync Settings')
        )}
        {renderSettingItem(
          'security',
          'Security',
          'Manage security settings',
          () => console.log('Security')
        )}
      </View>

      {/* Support */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        {renderSettingItem(
          'help',
          'Help & Support',
          'Get help and contact support',
          () => console.log('Help')
        )}
        {renderSettingItem(
          'info',
          'About',
          'Version 2.0.0',
          () => console.log('About')
        )}
        {renderSettingItem(
          'rate_review',
          'Rate App',
          'Rate us on the App Store',
          () => console.log('Rate App')
        )}
      </View>

      {/* Account */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        {renderSettingItem(
          'logout',
          'Logout',
          'Sign out of your account',
          handleLogout,
          false
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Multi-Database Manager Mobile v2.0.0
        </Text>
        <Text style={styles.footerText}>
          © 2024 Database Tools. All rights reserved.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  section: {
    backgroundColor: theme.colors.white,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.sm,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textSecondary,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text,
  },
  userEmail: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.separator,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text,
  },
  settingSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  footer: {
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  footerText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
});

export default SettingsScreen;