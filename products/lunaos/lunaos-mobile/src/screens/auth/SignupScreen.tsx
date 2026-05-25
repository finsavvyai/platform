/**
 * Signup screen with name, email, password fields.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useThemeColors } from '../../hooks/useThemeColors';
import { spacing, typography } from '../../theme';
import { TextInput } from '../../components/TextInput';
import { Button } from '../../components/Button';
import { useAuthStore } from '../../store/authStore';
import { OAuthButtons } from '../../components/OAuthButtons';
import type { AuthStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

export function SignupScreen({ navigation }: Props): React.ReactElement {
  const colors = useThemeColors();
  const { signup, isLoading, error, clearError } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSignup = useCallback(async () => {
    setLocalError('');
    clearError();

    if (!email.trim()) {
      setLocalError('Email is required');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    try {
      await signup(email.trim(), password, name.trim());
    } catch {
      // Error handled by store
    }
  }, [email, password, name, signup, clearError]);

  const displayError = localError || error;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Create Account
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Get started with LunaOS agents
          </Text>
        </View>

        {displayError ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.error + '1A' }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>
              {displayError}
            </Text>
          </View>
        ) : null}

        <OAuthButtons />

        <TextInput
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Your name (optional)"
          textContentType="name"
        />

        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          textContentType="emailAddress"
        />

        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Min 8 characters"
          secureTextEntry
          textContentType="newPassword"
        />

        <Button
          title="Create Account"
          onPress={handleSignup}
          loading={isLoading}
          style={styles.button}
        />

        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          style={styles.linkRow}
          accessibilityRole="link"
          accessibilityLabel="Sign in"
          accessibilityHint="Navigate to the login screen"
        >
          <Text style={[styles.linkText, { color: colors.textSecondary }]}>
            Already have an account?{' '}
          </Text>
          <Text style={[styles.linkText, { color: colors.accent }]}>
            Sign In
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingTop: spacing.xxl },
  header: { marginBottom: spacing.xl },
  title: { ...typography.largeTitle, marginBottom: spacing.xs },
  subtitle: { ...typography.body },
  errorBanner: {
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  errorText: { ...typography.footnote },
  button: { marginTop: spacing.sm },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  linkText: { ...typography.subheadline },
});
