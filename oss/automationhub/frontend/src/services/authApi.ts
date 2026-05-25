import { useMutation, useQuery, useQueryClient } from 'react-query';
import api from './api';

// Types
export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  organization_id?: string;
  created_at: string;
  updated_at: string;
  avatar_url?: string;
  mfa_enabled?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
  mfa_code?: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  organization_name?: string;
  referral_code?: string;
  confirm_password?: string;
  accept_terms?: boolean;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  new_password: string;
}

export interface MFASetupResponse {
  secret: string;
  qr_code: string;
  backup_codes: string[];
}

// API functions
export const login = async (data: LoginRequest): Promise<LoginResponse> => {
  const response = await api.post('/auth/login', data);
  const { access_token, refresh_token } = response.data;
  
  localStorage.setItem('access_token', access_token);
  localStorage.setItem('refresh_token', refresh_token);
  
  return response.data;
};

export const register = async (data: RegisterRequest): Promise<LoginResponse> => {
  const response = await api.post('/auth/register', data);
  const { access_token, refresh_token } = response.data;
  
  localStorage.setItem('access_token', access_token);
  localStorage.setItem('refresh_token', refresh_token);
  
  return response.data;
};

export const logout = async (): Promise<void> => {
  try {
    await api.post('/auth/logout');
  } finally {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }
};

export const getCurrentUser = async (): Promise<User> => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const updateProfile = async (data: Partial<User>): Promise<User> => {
  const response = await api.put('/auth/me', data);
  return response.data;
};

export const changePassword = async (data: { current_password: string; new_password: string }): Promise<void> => {
  await api.post('/auth/change-password', data);
};

export const requestPasswordReset = async (data: PasswordResetRequest): Promise<void> => {
  await api.post('/auth/password-reset/request', data);
};

export const confirmPasswordReset = async (data: PasswordResetConfirm): Promise<void> => {
  await api.post('/auth/password-reset/confirm', data);
};

export const setupMFA = async (): Promise<MFASetupResponse> => {
  const response = await api.post('/auth/mfa/setup');
  return response.data;
};

export const verifyMFA = async (code: string): Promise<void> => {
  await api.post('/auth/mfa/verify', { code });
};

export const disableMFA = async (code: string): Promise<void> => {
  await api.post('/auth/mfa/disable', { code });
};

// React Query hooks
export const useLogin = () => {
  const queryClient = useQueryClient();
  
  return useMutation(login, {
    onSuccess: () => {
      queryClient.invalidateQueries('currentUser');
    },
  });
};

export const useRegister = () => {
  const queryClient = useQueryClient();
  
  return useMutation(register, {
    onSuccess: () => {
      queryClient.invalidateQueries('currentUser');
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  
  return useMutation(logout, {
    onSuccess: () => {
      queryClient.clear();
    },
  });
};

export const useCurrentUser = () => {
  return useQuery('currentUser', getCurrentUser, {
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  
  return useMutation(updateProfile, {
    onSuccess: () => {
      queryClient.invalidateQueries('currentUser');
    },
  });
};

export const useChangePassword = () => {
  return useMutation(changePassword);
};

export const useSetupMFA = () => {
  return useMutation(setupMFA);
};

export const useVerifyMFA = () => {
  const queryClient = useQueryClient();
  
  return useMutation(verifyMFA, {
    onSuccess: () => {
      queryClient.invalidateQueries('currentUser');
    },
  });
};

// Auth state helpers
export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('access_token');
};

export const getAccessToken = (): string | null => {
  return localStorage.getItem('access_token');
};

