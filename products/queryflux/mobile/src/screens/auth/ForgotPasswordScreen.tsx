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

const ForgotPasswordScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { resetPassword, loading, error, clearError } = useAuth();
  const { theme } = useTheme();

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    try {
      await resetPassword(email.trim());
      setIsSubmitted(true);
    } catch (error) {
      // Error is handled by AuthContext
    }
  };

  const handleBackToLogin = () => {
    // Navigate back to login screen
    console.log('Navigate to login');
  };

  // Clear errors when user starts typing
  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (error) clearError();
    if (isSubmitted) setIsSubmitted(false);
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
    icon: {
      fontSize: 64,
      marginBottom: theme.spacing.lg,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
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
    helperText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.sm,
      fontStyle: 'italic',
    },
    errorText: {
      color: theme.colors.error,
      fontSize: 14,
      marginTop: theme.spacing.sm,
    },
    successContainer: {
      backgroundColor: `${theme.colors.success}20`,
      borderColor: theme.colors.success,
      borderWidth: 1,
      borderRadius: 8,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    successTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.success,
      marginBottom: theme.spacing.sm,
    },
    successMessage: {
      fontSize: 14,
      color: theme.colors.text,
      lineHeight: 20,
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
    backButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.primary,
      borderRadius: 8,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      marginTop: theme.spacing.md,
    },
    backButtonText: {
      color: theme.colors.primary,
      fontSize: 16,
      fontWeight: '500',
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
            <Text style={styles.icon}>🔐</Text>
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>
              Enter your email address and we'll send you instructions to reset your password.
            </Text>
          </View>

          <View style={styles.form}>
            {isSubmitted ? (
              <View style={styles.successContainer}>
                <Text style={styles.successTitle}>📧 Check Your Email</Text>
                <Text style={styles.successMessage}>
                  We've sent password reset instructions to {email}. Please check your inbox and follow the link to reset your password.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Email Address</Text>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={handleEmailChange}
                    placeholder="Enter your email address"
                    placeholderTextColor={theme.colors.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                  <Text style={styles.helperText}>
                    Enter the email address associated with your QueryFlux account.
                  </Text>
                </View>

                {error && (
                  <Text style={styles.errorText}>{error}</Text>
                )}

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleSubmit}
                  disabled={loading || !email.trim()}
                >
                  {loading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={styles.buttonText}>Send Reset Instructions</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackToLogin}
              disabled={loading}
            >
              <Text style={styles.backButtonText}>
                {isSubmitted ? 'Back to Sign In' : 'Cancel'}
              </Text>
            </TouchableOpacity>
          </View>

          {!isSubmitted && (
            <View style={styles.footer}>
              <Text style={styles.footerText}>Remember your password?</Text>
              <TouchableOpacity onPress={handleBackToLogin}>
                <Text style={styles.link}>Sign In</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ForgotPasswordScreen;