import React from 'react';
import { Typography, Box } from '@mui/material';

const Agents: React.FC = () => {
  return (
    <Box>
      <Typography variant="h3" component="h1" gutterBottom>
        AI Agents
      </Typography>
      
      <Typography variant="body1" color="text.secondary">
        Agent management interface - to be implemented in AI agent framework tasks
      </Typography>
    </Box>
  );
};

export default Agents;