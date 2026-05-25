/**
 * Domain Verification Component
 * Handles custom domain verification
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import { Public, CheckCircle, Info } from '@mui/icons-material';

interface DomainVerificationProps {
  onDomainUpdated?: () => void;
}

const DomainVerification: React.FC<DomainVerificationProps> = ({ onDomainUpdated }) => {
  const [domain, setDomain] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  const handleVerify = async () => {
    if (!domain.trim()) return;
    
    setVerifying(true);
    
    // Simulate verification
    setTimeout(() => {
      setVerifying(false);
      setVerified(true);
      onDomainUpdated?.();
    }, 2000);
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Custom Domain
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          Add a custom domain for white-label branding
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            fullWidth
            label="Domain"
            placeholder="app.yourdomain.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            size="small"
          />
          <Button
            variant="contained"
            onClick={handleVerify}
            disabled={verifying || !domain.trim()}
          >
            {verifying ? 'Verifying...' : 'Verify'}
          </Button>
        </Box>

        {verified && (
          <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 2 }}>
            Domain verified successfully!
          </Alert>
        )}

        <Typography variant="subtitle2" gutterBottom>
          DNS Configuration
        </Typography>
        <List dense>
          <ListItem>
            <ListItemIcon>
              <Info color="info" />
            </ListItemIcon>
            <ListItemText
              primary="Add a CNAME record"
              secondary="Point your domain to: app.automationhub.io"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <Info color="info" />
            </ListItemIcon>
            <ListItemText
              primary="SSL Certificate"
              secondary="SSL will be automatically provisioned after verification"
            />
          </ListItem>
        </List>
      </CardContent>
    </Card>
  );
};

export default DomainVerification;





