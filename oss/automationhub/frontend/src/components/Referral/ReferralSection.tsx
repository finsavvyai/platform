import React, { useState } from 'react';
import {
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Paper,
  InputAdornment,
} from '@mui/material';
import ContentCopy from '@mui/icons-material/ContentCopy';
import { useMyReferral } from '../../services/referralApi';
import SocialShareButtons from '../Share/SocialShareButtons';

export default function ReferralSection() {
  const { data, isLoading, error } = useMyReferral();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!data?.invite_link) return;
    navigator.clipboard.writeText(data.invite_link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (isLoading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">Failed to load invite link</Alert>;
  if (!data) return null;

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Invite friends
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Share your link; when someone signs up with it, they’ll be attributed to you.
      </Typography>
      <TextField
        fullWidth
        size="small"
        value={data.invite_link}
        inputProps={{ readOnly: true }}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <Button startIcon={<ContentCopy />} onClick={handleCopy} size="small">
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />
      <SocialShareButtons url={data.invite_link} title="Join me on UPM.Plus" />
    </Paper>
  );
}
