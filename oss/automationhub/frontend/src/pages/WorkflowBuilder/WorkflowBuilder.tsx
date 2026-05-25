import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  PlayArrow as RunIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  AccountTree as WorkflowIcon,
  SmartToy as AgentIcon,
  Code as CodeIcon,
  Email as EmailIcon,
  Http as HttpIcon,
  Schedule as ScheduleIcon,
  Storage as StorageIcon,
  FilterAlt as FilterIcon,
  Loop as LoopIcon,
  CallSplit as BranchIcon,
  Web as BrowserIcon,
  Description as DocumentIcon,
} from '@mui/icons-material';

interface WorkflowStep {
  id: string;
  type: string;
  name: string;
  config: Record<string, any>;
}

interface WorkflowBuilderProps {
  workflow?: any;
  onSave: (workflow: any) => void;
  onCancel: () => void;
}

const STEP_TYPES = [
  { type: 'trigger', name: 'Trigger', icon: <ScheduleIcon />, category: 'trigger' },
  { type: 'http_request', name: 'HTTP Request', icon: <HttpIcon />, category: 'action' },
  { type: 'ai_agent', name: 'AI Agent', icon: <AgentIcon />, category: 'action' },
  { type: 'browser_action', name: 'Browser Action', icon: <BrowserIcon />, category: 'action' },
  { type: 'code', name: 'Run Code', icon: <CodeIcon />, category: 'action' },
  { type: 'email', name: 'Send Email', icon: <EmailIcon />, category: 'action' },
  { type: 'database', name: 'Database Query', icon: <StorageIcon />, category: 'action' },
  { type: 'document', name: 'Document Processing', icon: <DocumentIcon />, category: 'action' },
  { type: 'condition', name: 'Condition', icon: <BranchIcon />, category: 'logic' },
  { type: 'loop', name: 'Loop', icon: <LoopIcon />, category: 'logic' },
  { type: 'filter', name: 'Filter', icon: <FilterIcon />, category: 'logic' },
];

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ workflow, onSave, onCancel }) => {
  const [steps, setSteps] = useState<WorkflowStep[]>(workflow?.steps || []);
  const [workflowName, setWorkflowName] = useState(workflow?.name || 'New Workflow');
  const [workflowDescription] = useState(workflow?.description || '');
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const addStep = useCallback((stepType: typeof STEP_TYPES[0]) => {
    const newStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      type: stepType.type,
      name: stepType.name,
      config: {},
    };
    setSteps((prev) => [...prev, newStep]);
    setSelectedStep(newStep);
    setDrawerOpen(true);
  }, []);

  const removeStep = useCallback((stepId: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== stepId));
    if (selectedStep?.id === stepId) {
      setSelectedStep(null);
      setDrawerOpen(false);
    }
  }, [selectedStep]);

  const updateStep = useCallback((stepId: string, updates: Partial<WorkflowStep>) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, ...updates } : s))
    );
    if (selectedStep?.id === stepId) {
      setSelectedStep((prev) => prev ? { ...prev, ...updates } : null);
    }
  }, [selectedStep]);

  const handleSave = () => {
    onSave({
      name: workflowName,
      description: workflowDescription,
      steps,
      definition: { steps },
    });
  };

  const getStepIcon = (type: string) => {
    const stepType = STEP_TYPES.find((st) => st.type === type);
    return stepType?.icon || <WorkflowIcon />;
  };

  const getCategorySteps = (category: string) => {
    return STEP_TYPES.filter((st) => st.category === category);
  };

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>
      {/* Left Panel - Step Library */}
      <Paper sx={{ width: 280, borderRadius: 0, borderRight: 1, borderColor: 'divider', overflow: 'auto' }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle1" fontWeight={600}>
            Add Steps
          </Typography>
        </Box>

        <Box sx={{ p: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
            TRIGGERS
          </Typography>
          <List dense>
            {getCategorySteps('trigger').map((stepType) => (
              <ListItem key={stepType.type} disablePadding>
                <ListItemButton onClick={() => addStep(stepType)}>
                  <ListItemIcon sx={{ minWidth: 36 }}>{stepType.icon}</ListItemIcon>
                  <ListItemText primary={stepType.name} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>

          <Typography variant="caption" color="text.secondary" sx={{ px: 1, mt: 2, display: 'block' }}>
            ACTIONS
          </Typography>
          <List dense>
            {getCategorySteps('action').map((stepType) => (
              <ListItem key={stepType.type} disablePadding>
                <ListItemButton onClick={() => addStep(stepType)}>
                  <ListItemIcon sx={{ minWidth: 36 }}>{stepType.icon}</ListItemIcon>
                  <ListItemText primary={stepType.name} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>

          <Typography variant="caption" color="text.secondary" sx={{ px: 1, mt: 2, display: 'block' }}>
            LOGIC
          </Typography>
          <List dense>
            {getCategorySteps('logic').map((stepType) => (
              <ListItem key={stepType.type} disablePadding>
                <ListItemButton onClick={() => addStep(stepType)}>
                  <ListItemIcon sx={{ minWidth: 36 }}>{stepType.icon}</ListItemIcon>
                  <ListItemText primary={stepType.name} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Paper>

      {/* Center Panel - Workflow Canvas */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <Paper sx={{ p: 2, borderRadius: 0, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              size="small"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              sx={{ flex: 1, maxWidth: 300 }}
            />
            <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}>
              Save
            </Button>
            <Button variant="outlined" startIcon={<RunIcon />}>
              Test Run
            </Button>
            <Button variant="text" onClick={onCancel}>
              Cancel
            </Button>
          </Box>
        </Paper>

        {/* Canvas */}
        <Box
          sx={{
            flex: 1,
            p: 3,
            bgcolor: 'grey.100',
            overflow: 'auto',
          }}
        >
          {steps.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              <WorkflowIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                Start building your workflow
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Click on steps from the left panel to add them
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => addStep(STEP_TYPES[0])}
              >
                Add Trigger
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              {steps.map((step, index) => (
                <React.Fragment key={step.id}>
                  <Paper
                    sx={{
                      p: 2,
                      width: 320,
                      cursor: 'pointer',
                      border: 2,
                      borderColor: selectedStep?.id === step.id ? 'primary.main' : 'transparent',
                      '&:hover': { borderColor: 'primary.light' },
                    }}
                    onClick={() => {
                      setSelectedStep(step);
                      setDrawerOpen(true);
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          bgcolor: 'primary.light',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'primary.main',
                        }}
                      >
                        {getStepIcon(step.type)}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2">{step.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {step.type.replace('_', ' ')}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeStep(step.id);
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Paper>
                  {index < steps.length - 1 && (
                    <Box sx={{ height: 30, width: 2, bgcolor: 'grey.300' }} />
                  )}
                </React.Fragment>
              ))}
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => addStep(STEP_TYPES[1])}
                sx={{ mt: 2 }}
              >
                Add Step
              </Button>
            </Box>
          )}
        </Box>
      </Box>

      {/* Right Panel - Step Configuration */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: 360 } }}
      >
        {selectedStep && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6">Configure Step</Typography>
              <IconButton onClick={() => setDrawerOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Box>

            <TextField
              fullWidth
              label="Step Name"
              value={selectedStep.name}
              onChange={(e) => updateStep(selectedStep.id, { name: e.target.value })}
              sx={{ mb: 2 }}
            />

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Step Type</InputLabel>
              <Select
                value={selectedStep.type}
                label="Step Type"
                onChange={(e) => updateStep(selectedStep.id, { type: e.target.value })}
              >
                {STEP_TYPES.map((st) => (
                  <MenuItem key={st.type} value={st.type}>
                    {st.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" gutterBottom>
              Configuration
            </Typography>

            {/* Dynamic configuration based on step type */}
            {selectedStep.type === 'http_request' && (
              <>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Method</InputLabel>
                  <Select
                    value={selectedStep.config.method || 'GET'}
                    label="Method"
                    onChange={(e) =>
                      updateStep(selectedStep.id, {
                        config: { ...selectedStep.config, method: e.target.value },
                      })
                    }
                  >
                    <MenuItem value="GET">GET</MenuItem>
                    <MenuItem value="POST">POST</MenuItem>
                    <MenuItem value="PUT">PUT</MenuItem>
                    <MenuItem value="DELETE">DELETE</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  label="URL"
                  value={selectedStep.config.url || ''}
                  onChange={(e) =>
                    updateStep(selectedStep.id, {
                      config: { ...selectedStep.config, url: e.target.value },
                    })
                  }
                  sx={{ mb: 2 }}
                />
              </>
            )}

            {selectedStep.type === 'ai_agent' && (
              <>
                <TextField
                  fullWidth
                  label="Agent Prompt"
                  multiline
                  rows={4}
                  value={selectedStep.config.prompt || ''}
                  onChange={(e) =>
                    updateStep(selectedStep.id, {
                      config: { ...selectedStep.config, prompt: e.target.value },
                    })
                  }
                  sx={{ mb: 2 }}
                />
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Model</InputLabel>
                  <Select
                    value={selectedStep.config.model || 'gpt-4'}
                    label="Model"
                    onChange={(e) =>
                      updateStep(selectedStep.id, {
                        config: { ...selectedStep.config, model: e.target.value },
                      })
                    }
                  >
                    <MenuItem value="gpt-4">GPT-4</MenuItem>
                    <MenuItem value="gpt-3.5-turbo">GPT-3.5 Turbo</MenuItem>
                    <MenuItem value="claude-3-opus">Claude 3 Opus</MenuItem>
                    <MenuItem value="claude-3-sonnet">Claude 3 Sonnet</MenuItem>
                  </Select>
                </FormControl>
              </>
            )}

            {selectedStep.type === 'browser_action' && (
              <>
                <TextField
                  fullWidth
                  label="Target URL"
                  value={selectedStep.config.url || ''}
                  onChange={(e) =>
                    updateStep(selectedStep.id, {
                      config: { ...selectedStep.config, url: e.target.value },
                    })
                  }
                  sx={{ mb: 2 }}
                />
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Action</InputLabel>
                  <Select
                    value={selectedStep.config.action || 'navigate'}
                    label="Action"
                    onChange={(e) =>
                      updateStep(selectedStep.id, {
                        config: { ...selectedStep.config, action: e.target.value },
                      })
                    }
                  >
                    <MenuItem value="navigate">Navigate</MenuItem>
                    <MenuItem value="click">Click</MenuItem>
                    <MenuItem value="fill">Fill Form</MenuItem>
                    <MenuItem value="screenshot">Take Screenshot</MenuItem>
                    <MenuItem value="extract">Extract Data</MenuItem>
                  </Select>
                </FormControl>
              </>
            )}

            {selectedStep.type === 'condition' && (
              <>
                <TextField
                  fullWidth
                  label="Condition Expression"
                  placeholder="e.g., {{step1.result}} == 'success'"
                  value={selectedStep.config.condition || ''}
                  onChange={(e) =>
                    updateStep(selectedStep.id, {
                      config: { ...selectedStep.config, condition: e.target.value },
                    })
                  }
                  sx={{ mb: 2 }}
                />
                <Alert severity="info">
                  Use double curly braces to reference values from previous steps
                </Alert>
              </>
            )}

            {/* Generic config for other types */}
            {!['http_request', 'ai_agent', 'browser_action', 'condition'].includes(
              selectedStep.type
            ) && (
              <TextField
                fullWidth
                label="Configuration (JSON)"
                multiline
                rows={6}
                value={JSON.stringify(selectedStep.config, null, 2)}
                onChange={(e) => {
                  try {
                    const config = JSON.parse(e.target.value);
                    updateStep(selectedStep.id, { config });
                  } catch (err) {
                    // Invalid JSON, ignore
                  }
                }}
              />
            )}
          </Box>
        )}
      </Drawer>
    </Box>
  );
};

export default WorkflowBuilder;

