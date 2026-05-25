import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Popover,
  Paper,
  Typography,
  Button,
  IconButton,
  Card,
  CardContent,
  Fade,
  Grow,
  Zoom,
  Step,
  Stepper,
  StepLabel,
  Chip,
  Avatar,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Close,
  NavigateNext,
  NavigateBefore,
  CheckCircle,
  PlayArrow,
  Lightbulb,
  TipsAndUpdates,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

interface TourStep {
  id: string;
  selector: string;
  title: string;
  content: string;
  position?: 'bottom' | 'top' | 'left' | 'right' | 'center';
  action?: () => void;
  highlightPadding?: number;
  backdrop?: boolean;
}

interface GuidedTourProps {
  steps: TourStep[];
  onComplete?: () => void;
  onSkip?: () => void;
  startImmediately?: boolean;
  showProgress?: boolean;
}

const TourOverlay = styled('div')<{ targetRect: DOMRect; padding: number }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9998;
  pointer-events: none;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    pointer-events: auto;
  }

  .tour-spotlight {
    position: absolute;
    border: 3px solid ${({ theme }) => theme.palette.primary.main};
    border-radius: 8px;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
    pointer-events: none;
    z-index: 9999;
    transition: all 0.3s ease-in-out;
  }
`;

const TourPopover = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  maxWidth: 400,
  zIndex: 10000,
  position: 'relative',
  boxShadow: theme.shadows[8],
}));

const GuidedTour: React.FC<GuidedTourProps> = ({
  steps,
  onComplete,
  onSkip,
  startImmediately = false,
  showProgress = true,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isRunning, setIsRunning] = useState(startImmediately);
  const [targetElement, setTargetElement] = useState<Element | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<'bottom' | 'top' | 'left' | 'right' | 'center'>('bottom');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const spotlightRef = useRef<HTMLDivElement>(null);

  const currentStepData = steps[currentStep];

  // Find and highlight target element
  const highlightElement = useCallback(() => {
    if (!currentStepData || !isRunning) return;

    const element = document.querySelector(currentStepData.selector);
    if (!element) {
      console.warn(`Element not found: ${currentStepData.selector}`);
      return;
    }

    setTargetElement(element);
    const rect = element.getBoundingClientRect();
    setTargetRect(rect);

    // Set anchor element for popover
    setAnchorEl(element as HTMLElement);

    // Determine best position for popover
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const position = currentStepData.position || 'bottom';

    if (position === 'center') {
      setPopoverPosition('center');
    } else if (rect.bottom + 200 > viewportHeight && rect.top > 200) {
      setPopoverPosition('top');
    } else if (rect.right + 300 > viewportWidth && rect.left > 300) {
      setPopoverPosition('left');
    } else if (rect.left < 300 && rect.right + 300 < viewportWidth) {
      setPopoverPosition('right');
    } else {
      setPopoverPosition(position);
    }

    // Scroll element into view if needed
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
    });
  }, [currentStepData, isRunning]);

  // Update highlight when step changes
  useEffect(() => {
    if (isRunning) {
      const timer = setTimeout(highlightElement, 100);
      return () => clearTimeout(timer);
    }
  }, [currentStep, isRunning, highlightElement]);

  // Handle window resize
  useEffect(() => {
    if (isRunning && targetElement) {
      const handleResize = () => {
        const rect = targetElement.getBoundingClientRect();
        setTargetRect(rect);
      };

      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleResize);
      };
    }
  }, [isRunning, targetElement]);

  const handleNext = useCallback(() => {
    if (currentStepData?.action) {
      currentStepData.action();
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, currentStepData, steps.length]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleComplete = useCallback(() => {
    setIsRunning(false);
    onComplete?.();
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    setIsRunning(false);
    onSkip?.();
  }, [onSkip]);

  const startTour = useCallback(() => {
    setIsRunning(true);
    setCurrentStep(0);
  }, []);

  // Expose start method via ref or callback
  React.useImperativeHandle(React.createRef(), () => ({
    start: startTour,
    stop: () => setIsRunning(false),
  }));

  if (!isRunning || !currentStepData || !targetRect) {
    return null;
  }

  const padding = currentStepData.highlightPadding || 8;

  return (
    <>
      {/* Tour Overlay with Spotlight */}
      <TourOverlay targetRect={targetRect} padding={padding}>
        <div
          ref={spotlightRef}
          className="tour-spotlight"
          style={{
            top: targetRect.top - padding,
            left: targetRect.left - padding,
            width: targetRect.width + (padding * 2),
            height: targetRect.height + (padding * 2),
          }}
        />
      </TourOverlay>

      {/* Tour Popover */}
      {anchorEl && (
        <Popover
          open={isRunning}
          anchorEl={anchorEl}
          onClose={handleComplete}
          anchorOrigin={{
            vertical: popoverPosition === 'top' ? 'top' : 'bottom',
            horizontal: popoverPosition === 'left' ? 'left' : popoverPosition === 'right' ? 'right' : 'center',
          }}
          transformOrigin={{
            vertical: popoverPosition === 'top' ? 'bottom' : 'top',
            horizontal: popoverPosition === 'left' ? 'right' : popoverPosition === 'left' ? 'left' : 'center',
          }}
          PaperProps={{
            sx: {
              p: 0,
              overflow: 'visible',
              '&::before': {
                content: '""',
                position: 'absolute',
                width: 0,
                height: 0,
                borderStyle: 'solid',
                borderWidth: popoverPosition === 'top' ? '0 10px 10px 10px' : '10px 10px 0 10px',
                borderColor: popoverPosition === 'top'
                  ? `transparent transparent white transparent`
                  : `white transparent transparent transparent`,
                top: popoverPosition === 'top' ? '100%' : 'auto',
                bottom: popoverPosition === 'bottom' ? '100%' : 'auto',
                left: '50%',
                transform: 'translateX(-50%)',
              },
            },
          }}
        >
          <TourPopover>
            {/* Tour Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                  <Lightbulb />
                </Avatar>
                <Box>
                  <Typography variant="h6" component="div">
                    {currentStepData.title}
                  </Typography>
                  {showProgress && (
                    <Typography variant="caption" color="textSecondary">
                      Step {currentStep + 1} of {steps.length}
                    </Typography>
                  )}
                </Box>
              </Box>
              <IconButton size="small" onClick={handleSkip}>
                <Close />
              </IconButton>
            </Box>

            {/* Progress Bar */}
            {showProgress && (
              <Box sx={{ mb: 2 }}>
                <Box
                  sx={{
                    height: 4,
                    bgcolor: 'grey.200',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      height: '100%',
                      width: `${((currentStep + 1) / steps.length) * 100}%`,
                      bgcolor: 'primary.main',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </Box>
              </Box>
            )}

            {/* Tour Content */}
            <Typography variant="body1" sx={{ mb: 3 }}>
              {currentStepData.content}
            </Typography>

            {/* Tour Actions */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button
                size="small"
                onClick={handleSkip}
                color="inherit"
              >
                Skip Tour
              </Button>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  startIcon={<NavigateBefore />}
                >
                  Previous
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleNext}
                  endIcon={
                    currentStep === steps.length - 1 ? <CheckCircle /> : <NavigateNext />
                  }
                >
                  {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                </Button>
              </Box>
            </Box>
          </TourPopover>
        </Popover>
      )}
    </>
  );
};

// Predefined tour configurations
export const workflowBuilderTour: TourStep[] = [
  {
    id: 'welcome',
    selector: '[data-tour="workflow-welcome"]',
    title: 'Welcome to Workflow Builder!',
    content: 'This is where you create powerful automation workflows using our visual drag-and-drop interface.',
    position: 'center',
    backdrop: true,
  },
  {
    id: 'toolbar',
    selector: '[data-tour="workflow-toolbar"]',
    title: 'Workflow Toolbar',
    content: 'Use the toolbar to save, execute, and configure your workflows. Click "Add Node" to get started.',
    position: 'bottom',
  },
  {
    id: 'node-menu',
    selector: '[data-tour="add-node-button"]',
    title: 'Add Nodes',
    content: 'Click here to add different types of nodes to your workflow. Each node represents a specific action or trigger.',
    position: 'bottom',
    action: () => {
      // Simulate clicking the add node button
      const button = document.querySelector('[data-tour="add-node-button"]') as HTMLButtonElement;
      button?.click();
    },
  },
  {
    id: 'canvas',
    selector: '[data-tour="workflow-canvas"]',
    title: 'Workflow Canvas',
    content: 'This is your workspace. Drag and drop nodes here, then connect them to create automation flows.',
    position: 'center',
  },
  {
    id: 'controls',
    selector: '[data-tour="workflow-controls"]',
    title: 'Canvas Controls',
    content: 'Use these controls to zoom in/out, center the view, and see a minimap of your workflow.',
    position: 'left',
  },
  {
    id: 'minimap',
    selector: '[data-tour="workflow-minimap"]',
    title: 'Workflow Minimap',
    content: 'Get a bird\'s eye view of your entire workflow and navigate quickly to different areas.',
    position: 'left',
  },
];

export const dashboardTour: TourStep[] = [
  {
    id: 'welcome',
    selector: '[data-tour="dashboard-welcome"]',
    title: 'Dashboard Overview',
    content: 'Your command center for monitoring and managing your automation ecosystem.',
    position: 'center',
    backdrop: true,
  },
  {
    id: 'metrics',
    selector: '[data-tour="system-metrics"]',
    title: 'System Metrics',
    content: 'Monitor CPU, memory, and disk usage in real-time to ensure optimal performance.',
    position: 'left',
  },
  {
    id: 'workflows',
    selector: '[data-tour="active-workflows"]',
    title: 'Active Workflows',
    content: 'See all your running workflows, their progress, and control their execution.',
    position: 'right',
  },
  {
    id: 'agents',
    selector: '[data-tour="agent-status"]',
    title: 'Agent Status',
    content: 'Check on your AI agents, see what they\'re working on, and monitor their performance.',
    position: 'left',
  },
  {
    id: 'logs',
    selector: '[data-tour="recent-logs"]',
    title: 'Recent Activity',
    content: 'View recent log entries, system events, and troubleshooting information.',
    position: 'top',
  },
];

export const knowledgeTour: TourStep[] = [
  {
    id: 'welcome',
    selector: '[data-tour="knowledge-welcome"]',
    title: 'Knowledge Management',
    content: 'Build your intelligent knowledge base by uploading documents and letting AI understand them.',
    position: 'center',
    backdrop: true,
  },
  {
    id: 'upload',
    selector: '[data-tour="upload-button"]',
    title: 'Upload Documents',
    content: 'Upload PDFs, Word documents, text files, and more. AI will automatically process and understand them.',
    position: 'bottom',
  },
  {
    id: 'search',
    selector: '[data-tour="search-bar"]',
    title: 'Semantic Search',
    content: 'Search your documents using natural language queries. AI finds relevant content based on meaning, not just keywords.',
    position: 'bottom',
  },
  {
    id: 'documents',
    selector: '[data-tour="document-list"]',
    title: 'Document Library',
    content: 'Manage all your uploaded documents, track processing status, and organize with tags.',
    position: 'left',
  },
];

export default GuidedTour;