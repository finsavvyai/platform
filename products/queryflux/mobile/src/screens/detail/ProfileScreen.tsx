import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@context';
import { useAuth } from '@context';
import { useAppStore } from '@store';

const ProfileScreen: React.FC = () => {
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const { resetState } = useAppStore();

  const handleEditProfile = () => {
    // Navigate to edit profile screen
    console.log('Navigate to edit profile');
  };

  const handleChangePassword = () => {
    // Navigate to change password screen
    console.log('Navigate to change password');
  };

  const handleExportData = () => {
    Alert.alert(
      'Export Data',
      'This will export all your data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          style: 'default',
          onPress: () => {
            // Simulate data export
            Alert.alert('Success', 'Data exported successfully!');
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Handle account deletion
            console.log('Account deleted');
            logout();
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'default',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const menuItems = [
    {
      title: 'Edit Profile',
      subtitle: 'Update your personal information',
      icon: '👤',
      onPress: handleEditProfile,
    },
    {
      title: 'Change Password',
      subtitle: 'Update your password',
      icon: '🔐',
      onPress: handleChangePassword,
    },
    {
      title: 'Export Data',
      subtitle: 'Download all your data',
      icon: '📤',
      onPress: handleExportData,
    },
    {
      title: 'Privacy Policy',
      subtitle: 'View our privacy policy',
      icon: '🔒',
      onPress: () => console.log('Open privacy policy'),
    },
    {
      title: 'Terms of Service',
      subtitle: 'View our terms of service',
      icon: '📋',
      onPress: () => console.log('Open terms of service'),
    },
    {
      title: 'Support',
      subtitle: 'Get help and support',
      icon: '💬',
      onPress: () => console.log('Open support'),
    },
    {
      title: 'Delete Account',
      subtitle: 'Permanently delete your account',
      icon: '🗑️',
      onPress: handleDeleteAccount,
      isDestructive: true,
    },
  ];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      padding: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    profileCard: {
      alignItems: 'center',
      paddingVertical: theme.spacing.lg,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.md,
    },
    avatarText: {
      fontSize: 32,
      fontWeight: 'bold',
      color: 'white',
    },
    avatarImage: {
      width: 80,
      height: 80,
      borderRadius: 40,
      marginBottom: theme.spacing.md,
    },
    name: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    email: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.sm,
    },
    role: {
      backgroundColor: theme.colors.primary + '20',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: 12,
    },
    roleText: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '500',
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: theme.spacing.lg,
    },
    section: {
      marginBottom: theme.spacing.xl,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
    },
    menuItem: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    menuItemIcon: {
      fontSize: 20,
      marginRight: theme.spacing.md,
    },
    menuItemContent: {
      flex: 1,
    },
    menuItemTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text,
      marginBottom: 2,
    },
    menuItemSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    menuItemArrow: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    actionButton: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: theme.spacing.md,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      marginBottom: theme.spacing.md,
    },
    actionButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    signOutButton: {
      backgroundColor: theme.colors.error,
      borderRadius: 12,
      padding: theme.spacing.md,
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
    },
    signOutButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: 'white',
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.lg,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 2,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
  });

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <Text style={{ fontSize: 16, color: theme.colors.textSecondary }}>
            User information not available
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.profileCard}>
          {user.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
          )}
          <Text style={styles.name}>{user.name || 'Unknown User'}</Text>
          <Text style={styles.email}>{user.email || 'user@queryflux.com'}</Text>
          <View style={styles.role}>
            <Text style={styles.roleText}>
              {user.role || 'User'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* User Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>42</Text>
              <Text style={styles.statLabel}>Connections</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>1,234</Text>
              <Text style={styles.statLabel}>Queries</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>98%</Text>
              <Text style={styles.statLabel}>Success Rate</Text>
            </View>
          </View>

          {/* Account Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Settings</Text>
            {menuItems.slice(0, 3).map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.menuItem}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <Text style={styles.menuItemIcon}>{item.icon}</Text>
                <View style={styles.menuItemContent}>
                  <Text style={styles.menuItemTitle}>{item.title}</Text>
                  <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                </View>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Legal & Support */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Legal & Support</Text>
            {menuItems.slice(3, 6).map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.menuItem}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <Text style={styles.menuItemIcon}>{item.icon}</Text>
                <View style={styles.menuItemContent}>
                  <Text style={styles.menuItemTitle}>{item.title}</Text>
                  <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                </View>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Danger Zone */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Danger Zone</Text>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={menuItems[6].onPress}
              activeOpacity={0.7}
            >
              <Text style={styles.menuItemIcon}>{menuItems[6].icon}</Text>
              <View style={styles.menuItemContent}>
                <Text style={[styles.menuItemTitle, { color: theme.colors.error }]}>
                  {menuItems[6].title}
                </Text>
                <Text style={styles.menuItemSubtitle}>{menuItems[6].subtitle}</Text>
              </View>
              <Text style={styles.menuItemArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Sign Out */}
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;