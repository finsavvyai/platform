import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@context';
import { useTheme } from '@context';

const RegisterScreen: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { register, loading, error, clearError } = useAuth();
  const { theme } = useTheme();

  const validateForm = () => {
    if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await register(email.trim(), password.trim(), name.trim());
    } catch (error) {
      // Error is handled by AuthContext
    }
  };

  const handleSignIn = () => {
    // Navigate back to sign in screen
    console.log('Navigate to sign in');
  };

  // Clear errors when user starts typing
  const handleInputChange = () => {
    if (error) clearError();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.xl,
    },
    header: {
      alignItems: 'center',
      marginBottom: theme.spacing.xl,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    form: {
      width: '100%',
    },
    inputContainer: {
      marginBottom: theme.spacing.md,
    },
    label: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      fontSize: 16,
      color: theme.colors.text,
      backgroundColor: theme.colors.surface,
    },
    passwordContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
    },
    passwordInput: {
      flex: 1,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      fontSize: 16,
      color: theme.colors.text,
    },
    togglePassword: {
      paddingHorizontal: theme.spacing.md,
    },
    togglePasswordText: {
      fontSize: 14,
      color: theme.colors.primary,
    },
    requirements: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: 8,
      marginBottom: theme.spacing.md,
    },
    requirementTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    requirement: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: 2,
    },
    errorText: {
      color: theme.colors.error,
      fontSize: 14,
      marginTop: theme.spacing.sm,
    },
    button: {
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      marginTop: theme.spacing.lg,
    },
    buttonDisabled: {
      backgroundColor: theme.colors.border,
    },
    buttonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
    footer: {
      alignItems: 'center',
      marginTop: theme.spacing.xl,
    },
    footerText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.sm,
    },
    link: {
      fontSize: 14,
      color: theme.colors.primary,
      fontWeight: '500',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Join QueryFlux and manage your databases efficiently
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  handleInputChange();
                }}
                placeholder="Enter your full name"
                placeholderTextColor={theme.colors.textSecondary}
                autoCapitalize="words"
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  handleInputChange();
                }}
                placeholder="Enter your email"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    handleInputChange();
                  }}
                  placeholder="Enter your password"
                  placeholderTextColor={theme.colors.textSecondary}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.togglePassword}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.togglePasswordText}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    handleInputChange();
                  }}
                  placeholder="Confirm your password"
                  placeholderTextColor={theme.colors.textSecondary}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.togglePassword}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Text style={styles.togglePasswordText}>
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.requirements}>
              <Text style={styles.requirementTitle}>Password Requirements:</Text>
              <Text style={styles.requirement}>• At least 8 characters</Text>
              <Text style={styles.requirement}>• Include uppercase and lowercase letters</Text>
              <Text style={styles.requirement}>• Include numbers</Text>
              <Text style={styles.requirement}>• Include special characters (recommended)</Text>
            </View>

            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading || !name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()}
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity onPress={handleSignIn}>
              <Text style={styles.link}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default RegisterScreen;