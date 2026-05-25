import React, { useState } from 'react';
import {
  Typography,
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Link,
  Divider,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';

interface RegisterForm {
  email: string;
  password: string;
  confirmPassword: string;
  full_name: string;
  organization_name: string;
  acceptTerms: boolean;
}

const Register: React.FC = () => {
  const navigate = useNavigate();
  
  const [form, setForm] = useState<RegisterForm>({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    organization_name: '',
    acceptTerms: false
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error when user starts typing
    if (error) setError(null);
  };

  const validateForm = (): string | null => {
    if (!form.email || !form.password || !form.full_name) {
      return 'Please fill in all required fields';
    }
    
    if (form.password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    
    if (form.password !== form.confirmPassword) {
      return 'Passwords do not match';
    }
    
    if (!form.acceptTerms) {
      return 'Please accept the terms and conditions';
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          organization_name: form.organization_name || undefined
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Registration failed');
      }

      setSuccess(true);
      
      // Redirect to login after successful registration
      setTimeout(() => {
        navigate('/login', { 
          state: { 
            message: 'Registration successful! Please log in with your credentials.' 
          }
        });
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Container component="main" maxWidth="sm">
        <Box
          sx={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Paper elevation={3} sx={{ padding: 4, width: '100%' }}>
            <Alert severity="success" sx={{ mb: 2 }}>
              Registration successful! Redirecting to login...
            </Alert>
            <Box sx={{ textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          </Paper>
        </Box>
      </Container>
    );
  }

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ padding: 4, width: '100%' }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography component="h1" variant="h4" gutterBottom>
              Join UPM.Plus
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Start automating your digital ecosystem today
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="full_name"
              label="Full Name"
              name="full_name"
              autoComplete="name"
              autoFocus
              value={form.full_name}
              onChange={handleChange}
              disabled={loading}
            />
            
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              disabled={loading}
              type="email"
            />
            
            <TextField
              margin="normal"
              fullWidth
              id="organization_name"
              label="Organization Name (Optional)"
              name="organization_name"
              value={form.organization_name}
              onChange={handleChange}
              disabled={loading}
              helperText="Leave blank to join the default organization"
            />
            
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange}
              disabled={loading}
              helperText="Must be at least 8 characters long"
            />
            
            <TextField
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label="Confirm Password"
              type="password"
              id="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              disabled={loading}
            />
            
            <FormControlLabel
              control={
                <Checkbox
                  name="acceptTerms"
                  checked={form.acceptTerms}
                  onChange={handleChange}
                  disabled={loading}
                />
              }
              label={
                <Typography variant="body2">
                  I accept the{' '}
                  <Link href="#" underline="hover">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="#" underline="hover">
                    Privacy Policy
                  </Link>
                </Typography>
              }
              sx={{ mt: 2 }}
            />
            
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
              size="large"
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Create Account'
              )}
            </Button>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Already have an account?{' '}
                <Link component={RouterLink} to="/login" underline="hover">
                  Sign in here
                </Link>
              </Typography>
            </Box>
          </Box>
        </Paper>

        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            © 2024 UPM.Plus. All rights reserved.
          </Typography>
        </Box>
      </Box>
    </Container>
  );
};

export default Register;