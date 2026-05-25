/**
 * Brand Asset Upload Component
 * Handles uploading brand assets like logos and icons
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  LinearProgress,
} from '@mui/material';
import { CloudUpload } from '@mui/icons-material';

interface BrandAssetUploadProps {
  onAssetUploaded?: () => void;
}

const BrandAssetUpload: React.FC<BrandAssetUploadProps> = ({ onAssetUploaded }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setProgress(0);

    // Simulate upload
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setUploading(false);
          onAssetUploaded?.();
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Upload Brand Assets
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          Upload your logo, favicon, and other brand assets
        </Typography>

        <Box
          sx={{
            border: '2px dashed',
            borderColor: 'divider',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            cursor: 'pointer',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'action.hover',
            },
          }}
          component="label"
        >
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={handleFileSelect}
            multiple
          />
          <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="body1" gutterBottom>
            Drag and drop files here, or click to select
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Supports: PNG, JPG, SVG (max 5MB)
          </Typography>
        </Box>

        {uploading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress variant="determinate" value={progress} />
            <Typography variant="caption" color="textSecondary">
              Uploading... {progress}%
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default BrandAssetUpload;





