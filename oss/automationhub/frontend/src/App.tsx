import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Provider } from 'react-redux';

import { store } from './store/store';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard/Dashboard';
import Workflows from './pages/Workflows/Workflows';
import Agents from './pages/Agents/Agents';
import Documents from './pages/Documents/Documents';
import Settings from './pages/Settings/Settings';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';

// Create Material-UI theme
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
});

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Router>
            <Box sx={{ display: 'flex', minHeight: '100vh' }}>
              <Routes>
                {/* Auth routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                
                {/* Main application routes */}
                <Route path="/" element={<Layout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="workflows" element={<Workflows />} />
                  <Route path="agents" element={<Agents />} />
                  <Route path="documents" element={<Documents />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
              </Routes>
            </Box>
          </Router>
        </ThemeProvider>
      </QueryClientProvider>
    </Provider>
  );
}

export default App;