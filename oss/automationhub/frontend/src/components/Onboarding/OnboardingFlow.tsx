import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Typography,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slide,
  Fade,
  Zoom,
  Grow,
  Alert,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Divider,
} from '@mui/material';
import {
  NavigateNext,
  NavigateBefore,
  CheckCircle,
  PlayArrow,
  Code,
  SmartToy,
  Psychology,
  Storage,
  Search,
  WorkOutline,
  Description,
  Settings,
  Dashboard,
  Close,
  Launch,
  School,
  TipsAndUpdates,
  RocketLaunch,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  margin: theme.spacing(2),
  background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
  color: theme.palette.primary.contrastText,
}));

const FeatureCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[8],
  },
}));

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  content: React.ReactNode;
  action?: () => void;
  actionText?: string;
  skipable?: boolean;
  optional?: boolean;
}

interface OnboardingFlowProps {
  onComplete?: () => void;
  onSkip?: () => void;
  initialStep?: number;
  open?: boolean;
}

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onComplete,
  onSkip,
  initialStep = 0,
  open = true,
}) => {
  const [activeStep, setActiveStep] = useState(initialStep);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [showTour, setShowTour] = useState(true);
  const [visitedFeatures, setVisitedFeatures] = useState<Set<string>>(new Set());

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to UPM.Plus!',
      description: 'Your autonomous digital ecosystem orchestrator',
      content: (
        <Box>
          <Typography variant="body1" paragraph>
            UPM.Plus is a next-generation AI platform that unifies browser automation,
            infrastructure management, conversational AI, workflow orchestration, and knowledge management.
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <FeatureCard>
                <CardContent>
                  <Avatar sx={{ bgcolor: 'primary.main', mx: 'auto', mb: 2 }}>
                    <SmartToy />
                  </Avatar>
                  <Typography variant="h6" align="center" gutterBottom>
                    AI-Powered
                  </Typography>
                  <Typography variant="body2" align="center">
                    Intelligent automation with multi-agent collaboration
                  </Typography>
                </CardContent>
              </FeatureCard>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FeatureCard>
                <CardContent>
                  <Avatar sx={{ bgcolor: 'secondary.main', mx: 'auto', mb: 2 }}>
                    <WorkOutline />
                  </Avatar>
                  <Typography variant="h6" align="center" gutterBottom>
                    Visual Workflows
                  </Typography>
                  <Typography variant="body2" align="center">
                    Drag-and-drop workflow builder with AI generation
                  </Typography>
                </CardContent>
              </FeatureCard>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FeatureCard>
                <CardContent>
                  <Avatar sx={{ bgcolor: 'success.main', mx: 'auto', mb: 2 }}>
                    <Storage />
                  </Avatar>
                  <Typography variant="h6" align="center" gutterBottom>
                    Knowledge Base
                  </Typography>
                  <Typography variant="body2" align="center">
                    RAG-powered document processing and search
                  </Typography>
                </CardContent>
              </FeatureCard>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FeatureCard>
                <CardContent>
                  <Avatar sx={{ bgcolor: 'warning.main', mx: 'auto', mb: 2 }}>
                    <Psychology />
                  </Avatar>
                  <Typography variant="h6" align="center" gutterBottom>
                    MCP Integration
                  </Typography>
                  <Typography variant="body2" align="center">
                    Industry-first ecosystem integration
                  </Typography>
                </CardContent>
              </FeatureCard>
            </Grid>
          </Grid>
        </Box>
      ),
      actionText: "Let's Get Started",
    },
    {
      id: 'dashboard',
      title: 'Dashboard Overview',
      description: 'Your command center for automation',
      content: (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            The dashboard gives you a real-time overview of your automation ecosystem
          </Alert>
          <List>
            <ListItem>
              <ListItemIcon>
                <Dashboard color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="System Status"
                secondary="Monitor CPU, memory, and performance metrics in real-time"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <WorkOutline color="secondary" />
              </ListItemIcon>
              <ListItemText
                primary="Active Workflows"
                secondary="View running workflows, their progress, and execution status"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <SmartToy color="success" />
              </ListItemIcon>
              <ListItemText
                primary="Agent Status"
                secondary="Check on your AI agents and their current tasks"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Description color="warning" />
              </ListItemIcon>
              <ListItemText
                primary="Recent Activity"
                secondary="See recent log entries and system events"
              />
            </ListItem>
          </List>
        </Box>
      ),
      actionText: 'Explore Dashboard',
      action: () => {
        // Navigate to dashboard
        window.location.href = '/dashboard';
        setVisitedFeatures(prev => new Set(prev).add('dashboard'));
      },
    },
    {
      id: 'workflows',
      title: 'Workflow Builder',
      description: 'Create powerful automation workflows visually',
      content: (
        <Box>
          <Alert severity="success" sx={{ mb: 2 }}>
            Our AI-powered workflow builder lets you create complex automations with natural language!
          </Alert>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Node Types
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon><PlayArrow color="success" /></ListItemIcon>
                  <ListItemText primary="Triggers" secondary="Start workflows automatically" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><SmartToy color="primary" /></ListItemIcon>
                  <ListItemText primary="Agents" secondary="AI-powered task execution" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><Code color="warning" /></ListItemIcon>
                  <ListItemText primary="Actions" secondary="Custom code and scripts" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><Psychology color="secondary" /></ListItemIcon>
                  <ListItemText primary="MCP Tools" secondary="Ecosystem integrations" />
                </ListItem>
              </List>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Key Features
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon><TipsAndUpdates /></ListItemIcon>
                  <ListItemText primary="AI Generation" secondary="Describe workflows in natural language" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><Settings /></ListItemIcon>
                  <ListItemText primary="Real-time Monitoring" secondary="Watch workflows execute live" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><Storage /></ListItemIcon>
                  <ListItemText primary="Data Flow" secondary="Pass data between nodes seamlessly" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><WorkOutline /></ListItemIcon>
                  <ListItemText primary="Templates" secondary="Start from proven workflow patterns" />
                </ListItem>
              </List>
            </Grid>
          </Grid>
        </Box>
      ),
      actionText: 'Try Workflow Builder',
      action: () => {
        window.location.href = '/workflows';
        setVisitedFeatures(prev => new Set(prev).add('workflows'));
      },
    },
    {
      id: 'knowledge',
      title: 'Knowledge Management',
      description: 'Build your intelligent knowledge base',
      content: (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            Upload documents and let AI understand your content for intelligent search and chat
          </Alert>
          <Typography variant="h6" gutterBottom>
            Supported Document Types
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={1} mb={3}>
            <Chip label="PDF" icon={<Description />} />
            <Chip label="Word Documents" icon={<Description />} />
            <Chip label="Text Files" icon={<Code />} />
            <Chip label="Markdown" icon={<Code />} />
            <Chip label="JSON" icon={<Code />} />
            <Chip label="CSV" icon={<Storage />} />
            <Chip label="HTML" icon={<Code />} />
          </Box>

          <Typography variant="h6" gutterBottom>
            Features
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    <Search sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Semantic Search
                  </Typography>
                  <Typography variant="body2">
                    Find relevant content using natural language queries
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    <Psychology sx={{ mr: 1, verticalAlign: 'middle' }} />
                    AI Chat
                  </Typography>
                  <Typography variant="body2">
                    Ask questions about your documents and get intelligent answers
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      ),
      actionText: 'Manage Knowledge',
      action: () => {
        window.location.href = '/knowledge';
        setVisitedFeatures(prev => new Set(prev).add('knowledge'));
      },
    },
    {
      id: 'agents',
      title: 'AI Agents',
      description: 'Meet your specialized AI assistants',
      content: (
        <Box>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Each agent is specialized for different types of tasks and can work together
          </Alert>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <FeatureCard>
                <CardContent>
                  <Avatar sx={{ bgcolor: 'error.main', mx: 'auto', mb: 1 }}>
                    <Code />
                  </Avatar>
                  <Typography variant="subtitle1" align="center">
                    Browser Agent
                  </Typography>
                  <Typography variant="body2" align="center">
                    Web automation and scraping
                  </Typography>
                </CardContent>
              </FeatureCard>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FeatureCard>
                <CardContent>
                  <Avatar sx={{ bgcolor: 'info.main', mx: 'auto', mb: 1 }}>
                    <Settings />
                  </Avatar>
                  <Typography variant="subtitle1" align="center">
                    Infrastructure Agent
                  </Typography>
                  <Typography variant="body2" align="center">
                    System management and deployment
                  </Typography>
                </CardContent>
              </FeatureCard>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FeatureCard>
                <CardContent>
                  <Avatar sx={{ bgcolor: 'success.main', mx: 'auto', mb: 1 }}>
                    <Psychology />
                  </Avatar>
                  <Typography variant="subtitle1" align="center">
                    Conversational Agent
                  </Typography>
                  <Typography variant="body2" align="center">
                    Natural language processing
                  </Typography>
                </CardContent>
              </FeatureCard>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FeatureCard>
                <CardContent>
                  <Avatar sx={{ bgcolor: 'warning.main', mx: 'auto', mb: 1 }}>
                    <Storage />
                  </Avatar>
                  <Typography variant="subtitle1" align="center">
                    Data Agent
                  </Typography>
                  <Typography variant="body2" align="center">
                    Data processing and analysis
                  </Typography>
                </CardContent>
              </FeatureCard>
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />
          <Typography variant="h6" gutterBottom>
            Agent Capabilities
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
              <ListItemText primary="Autonomous task execution" />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
              <ListItemText primary="Real-time collaboration" />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
              <ListItemText primary="Error handling and recovery" />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
              <ListItemText primary="Load balancing and optimization" />
            </ListItem>
          </List>
        </Box>
      ),
      actionText: 'View Agents',
      action: () => {
        window.location.href = '/agents';
        setVisitedFeatures(prev => new Set(prev).add('agents'));
      },
    },
    {
      id: 'resources',
      title: 'Resources & Support',
      description: 'Everything you need to succeed with UPM.Plus',
      content: (
        <Box>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                <School sx={{ mr: 1, verticalAlign: 'middle' }} />
                Learning Resources
              </Typography>
              <List>
                <ListItem button component="a" href="/docs" target="_blank">
                  <ListItemIcon><Description /></ListItemIcon>
                  <ListItemText primary="Documentation" secondary="Comprehensive guides and API reference" />
                  <Launch />
                </ListItem>
                <ListItem button component="a" href="/tutorials" target="_blank">
                  <ListItemIcon><PlayArrow /></ListItemIcon>
                  <ListItemText primary="Video Tutorials" secondary="Step-by-step video guides" />
                  <Launch />
                </ListItem>
                <ListItem button component="a" href="/examples" target="_blank">
                  <ListItemIcon><Code /></ListItemIcon>
                  <ListItemText primary="Example Workflows" secondary="Ready-to-use workflow templates" />
                  <Launch />
                </ListItem>
                <ListItem button component="a" href="/blog" target="_blank">
                  <ListItemIcon><TipsAndUpdates /></ListItemIcon>
                  <ListItemText primary="Blog & Tips" secondary="Best practices and use cases" />
                  <Launch />
                </ListItem>
              </List>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                <RocketLaunch sx={{ mr: 1, verticalAlign: 'middle' }} />
                Quick Start Templates
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        Web Scraper
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Extract data from any website automatically
                      </Typography>
                    </CardContent>
                    <CardActions>
                      <Button size="small">Use Template</Button>
                    </CardActions>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        API Monitor
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Monitor and respond to API events
                      </Typography>
                    </CardContent>
                    <CardActions>
                      <Button size="small">Use Template</Button>
                    </CardActions>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        Report Generator
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Generate automated reports from data
                      </Typography>
                    </CardContent>
                    <CardActions>
                      <Button size="small">Use Template</Button>
                    </CardActions>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        Social Media Bot
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Automate social media posting and engagement
                      </Typography>
                    </CardContent>
                    <CardActions>
                      <Button size="small">Use Template</Button>
                    </CardActions>
                  </Card>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </Box>
      ),
      optional: true,
    },
    {
      id: 'completion',
      title: "You're All Set!",
      description: 'Start automating with UPM.Plus',
      content: (
        <Box textAlign="center">
          <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Congratulations! 🎉
          </Typography>
          <Typography variant="body1" paragraph>
            You've completed the onboarding tour and are ready to start building powerful automations with UPM.Plus.
          </Typography>

          <Box display="flex" justifyContent="center" gap={2} mb={3}>
            <Chip
              icon={<Dashboard />}
              label="Dashboard Explored"
              color={visitedFeatures.has('dashboard') ? 'success' : 'default'}
            />
            <Chip
              icon={<WorkOutline />}
              label="Workflows Tried"
              color={visitedFeatures.has('workflows') ? 'success' : 'default'}
            />
            <Chip
              icon={<Storage />}
              label="Knowledge Base Set Up"
              color={visitedFeatures.has('knowledge') ? 'success' : 'default'}
            />
            <Chip
              icon={<SmartToy />}
              label="Agents Met"
              color={visitedFeatures.has('agents') ? 'success' : 'default'}
            />
          </Box>

          <Alert severity="success" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Next Steps:
            </Typography>
            <Typography component="div">
              <ul style={{ textAlign: 'left', margin: 0 }}>
                <li>Try creating your first workflow</li>
                <li>Upload some documents to your knowledge base</li>
                <li>Explore our template library</li>
                <li>Join our community Discord</li>
              </ul>
            </Typography>
          </Alert>
        </Box>
      ),
      actionText: 'Start Automating!',
      skipable: false,
    },
  ];

  const handleNext = useCallback(() => {
    const currentStepData = steps[activeStep];

    if (currentStepData.action) {
      currentStepData.action();
    }

    setCompleted(prev => new Set(prev).add(currentStepData.id));

    if (activeStep < steps.length - 1) {
      setActiveStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  }, [activeStep, steps]);

  const handleBack = useCallback(() => {
    setActiveStep(prev => Math.max(0, prev - 1));
  }, []);

  const handleSkip = useCallback(() => {
    const currentStepData = steps[activeStep];
    setSkipped(prev => new Set(prev).add(currentStepData.id));

    if (activeStep < steps.length - 1) {
      setActiveStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  }, [activeStep, steps]);

  const handleComplete = useCallback(() => {
    setShowTour(false);
    onComplete?.();

    // Save completion to localStorage
    localStorage.setItem('upm-plus-onboarding-completed', 'true');
    localStorage.setItem('upm-plus-onboarding-date', new Date().toISOString());
  }, [onComplete]);

  const handleSkipTour = useCallback(() => {
    setShowTour(false);
    onSkip?.();

    // Save skip to localStorage
    localStorage.setItem('upm-plus-onboarding-skipped', 'true');
  }, [onSkip]);

  // Check if onboarding should be shown
  useEffect(() => {
    const hasCompleted = localStorage.getItem('upm-plus-onboarding-completed');
    const hasSkipped = localStorage.getItem('upm-plus-onboarding-skipped');

    if (hasCompleted || hasSkipped) {
      setShowTour(false);
    }
  }, []);

  if (!showTour || !open) {
    return null;
  }

  return (
    <Dialog
      open={showTour}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: '70vh',
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" component="div">
          {steps[activeStep].title}
        </Typography>
        <IconButton onClick={handleSkipTour} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pb: 2 }}>
        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={step.id} completed={completed.has(step.id)}>
              <StepLabel
                optional={
                  <Typography variant="caption">
                    {step.optional && 'Optional'}
                  </Typography>
                }
              >
                {step.title}
              </StepLabel>
              <StepContent>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  {step.description}
                </Typography>
                {index === activeStep && step.content}
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
            startIcon={<NavigateBefore />}
          >
            Back
          </Button>

          <Box sx={{ display: 'flex', gap: 1 }}>
            {steps[activeStep].skipable && (
              <Button onClick={handleSkip} color="inherit">
                Skip
              </Button>
            )}
            <Button
              onClick={handleNext}
              variant="contained"
              endIcon={<NavigateNext />}
            >
              {activeStep === steps.length - 1 ? 'Complete' : (steps[activeStep].actionText || 'Next')}
            </Button>
          </Box>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default OnboardingFlow;