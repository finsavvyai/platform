import React from 'react';
import { Typography, Box, Card, CardContent, Grid } from '@mui/material';

const Dashboard: React.FC = () => {
  return (
    <Box>
      <Typography variant="h3" component="h1" gutterBottom>
        UPM.Plus Dashboard
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Welcome to UPM.Plus - The Autonomous Digital Ecosystem Orchestrator
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="h2">
                Workflows
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage and execute your automation workflows
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="h2">
                AI Agents
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Configure and monitor your AI agents
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="h2">
                Knowledge Base
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage documents and knowledge resources
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;