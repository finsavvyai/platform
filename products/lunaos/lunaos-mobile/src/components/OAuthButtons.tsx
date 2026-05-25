/**
 * Social OAuth login buttons — Google, GitHub, Microsoft.
 * Opens OAuth flow in system browser via expo-web-browser.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useThemeColors } from '../hooks/useThemeColors';
import { spacing, typography, TOUCH_TARGET } from '../theme';
import { setToken } from '../utils/storage';
import { useAuthStore } from '../store/authStore';

const API_URL = 'https://api.lunaos.ai';

interface OAuthProvider {
  id: string;
  label: string;
  bg: string;
  textColor: string;
}

const providers: OAuthProvider[] = [
  { id: 'google', label: 'Continue with Google', bg: '#FFFFFF', textColor: '#1F1F1F' },
  { id: 'github', label: 'Continue with GitHub', bg: '#24292E', textColor: '#FFFFFF' },
  { id: 'microsoft', label: 'Continue with Microsoft', bg: '#00A4EF', textColor: '#FFFFFF' },
];

export function OAuthButtons(): React.ReactElement {
  const colors = useThemeColors();
  const { restore } = useAuthStore();
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const handleOAuth = async (provider: string) => {
    setLoadingProvider(provider);
    try {
      const redirectUri = Linking.createURL('auth/callback');
      const result = await WebBrowser.openAuthSessionAsync(
        `${API_URL}/auth/oauth/${provider}?redirect_uri=${encodeURIComponent(redirectUri)}`,
        redirectUri,
      );

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const token = url.searchParams.get('token');
        if (token) {
          await setToken(token);
          await restore();
        }
      }
    } catch {
      Alert.alert('Authentication Error', 'Unable to complete sign in. Please try again.');
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <View style={styles.container}>
      {providers.map((p) => (
        <TouchableOpacity
          key={p.id}
          style={[
            styles.button,
            { backgroundColor: p.bg },
            p.id === 'google' && { borderWidth: 1, borderColor: colors.separator },
          ]}
          onPress={() => handleOAuth(p.id)}
          disabled={loadingProvider !== null}
          accessibilityLabel={p.label}
          accessibilityRole="button"
        >
          <Text style={[styles.buttonText, { color: p.textColor }]}>
            {loadingProvider === p.id ? 'Connecting...' : p.label}
          </Text>
        </TouchableOpacity>
      ))}

      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: colors.separator }]} />
        <Text style={[styles.dividerText, { color: colors.textSecondary }]}>
          or continue with email
        </Text>
        <View style={[styles.dividerLine, { backgroundColor: colors.separator }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  button: {
    minHeight: TOUCH_TARGET,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  buttonText: {
    ...typography.headline,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: {
    ...typography.footnote,
    marginHorizontal: spacing.md,
  },
});
