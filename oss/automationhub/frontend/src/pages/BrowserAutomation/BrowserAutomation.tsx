import React from 'react';
import { Container } from '@mui/material';
import BrowserAutomation from '../components/BrowserAutomation/BrowserAutomation';

const BrowserAutomationPage: React.FC = () => {
  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <BrowserAutomation />
    </Container>
  );
};

export default BrowserAutomationPage;
