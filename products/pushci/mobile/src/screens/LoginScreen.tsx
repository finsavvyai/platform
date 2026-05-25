import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { colors, spacing, fontSize } from '../theme';

export default function LoginScreen() {
  const { loginWithGitHub, loginWithGitLab, unlockWithBiometric, locked, error } = useAuth();
  const autoTriggered = useRef(false);

  // Auto-prompt Face ID as soon as we render in the locked state so users
  // don't have to tap an extra button on every cold start.
  useEffect(() => {
    if (locked && !autoTriggered.current) {
      autoTriggered.current = true;
      void unlockWithBiometric();
    }
  }, [locked, unlockWithBiometric]);

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.logoBox}>
          <Text style={styles.logoMark}>RL</Text>
        </View>
        <Text style={styles.title}>PushCI</Text>
        <Text style={styles.subtitle}>Zero-config CI/CD for developers</Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {locked ? (
          <TouchableOpacity style={styles.buttonPrimary} onPress={() => void unlockWithBiometric()}>
            <Text style={styles.buttonText}>Unlock with Face ID</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={styles.button} onPress={loginWithGitHub}>
              <Text style={styles.buttonText}>Continue with GitHub</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={loginWithGitLab}>
              <Text style={styles.buttonText}>Continue with GitLab</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.tagline}>
          Free forever for open source.{'\n'}Pro starts at $9/mo.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.xxl },
  inner: { alignItems: 'center' },
  logoBox: {
    width: 56, height: 56, borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logoMark: { fontSize: fontSize.xl, fontWeight: '800', color: colors.black },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: 32 },
  errorBox: {
    backgroundColor: colors.errorBg, borderRadius: 8,
    padding: spacing.md, width: '100%', marginBottom: spacing.lg,
  },
  errorText: { color: colors.error, fontSize: fontSize.sm, textAlign: 'center' },
  button: {
    width: '100%', backgroundColor: '#27272a', borderRadius: 10, borderWidth: 1,
    borderColor: colors.surfaceBorder, paddingVertical: 14, alignItems: 'center',
    marginBottom: spacing.md,
  },
  buttonSecondary: { borderColor: '#3f3f46' },
  buttonPrimary: {
    width: '100%', backgroundColor: colors.accent, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginBottom: spacing.md,
  },
  buttonText: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' },
  tagline: { color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'center', marginTop: spacing.lg },
});
