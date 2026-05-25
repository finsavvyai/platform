import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';

const Layout: React.FC = () => {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* TODO: Add sidebar navigation */}
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout;