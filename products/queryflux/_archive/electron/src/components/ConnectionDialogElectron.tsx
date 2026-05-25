import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useElectronDatabase } from '../hooks/useElectronAPI';
import { useElectronSystem } from '../hooks/useElectronAPI';
import AppleStyleCard from './ui/AppleStyleCard';
import AppleStyleButton from './ui/AppleStyleButton';
import { TestConnection, Save, X, Database, Shield, Key } from 'lucide-react-native';

interface ConnectionConfig {
  id?: string;
  name: string;
  type: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  sshTunnel?: {
    enabled: boolean;
    host: string;
    port: number;
    username: string;
    privateKey?: string;
  };
  connectionPool?: {
    min: number;
    max: number;
    timeout: number;
  };
}

interface ConnectionDialogElectronProps {
  visible: boolean;
  onClose: () => void;
  onSave: (connection: ConnectionConfig) => void;
  editingConnection?: ConnectionConfig;
}

const ConnectionDialogElectron: React.FC<ConnectionDialogElectronProps> = ({
  visible,
  onClose,
  onSave,
  editingConnection,
}) => {
  const { theme } = useTheme();
  const { createConnection, testConnection, loading } = useElectronDatabase();
  const { showMessageBox } = useElectronSystem();

  const [connection, setConnection] = useState<ConnectionConfig>({
    name: '',
    type: 'postgresql',
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
    ssl: false,
    sshTunnel: {
      enabled: false,
      host: '',
      port: 22,
      username: '',
    },
    connectionPool: {
      min: 1,
      max: 10,
      timeout: 30000,
    },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Database types
  const databaseTypes = [
    { value: 'postgresql', label: 'PostgreSQL', defaultPort: 5432 },
    { value: 'mysql', label: 'MySQL', defaultPort: 3306 },
    { value: 'mongodb', label: 'MongoDB', defaultPort: 27017 },
    { value: 'redis', label: 'Redis', defaultPort: 6379 },
    { value: 'sqlite', label: 'SQLite', defaultPort: 0 },
    { value: 'sqlserver', label: 'SQL Server', defaultPort: 1433 },
    { value: 'oracle', label: 'Oracle', defaultPort: 1521 },
    { value: 'cassandra', label: 'Cassandra', defaultPort: 9042 },
  ];

  useEffect(() => {
    if (editingConnection) {
      setConnection(editingConnection);
    } else {
      // Reset form
      setConnection({
        name: '',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: '',
        username: '',
        password: '',
        ssl: false,
        sshTunnel: {
          enabled: false,
          host: '',
          port: 22,
          username: '',
        },
        connectionPool: {
          min: 1,
          max: 10,
          timeout: 30000,
        },
      });
    }
    setErrors({});
  }, [editingConnection, visible]);

  const handleFieldChange = (field: string, value: any) => {
    setConnection(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleNestedFieldChange = (parent: string, field: string, value: any) => {
    setConnection(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent as keyof ConnectionConfig],
        [field]: value,
      },
    }));
  };

  const validateConnection = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!connection.name.trim()) {
      newErrors.name = 'Connection name is required';
    }

    if (!connection.host.trim() && connection.type !== 'sqlite') {
      newErrors.host = 'Host is required';
    }

    if (!connection.database.trim() && connection.type !== 'redis') {
      newErrors.database = 'Database name is required';
    }

    if (!connection.username.trim() && connection.type !== 'redis' && connection.type !== 'sqlite') {
      newErrors.username = 'Username is required';
    }

    if (!connection.password.trim() && connection.type !== 'redis' && connection.type !== 'sqlite') {
      newErrors.password = 'Password is required';
    }

    if (connection.type === 'sqlite' && !connection.database.trim()) {
      newErrors.database = 'Database file path is required';
    }

    if (connection.sshTunnel?.enabled) {
      if (!connection.sshTunnel.host.trim()) {
        newErrors['ssh.host'] = 'SSH host is required';
      }
      if (!connection.sshTunnel.username.trim()) {
        newErrors['ssh.username'] = 'SSH username is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleTestConnection = async () => {
    if (!validateConnection()) return;

    setTesting(true);
    try {
      const result = await testConnection(connection);
      if (result?.success) {
        await showMessageBox({
          type: 'info',
          title: 'Connection Test Successful',
          message: result.message || 'Connection established successfully!',
          buttons: ['OK'],
        });
      } else {
        await showMessageBox({
          type: 'error',
          title: 'Connection Test Failed',
          message: result?.message || 'Failed to connect to database.',
          buttons: ['OK'],
        });
      }
    } catch (error) {
      await showMessageBox({
        type: 'error',
        title: 'Connection Test Failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred.',
        buttons: ['OK'],
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!validateConnection()) return;

    try {
      const result = await createConnection(connection);
      if (result) {
        onSave(result);
        onClose();
      }
    } catch (error) {
      await showMessageBox({
        type: 'error',
        title: 'Save Failed',
        message: error instanceof Error ? error.message : 'Failed to save connection.',
        buttons: ['OK'],
      });
    }
  };

  const handleDatabaseTypeChange = (type: string) => {
    const dbType = databaseTypes.find(t => t.value === type);
    if (dbType) {
      setConnection(prev => ({
        ...prev,
        type,
        port: dbType.defaultPort,
      }));
    }
  };

  if (!visible) return null;

  const styles = StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    },
    container: {
      width: '90%',
      maxWidth: 600,
      maxHeight: '90%',
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      boxShadow: '0 16px 32px rgba(0, 0, 0, 0.15)',
    },
    header: {
      padding: 24,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text,
      display: 'flex',
      alignItems: 'center',
    },
    titleIcon: {
      marginRight: 12,
    },
    closeButton: {
      padding: 8,
      borderRadius: 6,
      '&:hover': {
        backgroundColor: theme.colors.surfaceHover,
      },
    },
    content: {
      flex: 1,
      padding: 24,
    },
    scrollView: {
      maxHeight: 400,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 16,
    },
    formGroup: {
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text,
      marginBottom: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      color: theme.colors.text,
      backgroundColor: theme.colors.background,
      outline: 'none',
      '&:focus': {
        borderColor: theme.colors.primary,
        boxShadow: `0 0 0 2px ${theme.colors.primary}20`,
      },
    },
    inputError: {
      borderColor: theme.colors.error,
    },
    errorText: {
      fontSize: 12,
      color: theme.colors.error,
      marginTop: 4,
    },
    select: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      color: theme.colors.text,
      backgroundColor: theme.colors.background,
      outline: 'none',
      '&:focus': {
        borderColor: theme.colors.primary,
        boxShadow: `0 0 0 2px ${theme.colors.primary}20`,
      },
    },
    checkboxGroup: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
    },
    checkbox: {
      width: 20,
      height: 20,
      borderWidth: 2,
      borderColor: theme.colors.border,
      borderRadius: 4,
      marginRight: 8,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
    },
    checkboxChecked: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    checkboxLabel: {
      fontSize: 14,
      color: theme.colors.text,
    },
    footer: {
      padding: 24,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    footerLeft: {
      display: 'flex',
      flexDirection: 'row',
      gap: 12,
    },
    footerRight: {
      display: 'flex',
      flexDirection: 'row',
      gap: 12,
    },
  });

  return (
    <View style={styles.overlay}>
      <AppleStyleCard style={styles.container} shadow>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.title}>
            <Database size={24} color={theme.colors.primary} style={styles.titleIcon} />
            <Text>
              {editingConnection ? 'Edit Connection' : 'New Connection'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityLabel="Close dialog"
          >
            <X size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {/* Basic Connection Settings */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Connection Details</Text>

              {/* Connection Name */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Connection Name *</Text>
                <TextInput
                  style={[
                    styles.input,
                    errors.name && styles.inputError,
                  ]}
                  value={connection.name}
                  onChangeText={(value) => handleFieldChange('name', value)}
                  placeholder="My Database Connection"
                  accessibilityLabel="Connection name"
                />
                {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
              </View>

              {/* Database Type */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Database Type *</Text>
                <select
                  style={styles.select}
                  value={connection.type}
                  onChange={(e) => handleDatabaseTypeChange(e.target.value)}
                >
                  {databaseTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </View>

              {/* Host */}
              {connection.type !== 'sqlite' && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Host *</Text>
                  <TextInput
                    style={[
                      styles.input,
                      errors.host && styles.inputError,
                    ]}
                    value={connection.host}
                    onChangeText={(value) => handleFieldChange('host', value)}
                    placeholder="localhost"
                    accessibilityLabel="Database host"
                  />
                  {errors.host && <Text style={styles.errorText}>{errors.host}</Text>}
                </View>
              )}

              {/* Port */}
              {connection.type !== 'sqlite' && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Port *</Text>
                  <TextInput
                    style={[
                      styles.input,
                      errors.port && styles.inputError,
                    ]}
                    value={connection.port.toString()}
                    onChangeText={(value) => handleFieldChange('port', parseInt(value) || 0)}
                    placeholder="5432"
                    keyboardType="numeric"
                    accessibilityLabel="Database port"
                  />
                </View>
              )}

              {/* Database */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  {connection.type === 'sqlite' ? 'Database File Path *' : 'Database Name *'}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    errors.database && styles.inputError,
                  ]}
                  value={connection.database}
                  onChangeText={(value) => handleFieldChange('database', value)}
                  placeholder={connection.type === 'sqlite' ? '/path/to/database.db' : 'mydatabase'}
                  accessibilityLabel="Database name"
                />
                {errors.database && <Text style={styles.errorText}>{errors.database}</Text>}
              </View>

              {/* Username */}
              {connection.type !== 'redis' && connection.type !== 'sqlite' && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Username *</Text>
                  <TextInput
                    style={[
                      styles.input,
                      errors.username && styles.inputError,
                    ]}
                    value={connection.username}
                    onChangeText={(value) => handleFieldChange('username', value)}
                    placeholder="dbuser"
                    accessibilityLabel="Database username"
                  />
                  {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
                </View>
              )}

              {/* Password */}
              {connection.type !== 'redis' && connection.type !== 'sqlite' && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Password *</Text>
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <TextInput
                      style={[
                        styles.input,
                        errors.password && styles.inputError,
                        { flex: 1, marginRight: 8 },
                      ]}
                      value={connection.password}
                      onChangeText={(value) => handleFieldChange('password', value)}
                      placeholder="password"
                      secureTextEntry={!showPassword}
                      accessibilityLabel="Database password"
                    />
                    <TouchableOpacity
                      style={styles.closeButton}
                      onPress={() => setShowPassword(!showPassword)}
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <Key size={16} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
                </View>
              )}

              {/* SSL */}
              {connection.type !== 'redis' && connection.type !== 'sqlite' && (
                <View style={styles.formGroup}>
                  <View style={styles.checkboxGroup}>
                    <TouchableOpacity
                      style={[
                        styles.checkbox,
                        connection.ssl && styles.checkboxChecked,
                      ]}
                      onPress={() => handleFieldChange('ssl', !connection.ssl)}
                      accessibilityLabel="Enable SSL"
                    >
                      {connection.ssl && (
                        <Text style={{ color: 'white', fontSize: 12 }}>✓</Text>
                      )}
                    </TouchableOpacity>
                    <Text style={styles.checkboxLabel}>Enable SSL/TLS</Text>
                  </View>
                </View>
              )}
            </View>

            {/* SSH Tunnel Settings */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>SSH Tunnel</Text>

              <View style={styles.formGroup}>
                <View style={styles.checkboxGroup}>
                  <TouchableOpacity
                    style={[
                      styles.checkbox,
                      connection.sshTunnel?.enabled && styles.checkboxChecked,
                    ]}
                    onPress={() => handleNestedFieldChange('sshTunnel', 'enabled', !connection.sshTunnel?.enabled)}
                    accessibilityLabel="Enable SSH tunnel"
                  >
                    {connection.sshTunnel?.enabled && (
                      <Text style={{ color: 'white', fontSize: 12 }}>✓</Text>
                    )}
                  </TouchableOpacity>
                  <Text style={styles.checkboxLabel}>Connect through SSH tunnel</Text>
                </View>
              </View>

              {connection.sshTunnel?.enabled && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>SSH Host *</Text>
                    <TextInput
                      style={[
                        styles.input,
                        errors['ssh.host'] && styles.inputError,
                      ]}
                      value={connection.sshTunnel.host}
                      onChangeText={(value) => handleNestedFieldChange('sshTunnel', 'host', value)}
                      placeholder="ssh.example.com"
                      accessibilityLabel="SSH host"
                    />
                    {errors['ssh.host'] && <Text style={styles.errorText}>{errors['ssh.host']}</Text>}
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>SSH Username *</Text>
                    <TextInput
                      style={[
                        styles.input,
                        errors['ssh.username'] && styles.inputError,
                      ]}
                      value={connection.sshTunnel.username}
                      onChangeText={(value) => handleNestedFieldChange('sshTunnel', 'username', value)}
                      placeholder="sshuser"
                      accessibilityLabel="SSH username"
                    />
                    {errors['ssh.username'] && <Text style={styles.errorText}>{errors['ssh.username']}</Text>}
                  </View>
                </>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <AppleStyleButton
              title="Test Connection"
              variant="secondary"
              icon={<TestConnection size={16} />}
              onPress={handleTestConnection}
              loading={testing}
              disabled={loading}
            />
          </View>
          <View style={styles.footerRight}>
            <AppleStyleButton
              title="Cancel"
              variant="tertiary"
              onPress={onClose}
              disabled={loading}
            />
            <AppleStyleButton
              title="Save Connection"
              variant="primary"
              icon={<Save size={16} />}
              onPress={handleSave}
              loading={loading}
              disabled={testing}
            />
          </View>
        </View>
      </AppleStyleCard>
    </View>
  );
};

export default ConnectionDialogElectron;