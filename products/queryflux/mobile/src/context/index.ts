// Context providers exports
export { ThemeProvider, useTheme } from './ThemeContext';
export { AuthProvider, useAuth } from './AuthContext';
export { NetworkProvider, useNetwork } from './NetworkContext';
export { NotificationProvider, useNotifications } from './NotificationContext';

// Combined provider component
import React from 'react';
import { ThemeProvider } from './ThemeContext';
import { AuthProvider } from './AuthContext';
import { NetworkProvider } from './NetworkContext';
import { NotificationProvider } from './NotificationContext';

interface AppProvidersProps {
  children: React.ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <ThemeProvider>
      <NetworkProvider>
        <AuthProvider>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </AuthProvider>
      </NetworkProvider>
    </ThemeProvider>
  );
};