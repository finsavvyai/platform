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
import { Lock, Mail, User } from 'lucide-react-native';
import { useTheme } from '../../src/hooks/useTheme';
import { useAuthStore } from '../../src/stores/authStore';
import { Button, Input } from '../../src/components/atoms';
import { spacing, typography } from '../../src/theme/tokens';

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function RegisterScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { register, isLoading, error, clearError } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const validate = (): boolean => {
    const errors: FormErrors = {};
    if (!name.trim()) errors.name = 'Name is required';
    if (!email.trim()) errors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) errors.email = 'Invalid email format';
    if (!password) errors.password = 'Password is required';
    else if (password.length < 8) errors.password = 'Minimum 8 characters';
    if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async () => {
    clearError();
    if (!validate()) return;
    const success = await register({
      name: name.trim(),
      email: email.trim(),
      password,
      confirmPassword,
    });
    if (success) {
      router.replace('/(tabs)');
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
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Create Account
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Start automating your tests with AI
            </Text>
          </View>

          <View style={styles.form}>
            {error && (
              <View style={[styles.errorBanner, { backgroundColor: `${colors.accentError}20` }]}>
                <Text style={{ color: colors.accentError, fontSize: 14 }}>{error}</Text>
              </View>
            )}

            <Input
              label="Full Name"
              placeholder="John Doe"
              value={name}
              onChangeText={setName}
              error={formErrors.name}
              autoCapitalize="words"
              autoComplete="name"
              leftIcon={<User size={18} color={colors.textMuted} />}
              variant="glass"
            />

            <Input
              label="Email"
              placeholder="you@company.com"
              value={email}
              onChangeText={setEmail}
              error={formErrors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              leftIcon={<Mail size={18} color={colors.textMuted} />}
              variant="glass"
            />

            <Input
              label="Password"
              placeholder="Minimum 8 characters"
              value={password}
              onChangeText={setPassword}
              error={formErrors.password}
              isPassword
              autoComplete="new-password"
              leftIcon={<Lock size={18} color={colors.textMuted} />}
              variant="glass"
            />

            <Input
              label="Confirm Password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              error={formErrors.confirmPassword}
              isPassword
              leftIcon={<Lock size={18} color={colors.textMuted} />}
              variant="glass"
            />

            <Button
              variant="primary"
              size="lg"
              fullWidth
              onPress={handleRegister}
              isLoading={isLoading}
            >
              Create Account
            </Button>

            <Button
              variant="ghost"
              size="md"
              onPress={() => router.push('/(auth)/login')}
            >
              Already have an account? Sign In
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
