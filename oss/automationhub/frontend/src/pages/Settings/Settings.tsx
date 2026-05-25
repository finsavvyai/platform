import React from 'react';
import { Typography, Box } from '@mui/material';

const Settings: React.FC = () => {
  return (
    <Box>
      <Typography variant="h3" component="h1" gutterBottom>
        Settings
      </Typography>
      
      <Typography variant="body1" color="text.secondary">
        Application settings interface - to be implemented in user management tasks
      </Typography>
    </Box>
  );
};

export default Settings;