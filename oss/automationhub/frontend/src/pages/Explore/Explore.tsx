import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  Alert,
  CircularProgress,
  Chip,
  Link,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import ContentCopy from '@mui/icons-material/ContentCopy';
import Add from '@mui/icons-material/Add';
import ArrowBack from '@mui/icons-material/ArrowBack';
import PlayArrow from '@mui/icons-material/PlayArrow';
import { getSharedWorkflow, duplicateFromShare } from '../../services/workflowApi';
import api from '../../services/api';
import { isAuthenticated } from '../../services/authApi';
import SocialShareButtons from '../../components/Share/SocialShareButtons';

export default function Explore() {
  const { token } = useParams<{ token?: string }>();
  const navigate = useNavigate();
  const [shared, setShared] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copyOk, setCopyOk] = useState(false);
  const [dupLoading, setDupLoading] = useState(false);
  const [dupError, setDupError] = useState<string | null>(null);
  const [demoWorkflow, setDemoWorkflow] = useState<any>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      getSharedWorkflow(token)
        .then(setShared)
        .catch(() => setShared(null))
        .finally(() => setLoading(false));
    } else {
      api.get('/marketplace/featured').then((r) => setTemplates(r.data || [])).catch(() => setTemplates([])).finally(() => setLoading(false));
    }
  }, [token]);

  const handleCopyLink = () => {
    if (!token) return;
    const url = `${window.location.origin}/explore/t/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 2000);
    });
  };

  const handleDuplicate = () => {
    if (!token) return;
    setDupError(null);
    setDupLoading(true);
    duplicateFromShare(token)
      .then(() => {
        navigate('/workflows');
      })
      .catch((e) => setDupError(e.response?.data?.detail || 'Failed to duplicate'))
      .finally(() => setDupLoading(false));
  };

  const handleTryDemo = () => {
    setDemoError(null);
    setDemoLoading(true);
    api.get('/public/workflows/demo')
      .then((r) => setDemoWorkflow(r.data))
      .catch((e) => setDemoError(e.response?.data?.detail || 'Failed to load demo'))
      .finally(() => setDemoLoading(false));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (token && shared) {
    return (
      <Box p={3} maxWidth="md" mx="auto">
        {isAuthenticated() && (
          <Link component="button" variant="body2" onClick={() => navigate('/')} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
            <ArrowBack fontSize="small" /> Back to app
          </Link>
        )}
        <Typography variant="h4" gutterBottom>
          {shared.name}
        </Typography>
        {shared.description && (
          <Typography color="text.secondary" paragraph>
            {shared.description}
          </Typography>
        )}
        <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
          <Button variant="outlined" size="small" startIcon={<ContentCopy />} onClick={handleCopyLink}>
            {copyOk ? 'Copied!' : 'Copy link'}
          </Button>
          <Button variant="contained" startIcon={<Add />} onClick={handleDuplicate} disabled={dupLoading}>
            {dupLoading ? 'Duplicating…' : 'Duplicate to my account'}
          </Button>
        </Box>
        <Box sx={{ mb: 2 }}>
          <SocialShareButtons
            url={token ? `${window.location.origin}/explore/t/${token}` : ''}
            title={shared.name || 'Shared workflow'}
          />
        </Box>
        {dupError && <Alert severity="error" sx={{ mb: 2 }}>{dupError}</Alert>}
        <Typography variant="body2" color="text.secondary">
          {shared.nodes?.length ?? 0} nodes · Use “Duplicate to my account” to add this workflow to your workspace.
        </Typography>
      </Box>
    );
  }

  if (token && !shared) {
    return (
      <Box p={3} textAlign="center">
        <Alert severity="warning">This share link is invalid or has expired.</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/explore')}>Browse templates</Button>
      </Box>
    );
  }

  if (demoWorkflow) {
    return (
      <Box p={3} maxWidth="md" mx="auto">
        <Button startIcon={<ArrowBack />} onClick={() => setDemoWorkflow(null)} sx={{ mb: 2 }}>
          Back to templates
        </Button>
        <Typography variant="h4" gutterBottom>
          {demoWorkflow.name}
        </Typography>
        <Typography color="text.secondary" paragraph>
          {demoWorkflow.description}
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          {demoWorkflow.nodes?.length ?? 0} nodes · This is a read-only demo.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/register?from=demo')}>
          Sign up to save your own
        </Button>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {isAuthenticated() && (
        <Link component="button" variant="body2" onClick={() => navigate('/')} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
          <ArrowBack fontSize="small" /> Back to app
        </Link>
      )}
      <Typography variant="h4" gutterBottom>
        Explore templates
      </Typography>
      <Typography color="text.secondary" paragraph>
        Use a template to get started, or duplicate a shared workflow from a link.
      </Typography>
      <Box sx={{ mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={demoLoading ? <CircularProgress size={20} /> : <PlayArrow />}
          onClick={handleTryDemo}
          disabled={demoLoading}
        >
          {demoLoading ? 'Loading…' : 'Try demo workflow'}
        </Button>
        {demoError && <Alert severity="error" sx={{ mt: 1 }}>{demoError}</Alert>}
      </Box>
      <Grid container spacing={2}>
        {Array.isArray(templates) && templates.map((t: any) => (
          <Grid item xs={12} sm={6} md={4} key={t.id}>
            <Card>
              <CardContent>
                <Typography variant="h6">{t.name}</Typography>
                <Typography variant="body2" color="text.secondary">{t.description}</Typography>
                <Box mt={1}>
                  {t.tags?.slice(0, 3).map((tag: string) => (
                    <Chip key={tag} label={tag} size="small" sx={{ mr: 0.5, mt: 0.5 }} />
                  ))}
                </Box>
              </CardContent>
              <CardActions>
                <Button size="small" href={`/marketplace/${t.id}`}>View</Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
      {(!templates || templates.length === 0) && (
        <Typography color="text.secondary">No featured templates yet. Create workflows and share them!</Typography>
      )}
    </Box>
  );
}
