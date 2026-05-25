import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lock, Mail } from 'lucide-react-native';
import { useTheme } from '../../src/hooks/useTheme';
import { useAuthStore } from '../../src/stores/authStore';
import { useBiometricAuth } from '../../src/hooks/useBiometricAuth';
import { Button, Input } from '../../src/components/atoms';
import { spacing, typography } from '../../src/theme/tokens';

export default function LoginScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuthStore();
  const { isBiometricAvailable, authenticate } = useBiometricAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formErrors, setFormErrors] = useState<{ email?: string; password?: string }>({});

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) errors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) errors.email = 'Invalid email format';
    if (!password) errors.password = 'Password is required';
    else if (password.length < 6) errors.password = 'Password must be at least 6 characters';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async () => {
    clearError();
    if (!validate()) return;
    await login({ email: email.trim(), password });
  };

  const handleBiometric = async () => {
    const success = await authenticate();
    if (success) {
      await login({ email: email.trim(), password });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={[styles.logo, { color: colors.accentPrimary }]}>Q</Text>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Welcome to Qestro
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              AI-powered testing automation
            </Text>
          </View>

          <View style={styles.form}>
            {error && (
              <View style={[styles.errorBanner, { backgroundColor: `${colors.accentError}20` }]}>
                <Text style={{ color: colors.accentError, fontSize: 14 }}>{error}</Text>
              </View>
            )}

            <Input
              label="Email"
              placeholder="you@company.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (formErrors.email) setFormErrors((e) => ({ ...e, email: undefined }));
              }}
              error={formErrors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              leftIcon={<Mail size={18} color={colors.textMuted} />}
              variant="glass"
              testID="login-email"
            />

            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (formErrors.password) setFormErrors((e) => ({ ...e, password: undefined }));
              }}
              error={formErrors.password}
              isPassword
              autoComplete="password"
              leftIcon={<Lock size={18} color={colors.textMuted} />}
              variant="glass"
              testID="login-password"
            />

            <Button
              variant="primary"
              size="lg"
              fullWidth
              onPress={handleLogin}
              isLoading={isLoading}
              testID="login-submit"
            >
              Sign In
            </Button>

            {isBiometricAvailable && (
              <Button
                variant="glass"
                size="lg"
                fullWidth
                onPress={handleBiometric}
                testID="login-biometric"
              >
                Sign In with Biometrics
              </Button>
            )}

            <Button
              variant="ghost"
              size="md"
              onPress={() => router.push('/(auth)/register')}
              testID="login-register-link"
            >
              Don&apos;t have an account? Sign Up
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  logo: {
    fontSize: 56,
    fontWeight: '800',
    marginBottom: spacing.base,
  },
  title: {
    ...typography.title1,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
  },
  form: {
    gap: spacing.base,
  },
  errorBanner: {
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
});
