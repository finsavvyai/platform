/**
 * Node Configuration Panel
 *
 * Comprehensive configuration panel for workflow nodes with:
 * - Dynamic form generation based on node schema
 * - Real-time validation
 * - Template variable suggestions
 * - Code editor for scripts
 * - JSON editor for complex objects
 * - Help documentation
 * - Configuration history
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Alert,
  IconButton,
  Tooltip,
  Divider,
  Stack,
  Grid,
  Card,
  CardContent,
  useTheme,
  alpha,
  Tab,
  Tabs,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Settings,
  Save,
  Undo,
  Redo,
  History,
  Help,
  Code,
  DataObject,
  Add,
  Remove,
  Visibility,
  VisibilityOff,
  Refresh,
  PlayArrow,
  BugReport,
  ContentCopy,
  ContentPaste,
} from '@mui/icons-material';
import { ExpandMore } from '@mui/icons-material';

import { WorkflowNodeConfig, validateNodeConfig } from '../types/NodeTypes';
import { WORKFLOW_NODE_TYPES } from '../types/NodeTypes';

interface NodeConfigPanelProps {
  nodeType: string;
  config: Record<string, any>;
  onConfigChange: (config: Record<string, any>) => void;
  onSave?: () => void;
  onTest?: () => void;
  onDebug?: () => void;
  onClose?: () => void;
  readOnly?: boolean;
  availableVariables?: Array<{ name: string; type: string; description?: string }>;
  configHistory?: Array<{ timestamp: number; config: Record<string, any> }>;
}

interface ConfigField {
  key: string;
  schema: any;
  value: any;
  error?: string;
}

const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({
  nodeType,
  config,
  onConfigChange,
  onSave,
  onTest,
  onDebug,
  onClose,
  readOnly = false,
  availableVariables = [],
  configHistory = [],
}) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [configErrors, setConfigErrors] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Get node type configuration
  const nodeTypeConfig = useMemo(() => {
    return WORKFLOW_NODE_TYPES[nodeType] as WorkflowNodeConfig;
  }, [nodeType]);

  // Validate configuration
  const validationResult = useMemo(() => {
    if (!nodeTypeConfig) {
      return { isValid: false, errors: ['Unknown node type'] };
    }
    return validateNodeConfig(nodeType, config);
  }, [nodeTypeConfig, config]);

  // Prepare configuration fields
  const configFields = useMemo(() => {
    if (!nodeTypeConfig) return [];

    const fields: ConfigField[] = [];
    const schema = nodeTypeConfig.configSchema;

    Object.entries(schema.properties).forEach(([key, fieldSchema]: [string, any]) => {
      fields.push({
        key,
        schema: fieldSchema,
        value: config[key] ?? fieldSchema.default,
        error: configErrors[key],
      });
    });

    return fields;
  }, [nodeTypeConfig, config, configErrors]);

  // Handle field value change
  const handleFieldChange = useCallback((key: string, value: any) => {
    const newConfig = { ...config, [key]: value };
    onConfigChange(newConfig);

    // Clear error for this field
    if (configErrors[key]) {
      setConfigErrors(prev => {
        const { [key]: removed, ...rest } = prev;
        return rest;
      });
    }
  }, [config, onConfigChange, configErrors]);

  // Handle array field operations
  const handleArrayItemAdd = useCallback((key: string) => {
    const currentArray = Array.isArray(config[key]) ? config[key] : [];
    handleFieldChange(key, [...currentArray, '']);
  }, [config, handleFieldChange]);

  const handleArrayItemRemove = useCallback((key: string, index: number) => {
    const currentArray = Array.isArray(config[key]) ? config[key] : [];
    handleFieldChange(key, currentArray.filter((_, i) => i !== index));
  }, [config, handleFieldChange]);

  const handleArrayItemChange = useCallback((key: string, index: number, value: any) => {
    const currentArray = Array.isArray(config[key]) ? config[key] : [];
    const newArray = [...currentArray];
    newArray[index] = value;
    handleFieldChange(key, newArray);
  }, [config, handleFieldChange]);

  // Test configuration
  const handleTest = useCallback(async () => {
    try {
      const result = await onTest?.();
      setTestResult(result);
    } catch (error) {
      setTestResult({ error: error instanceof Error ? error.message : 'Test failed' });
    }
  }, [onTest]);

  // Debug configuration
  const handleDebug = useCallback(async () => {
    try {
      const info = await onDebug?.();
      setDebugInfo(info);
    } catch (error) {
      setDebugInfo({ error: error instanceof Error ? error.message : 'Debug failed' });
    }
  }, [onDebug]);

  // Copy/paste configuration
  const handleCopyConfig = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
  }, [config]);

  const handlePasteConfig = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const newConfig = JSON.parse(text);
      onConfigChange(newConfig);
    } catch (error) {
      console.error('Failed to paste configuration:', error);
    }
  }, [onConfigChange]);

  // Render field based on type
  const renderField = useCallback((field: ConfigField) => {
    const { key, schema, value, error } = field;
    const isSecret = key.toLowerCase().includes('password') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('key');
    const showSecret = showSecrets[key];

    const fieldProps = {
      fullWidth: true,
      label: schema.title || key,
      value: value,
      onChange: (e: any) => {
        if (schema.type === 'boolean') {
          handleFieldChange(key, e.target.checked);
        } else {
          handleFieldChange(key, e.target.value);
        }
      },
      error: !!error,
      helperText: error || schema.description,
      disabled: readOnly,
      size: 'small' as const,
    };

    // Handle different field types
    switch (schema.type) {
      case 'string':
        if (schema.enum) {
          return (
            <FormControl fullWidth size="small" error={!!error}>
              <InputLabel>{schema.title || key}</InputLabel>
              <Select
                value={value}
                label={schema.title || key}
                onChange={(e) => handleFieldChange(key, e.target.value)}
                disabled={readOnly}
              >
                {schema.enum.map((option: string) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          );
        } else if (schema.multiline) {
          return (
            <TextField
              {...fieldProps}
              multiline
              rows={4}
              type={isSecret && !showSecret ? 'password' : 'text'}
              InputProps={{
                endAdornment: isSecret && (
                  <IconButton
                    size="small"
                    onClick={() => setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }))}
                  >
                    {showSecret ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                ),
              }}
            />
          );
        } else {
          return (
            <TextField
              {...fieldProps}
              type={isSecret && !showSecret ? 'password' : 'text'}
              InputProps={{
                endAdornment: isSecret && (
                  <IconButton
                    size="small"
                    onClick={() => setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }))}
                  >
                    {showSecret ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                ),
              }}
            />
          );
        }

      case 'number':
        return (
          <TextField
            {...fieldProps}
            type="number"
            inputProps={{ min: schema.minimum, max: schema.maximum, step: schema.step || 1 }}
          />
        );

      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Switch
                checked={!!value}
                onChange={(e) => handleFieldChange(key, e.target.checked)}
                disabled={readOnly}
              />
            }
            label={schema.title || key}
          />
        );

      case 'array':
        return (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {schema.title || key}
            </Typography>
            {Array.isArray(value) && value.map((item, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  value={item}
                  onChange={(e) => handleArrayItemChange(key, index, e.target.value)}
                  disabled={readOnly}
                />
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleArrayItemRemove(key, index)}
                  disabled={readOnly}
                >
                  <Remove />
                </IconButton>
              </Box>
            ))}
            <Button
              startIcon={<Add />}
              onClick={() => handleArrayItemAdd(key)}
              disabled={readOnly}
              size="small"
            >
              Add Item
            </Button>
            {schema.description && (
              <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                {schema.description}
              </Typography>
            )}
          </Box>
        );

      case 'object':
        return (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {schema.title || key}
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={6}
              value={JSON.stringify(value || {}, null, 2)}
              onChange={(e) => {
                try {
                  const parsedValue = JSON.parse(e.target.value);
                  handleFieldChange(key, parsedValue);
                } catch {
                  // Ignore JSON errors while typing
                }
              }}
              error={!!error}
              helperText={error || 'JSON format'}
              disabled={readOnly}
              size="small"
            />
            {schema.description && (
              <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                {schema.description}
              </Typography>
            )}
          </Box>
        );

      default:
        return (
          <TextField
            {...fieldProps}
            placeholder="Unsupported field type"
            disabled
          />
        );
    }
  }, [handleFieldChange, handleArrayItemAdd, handleArrayItemRemove, handleArrayItemChange, showSecrets, readOnly]);

  if (!nodeTypeConfig) {
    return (
      <Alert severity="error">
        Unknown node type: {nodeType}
      </Alert>
    );
  }

  return (
    <Paper
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: 1,
        borderColor: 'divider',
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Configure {nodeTypeConfig.label}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Copy Configuration">
              <IconButton size="small" onClick={handleCopyConfig}>
                <ContentCopy />
              </IconButton>
            </Tooltip>
            <Tooltip title="Paste Configuration">
              <IconButton size="small" onClick={handlePasteConfig}>
                <ContentPaste />
              </IconButton>
            </Tooltip>
            {onClose && (
              <IconButton size="small" onClick={onClose}>
                ×
              </IconButton>
            )}
          </Box>
        </Box>

        {/* Tabs */}
        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} size="small">
          <Tab label="Configuration" />
          <Tab label="Variables" />
          <Tab label="History" />
          <Tab label="Help" />
        </Tabs>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {activeTab === 0 && (
          <Box>
            {/* Configuration Status */}
            <Alert
              severity={validationResult.isValid ? 'success' : 'error'}
              sx={{ mb: 2 }}
            >
              {validationResult.isValid ? 'Configuration is valid' : validationResult.errors[0]}
            </Alert>

            {/* Configuration Fields */}
            <Stack spacing={2}>
              {configFields.map((field) => (
                <Box key={field.key}>
                  {renderField(field)}
                </Box>
              ))}
            </Stack>

            {/* Action Buttons */}
            <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={onSave}
                disabled={!validationResult.isValid || readOnly}
              >
                Save
              </Button>
              <Button
                variant="outlined"
                startIcon={<PlayArrow />}
                onClick={handleTest}
                disabled={!validationResult.isValid || readOnly}
              >
                Test
              </Button>
              <Button
                variant="outlined"
                startIcon={<BugReport />}
                onClick={handleDebug}
                disabled={readOnly}
              >
                Debug
              </Button>
            </Box>

            {/* Test Results */}
            {testResult && (
              <Accordion sx={{ mt: 2 }}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography>Test Results</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <pre
                    style={{
                      fontSize: '12px',
                      backgroundColor: alpha(theme.palette.background.default, 0.5),
                      padding: '12px',
                      borderRadius: '4px',
                      overflow: 'auto',
                      maxHeight: '200px',
                    }}
                  >
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                </AccordionDetails>
              </Accordion>
            )}

            {/* Debug Info */}
            {debugInfo && (
              <Accordion sx={{ mt: 2 }}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography>Debug Information</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <pre
                    style={{
                      fontSize: '12px',
                      backgroundColor: alpha(theme.palette.background.default, 0.5),
                      padding: '12px',
                      borderRadius: '4px',
                      overflow: 'auto',
                      maxHeight: '200px',
                    }}
                  >
                    {JSON.stringify(debugInfo, null, 2)}
                  </pre>
                </AccordionDetails>
              </Accordion>
            )}
          </Box>
        )}

        {activeTab === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Available Variables
            </Typography>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              These variables can be used in configuration fields using the syntax {`{{variable_name}}`}
            </Typography>

            {availableVariables.length === 0 ? (
              <Alert severity="info">
                No variables available in the current context
              </Alert>
            ) : (
              <List>
                {availableVariables.map((variable) => (
                  <ListItem key={variable.name}>
                    <ListItemIcon>
                      <DataObject color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={variable.name}
                      secondary={`Type: ${variable.type}${variable.description ? ` - ${variable.description}` : ''}`}
                    />
                    <Chip
                      label={`{{${variable.name}}}`}
                      size="small"
                      clickable
                      onClick={() => {
                        navigator.clipboard.writeText(`{{${variable.name}}}`);
                      }}
                      sx={{ cursor: 'pointer' }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        )}

        {activeTab === 2 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Configuration History
            </Typography>

            {configHistory.length === 0 ? (
              <Alert severity="info">
                No configuration history available
              </Alert>
            ) : (
              <List>
                {configHistory.map((item, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <History />
                    </ListItemIcon>
                    <ListItemText
                      primary={new Date(item.timestamp).toLocaleString()}
                      secondary="Click to restore this configuration"
                    />
                    <Button
                      size="small"
                      onClick={() => onConfigChange(item.config)}
                      disabled={readOnly}
                    >
                      Restore
                    </Button>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        )}

        {activeTab === 3 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Help & Documentation
            </Typography>

            {nodeTypeConfig.documentation && (
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    Overview
                  </Typography>
                  <Typography variant="body2">
                    {nodeTypeConfig.documentation}
                  </Typography>
                </CardContent>
              </Card>
            )}

            {nodeTypeConfig.examples && nodeTypeConfig.examples.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    Examples
                  </Typography>
                  {nodeTypeConfig.examples.map((example, index) => (
                    <Accordion key={index}>
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Typography>{example.name}</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography variant="body2" gutterBottom>
                          {example.description}
                        </Typography>
                        <Button
                          size="small"
                          onClick={() => onConfigChange(example.config)}
                          disabled={readOnly}
                        >
                          Use Example
                        </Button>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </CardContent>
              </Card>
            )}
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default NodeConfigPanel;