/**
 * Theme Preview Component
 * Shows a preview of the current theme configuration
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
} from '@mui/material';

interface ThemePreviewProps {
  config: {
    identity: {
      company_name: string;
      tagline: string;
    };
    theme: {
      primary_color: string;
      secondary_color: string;
      accent_color: string;
      background_color: string;
    };
  };
}

const ThemePreview: React.FC<ThemePreviewProps> = ({ config }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Theme Preview
        </Typography>
        
        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            p: 2,
            bgcolor: config.theme.background_color || '#ffffff',
          }}
        >
          {/* Header Preview */}
          <Box
            sx={{
              bgcolor: config.theme.primary_color || '#3B82F6',
              color: 'white',
              p: 1,
              borderRadius: 1,
              mb: 2,
            }}
          >
            <Typography variant="subtitle2">
              {config.identity.company_name || 'Your Company'}
            </Typography>
          </Box>

          {/* Content Preview */}
          <Typography variant="body2" gutterBottom>
            {config.identity.tagline || 'Your tagline here'}
          </Typography>

          {/* Button Preview */}
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Button
              variant="contained"
              size="small"
              sx={{
                bgcolor: config.theme.primary_color || '#3B82F6',
                '&:hover': { bgcolor: config.theme.primary_color || '#3B82F6' },
              }}
            >
              Primary
            </Button>
            <Button
              variant="contained"
              size="small"
              sx={{
                bgcolor: config.theme.secondary_color || '#10B981',
                '&:hover': { bgcolor: config.theme.secondary_color || '#10B981' },
              }}
            >
              Secondary
            </Button>
            <Chip
              label="Accent"
              size="small"
              sx={{
                bgcolor: config.theme.accent_color || '#F59E0B',
                color: 'white',
              }}
            />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ThemePreview;





