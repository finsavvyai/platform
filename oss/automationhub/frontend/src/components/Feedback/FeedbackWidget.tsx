import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  TextField,
  Rating,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  Snackbar,
  Slide,
  Fade,
  Grow,
  Tooltip,
  Avatar,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Feedback,
  Send,
  Close,
  ThumbUp,
  ThumbDown,
  Star,
  BugReport,
  Lightbulb,
  QuestionAnswer,
  ExpandMore,
  Analytics,
  TrendingUp,
  People,
  Speed,
  CheckCircle,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const FeedbackButton = styled(IconButton)(({ theme }) => ({
  position: 'fixed',
  bottom: theme.spacing(3),
  right: theme.spacing(3),
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  width: 56,
  height: 56,
  boxShadow: theme.shadows[6],
  '&:hover': {
    backgroundColor: theme.palette.primary.dark,
    transform: 'scale(1.1)',
  },
  zIndex: 1000,
}));

const FeedbackPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.grey[50]} 100%)`,
}));

interface FeedbackData {
  type: 'bug' | 'feature' | 'improvement' | 'question' | 'general';
  rating: number;
  title: string;
  description: string;
  email?: string;
  userAgent: string;
  url: string;
  timestamp: string;
  userId?: string;
  metadata: {
    component?: string;
    action?: string;
    errorCode?: string;
    browserInfo?: string;
    sessionDuration?: number;
  };
}

interface FeedbackWidgetProps {
  apiUrl?: string;
  userId?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right';
  showOnLoad?: boolean;
  autoPromptAfter?: number; // seconds
}

const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({
  apiUrl = 'http://localhost:8000',
  userId,
  position = 'bottom-right',
  showOnLoad = false,
  autoPromptAfter,
}) => {
  const [open, setOpen] = useState(showOnLoad);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackData, setFeedbackData] = useState<Partial<FeedbackData>>({
    type: 'general',
    rating: 0,
    title: '',
    description: '',
    userAgent: navigator.userAgent,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    userId,
    metadata: {},
  });
  const [showPrompt, setShowPrompt] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as const });

  // Auto-prompt for feedback
  useEffect(() => {
    if (autoPromptAfter && !localStorage.getItem('upm-plus-feedback-prompted')) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
        localStorage.setItem('upm-plus-feedback-prompted', 'true');
      }, autoPromptAfter * 1000);

      return () => clearTimeout(timer);
    }
  }, [autoPromptAfter]);

  const handleInputChange = useCallback((field: keyof FeedbackData, value: any) => {
    setFeedbackData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!feedbackData.title?.trim() || !feedbackData.description?.trim()) {
      setSnackbar({
        open: true,
        message: 'Please fill in all required fields',
        severity: 'error'
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${apiUrl}/api/v1/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...feedbackData,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) throw new Error('Failed to submit feedback');

      setSubmitted(true);
      setSnackbar({
        open: true,
        message: 'Thank you for your feedback!',
        severity: 'success'
      });

      // Reset form after delay
      setTimeout(() => {
        setSubmitted(false);
        setFeedbackData(prev => ({
          ...prev,
          rating: 0,
          title: '',
          description: '',
        }));
        setOpen(false);
      }, 2000);

    } catch (error) {
      console.error('Failed to submit feedback:', error);
      setSnackbar({
        open: true,
        message: 'Failed to submit feedback. Please try again.',
        severity: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  }, [feedbackData, apiUrl]);

  const getFeedbackIcon = (type: string) => {
    switch (type) {
      case 'bug':
        return <BugReport color="error" />;
      case 'feature':
        return <Lightbulb color="warning" />;
      case 'improvement':
        return <TrendingUp color="info" />;
      case 'question':
        return <QuestionAnswer color="primary" />;
      default:
        return <Feedback />;
    }
  };

  const getFeedbackColor = (type: string) => {
    switch (type) {
      case 'bug':
        return '#f44336';
      case 'feature':
        return '#ff9800';
      case 'improvement':
        return '#2196f3';
      case 'question':
        return '#9c27b0';
      default:
        return '#757575';
    }
  };

  const buttonPosition = {
    'bottom-right': { bottom: 24, right: 24 },
    'bottom-left': { bottom: 24, left: 24 },
    'top-right': { top: 24, right: 24 },
  }[position];

  return (
    <>
      {/* Feedback Button */}
      <FeedbackButton
        onClick={() => setOpen(true)}
        sx={buttonPosition}
        aria-label="Send feedback"
      >
        <Feedback />
      </FeedbackButton>

      {/* Auto Prompt Dialog */}
      <Dialog
        open={showPrompt}
        onClose={() => setShowPrompt(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
          }
        }}
      >
        <DialogTitle sx={{ textAlign: 'center' }}>
          <Avatar sx={{ bgcolor: 'white', color: 'primary.main', mx: 'auto', mb: 2 }}>
            <Feedback />
          </Avatar>
          <Typography variant="h5">How are we doing?</Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            Your feedback helps us improve UPM.Plus
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Rating
              size="large"
              value={feedbackData.rating}
              onChange={(_, value) => handleInputChange('rating', value)}
              sx={{ fontSize: '3rem' }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 2 }}>
            <Button
              variant="outlined"
              onClick={() => {
                handleInputChange('rating', 3);
                setShowPrompt(false);
                setOpen(true);
              }}
              sx={{ color: 'white', borderColor: 'white' }}
            >
              Tell us more
            </Button>
            <Button
              onClick={() => setShowPrompt(false)}
              sx={{ color: 'white' }}
            >
              Maybe later
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Main Feedback Dialog */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: 500 }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar sx={{ bgcolor: 'primary.main' }}>
              <Feedback />
            </Avatar>
            <Box>
              <Typography variant="h6">Send Feedback</Typography>
              <Typography variant="caption" color="textSecondary">
                Help us improve UPM.Plus
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setOpen(false)}>
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          {submitted ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Thank you for your feedback!
              </Typography>
              <Typography variant="body2" color="textSecondary">
                We appreciate your input and will use it to improve our product.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Feedback Type Selection */}
              <FeedbackPaper>
                <Typography variant="subtitle2" gutterBottom>
                  What type of feedback do you have?
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {[
                    { value: 'bug', label: 'Bug Report', icon: <BugReport /> },
                    { value: 'feature', label: 'Feature Request', icon: <Lightbulb /> },
                    { value: 'improvement', label: 'Improvement', icon: <TrendingUp /> },
                    { value: 'question', label: 'Question', icon: <QuestionAnswer /> },
                    { value: 'general', label: 'General', icon: <Feedback /> },
                  ].map((type) => (
                    <Chip
                      key={type.value}
                      icon={type.icon}
                      label={type.label}
                      onClick={() => handleInputChange('type', type.value)}
                      color={feedbackData.type === type.value ? 'primary' : 'default'}
                      variant={feedbackData.type === type.value ? 'filled' : 'outlined'}
                      clickable
                    />
                  ))}
                </Box>
              </FeedbackPaper>

              {/* Rating */}
              <FeedbackPaper>
                <Typography variant="subtitle2" gutterBottom>
                  How would you rate your experience?
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Rating
                    value={feedbackData.rating}
                    onChange={(_, value) => handleInputChange('rating', value)}
                    size="large"
                  />
                  <Typography variant="body2" color="textSecondary">
                    {feedbackData.rating > 0 && `${feedbackData.rating} out of 5 stars`}
                  </Typography>
                </Box>
              </FeedbackPaper>

              {/* Title */}
              <TextField
                fullWidth
                label="Title"
                placeholder="Brief summary of your feedback"
                value={feedbackData.title || ''}
                onChange={(e) => handleInputChange('title', e.target.value)}
                required
                variant="outlined"
              />

              {/* Description */}
              <TextField
                fullWidth
                label="Description"
                placeholder="Please provide detailed information about your feedback..."
                value={feedbackData.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value)}
                multiline
                rows={4}
                required
                variant="outlined"
              />

              {/* Email (Optional) */}
              <TextField
                fullWidth
                label="Email (optional)"
                placeholder="your.email@example.com"
                value={feedbackData.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
                type="email"
                helperText="Only if you'd like us to follow up with you"
                variant="outlined"
              />

              {/* Additional Information */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle2">
                    Additional Information
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><Analytics /></ListItemIcon>
                      <ListItemText
                        primary="Page"
                        secondary={window.location.href}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><Speed /></ListItemIcon>
                      <ListItemText
                        primary="Browser"
                        secondary={navigator.userAgent.split(' ').slice(-2).join(' ')}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><People /></ListItemIcon>
                      <ListItemText
                        primary="User ID"
                        secondary={userId || 'Anonymous'}
                      />
                    </ListItem>
                  </List>
                </AccordionDetails>
              </Accordion>
            </Box>
          )}
        </DialogContent>

        {!submitted && (
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={submitting || !feedbackData.title?.trim() || !feedbackData.description?.trim()}
              startIcon={submitting ? <></> : <Send />}
            >
              {submitting ? 'Sending...' : 'Send Feedback'}
            </Button>
          </DialogActions>
        )}
      </Dialog>

      {/* Success/Error Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default FeedbackWidget;