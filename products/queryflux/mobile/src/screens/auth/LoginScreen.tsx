/**
 * Login screen for authentication
 */

import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {useForm, Controller} from 'react-hook-form';
import Icon from 'react-native-vector-icons/MaterialIcons';

import {useAuth} from '../../contexts/AuthContext';
import {theme} from '../../styles/theme';
import {ApiService} from '../../services/ApiService';

interface LoginForm {
  serverUrl: string;
  username: string;
  password: string;
}

const LoginScreen: React.FC = () => {
  const {login, isLoading} = useAuth();
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const {
    control,
    handleSubmit,
    formState: {errors},
    watch,
  } = useForm<LoginForm>({
    defaultValues: {
      serverUrl: 'http://localhost:8000',
      username: '',
      password: '',
    },
  });

  const serverUrl = watch('serverUrl');

  const testConnection = async () => {
    if (!serverUrl) return;

    setTestingConnection(true);
    setConnectionStatus('idle');

    try {
      const isConnected = await ApiService.testConnection(serverUrl);
      setConnectionStatus(isConnected ? 'success' : 'error');
    } catch (error) {
      setConnectionStatus('error');
    } finally {
      setTestingConnection(false);
    }
  };

  const onSubmit = async (data: LoginForm) => {
    await login(data.username, data.password, data.serverUrl);
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'success':
        return <Icon name="check-circle" size={20} color={theme.colors.success} />;
      case 'error':
        return <Icon name="error" size={20} color={theme.colors.error} />;
      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Icon name="storage" size={64} color={theme.colors.primary} />
          <Text style={styles.title}>Multi-Database Manager</Text>
          <Text style={styles.subtitle}>Connect to your database server</Text>
        </View>

        <View style={styles.form}>
          {/* Server URL */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Server URL</Text>
            <View style={styles.inputContainer}>
              <Controller
                control={control}
                name="serverUrl"
                rules={{
                  required: 'Server URL is required',
                  pattern: {
                    value: /^https?:\/\/.+/,
                    message: 'Please enter a valid URL',
                  },
                }}
                render={({field: {onChange, onBlur, value}}) => (
                  <TextInput
                    style={[styles.input, errors.serverUrl && styles.inputError]}
                    placeholder="http://localhost:8000"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                )}
              />
              <TouchableOpacity
                style={styles.testButton}
                onPress={testConnection}
                disabled={testingConnection || !serverUrl}>
                {testingConnection ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  getConnectionStatusIcon() || (
                    <Icon name="wifi" size={20} color={theme.colors.primary} />
                  )
                )}
              </TouchableOpacity>
            </View>
            {errors.serverUrl && (
              <Text style={styles.errorText}>{errors.serverUrl.message}</Text>
            )}
          </View>

          {/* Username */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <Controller
              control={control}
              name="username"
              rules={{required: 'Username is required'}}
              render={({field: {onChange, onBlur, value}}) => (
                <TextInput
                  style={[styles.input, errors.username && styles.inputError]}
                  placeholder="Enter username"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              )}
            />
            {errors.username && (
              <Text style={styles.errorText}>{errors.username.message}</Text>
            )}
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <Controller
              control={control}
              name="password"
              rules={{required: 'Password is required'}}
              render={({field: {onChange, onBlur, value}}) => (
                <TextInput
                  style={[styles.input, errors.password && styles.inputError]}
                  placeholder="Enter password"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              )}
            />
            {errors.password && (
              <Text style={styles.errorText}>{errors.password.message}</Text>
            )}
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator size="small" color={theme.colors.white} />
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Make sure your Multi-Database Manager server is running and accessible.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: theme.typography.fontSize.xxl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  form: {
    marginBottom: theme.spacing.xl,
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.typography.fontSize.md,
    backgroundColor: theme.colors.white,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  testButton: {
    marginLeft: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.lightGray,
  },
  errorText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
  loginButton: {
    height: 48,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.white,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.sm,
  },
});

export default LoginScreen;