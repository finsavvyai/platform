import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from './api';

// Types
export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  organization_id?: string;
  organization_name?: string;
  created_at: string;
  last_login?: string;
  mfa_enabled: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  member_count: number;
  settings: Record<string, any>;
}

export interface APIKey {
  id: string;
  name: string;
  key_prefix: string;
  user_id: string;
  organization_id?: string;
  scopes: string[];
  is_active: boolean;
  expires_at?: string;
  last_used_at?: string;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  ip_address: string;
  user_agent: string;
  status: 'success' | 'failure';
  details?: Record<string, any>;
  created_at: string;
}

export interface SystemSettings {
  maintenance_mode: boolean;
  allow_registration: boolean;
  require_email_verification: boolean;
  require_mfa: boolean;
  session_timeout_minutes: number;
  max_failed_login_attempts: number;
  password_min_length: number;
  default_user_role: string;
}

export interface CreateUserRequest {
  email: string;
  full_name: string;
  password: string;
  role: string;
  organization_id?: string;
}

export interface UpdateUserRequest {
  email?: string;
  full_name?: string;
  role?: string;
  is_active?: boolean;
}

export interface CreateAPIKeyRequest {
  name: string;
  scopes: string[];
  expires_at?: string;
}

export interface CreateAPIKeyResponse extends APIKey {
  key: string; // Full key only returned on creation
}

// API functions - Users
export const fetchUsers = async (params?: { page?: number; limit?: number; search?: string }): Promise<{ users: AdminUser[]; total: number }> => {
  try {
    const response = await api.get('/admin/users', { params });
    return response.data;
  } catch {
    return { users: [], total: 0 };
  }
};

export const fetchUser = async (id: string): Promise<AdminUser> => {
  const response = await api.get(`/admin/users/${id}`);
  return response.data;
};

export const createUser = async (data: CreateUserRequest): Promise<AdminUser> => {
  const response = await api.post('/admin/users', data);
  return response.data;
};

export const updateUser = async (id: string, data: UpdateUserRequest): Promise<AdminUser> => {
  const response = await api.put(`/admin/users/${id}`, data);
  return response.data;
};

export const deleteUser = async (id: string): Promise<void> => {
  await api.delete(`/admin/users/${id}`);
};

export const resetUserPassword = async (id: string): Promise<{ temporary_password: string }> => {
  const response = await api.post(`/admin/users/${id}/reset-password`);
  return response.data;
};

export const impersonateUser = async (id: string): Promise<{ access_token: string }> => {
  const response = await api.post(`/admin/users/${id}/impersonate`);
  return response.data;
};

// API functions - Organizations
export const fetchOrganizations = async (params?: { page?: number; limit?: number; search?: string }): Promise<{ organizations: Organization[]; total: number }> => {
  try {
    const response = await api.get('/admin/organizations', { params });
    return response.data;
  } catch {
    return { organizations: [], total: 0 };
  }
};

export const fetchOrganization = async (id: string): Promise<Organization> => {
  const response = await api.get(`/admin/organizations/${id}`);
  return response.data;
};

export const updateOrganization = async (id: string, data: Partial<Organization>): Promise<Organization> => {
  const response = await api.put(`/admin/organizations/${id}`, data);
  return response.data;
};

// API functions - API Keys
export const fetchAPIKeys = async (): Promise<APIKey[]> => {
  try {
    const response = await api.get('/admin/api-keys');
    return response.data;
  } catch {
    return [];
  }
};

export const createAPIKey = async (data: CreateAPIKeyRequest): Promise<CreateAPIKeyResponse> => {
  const response = await api.post('/admin/api-keys', data);
  return response.data;
};

export const revokeAPIKey = async (id: string): Promise<void> => {
  await api.delete(`/admin/api-keys/${id}`);
};

// API functions - Audit Logs
export const fetchAuditLogs = async (params?: {
  page?: number;
  limit?: number;
  user_id?: string;
  action?: string;
  resource_type?: string;
  start_date?: string;
  end_date?: string;
}): Promise<{ logs: AuditLogEntry[]; total: number }> => {
  try {
    const response = await api.get('/admin/audit-logs', { params });
    return response.data;
  } catch {
    return { logs: [], total: 0 };
  }
};

export const exportAuditLogs = async (params?: {
  start_date?: string;
  end_date?: string;
  format?: 'csv' | 'json';
}): Promise<Blob> => {
  const response = await api.get('/admin/audit-logs/export', {
    params,
    responseType: 'blob',
  });
  return response.data;
};

// API functions - System Settings
export const fetchSystemSettings = async (): Promise<SystemSettings> => {
  try {
    const response = await api.get('/admin/settings');
    return response.data;
  } catch {
    return {
      maintenance_mode: false,
      allow_registration: true,
      require_email_verification: false,
      require_mfa: false,
      session_timeout_minutes: 60,
      max_failed_login_attempts: 5,
      password_min_length: 8,
      default_user_role: 'user',
    };
  }
};

export const updateSystemSettings = async (data: Partial<SystemSettings>): Promise<SystemSettings> => {
  const response = await api.put('/admin/settings', data);
  return response.data;
};

// React Query hooks - Users
export const useUsers = (params?: { page?: number; limit?: number; search?: string }) => {
  return useQuery(['users', params], () => fetchUsers(params), {
    staleTime: 30000,
  });
};

export const useUser = (id: string) => {
  return useQuery(['user', id], () => fetchUser(id), {
    enabled: !!id,
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation(createUser, {
    onSuccess: () => {
      queryClient.invalidateQueries('users');
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    ({ id, data }: { id: string; data: UpdateUserRequest }) => updateUser(id, data),
    {
      onSuccess: (_, { id }) => {
        queryClient.invalidateQueries('users');
        queryClient.invalidateQueries(['user', id]);
      },
    }
  );
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation(deleteUser, {
    onSuccess: () => {
      queryClient.invalidateQueries('users');
    },
  });
};

// React Query hooks - Organizations
export const useOrganizations = (params?: { page?: number; limit?: number; search?: string }) => {
  return useQuery(['organizations', params], () => fetchOrganizations(params), {
    staleTime: 30000,
  });
};

// React Query hooks - API Keys
export const useAPIKeys = () => {
  return useQuery('apiKeys', fetchAPIKeys, {
    staleTime: 30000,
  });
};

export const useCreateAPIKey = () => {
  const queryClient = useQueryClient();
  
  return useMutation(createAPIKey, {
    onSuccess: () => {
      queryClient.invalidateQueries('apiKeys');
    },
  });
};

export const useRevokeAPIKey = () => {
  const queryClient = useQueryClient();
  
  return useMutation(revokeAPIKey, {
    onSuccess: () => {
      queryClient.invalidateQueries('apiKeys');
    },
  });
};

// React Query hooks - Audit Logs
export const useAuditLogs = (params?: {
  page?: number;
  limit?: number;
  user_id?: string;
  action?: string;
  resource_type?: string;
  start_date?: string;
  end_date?: string;
}) => {
  return useQuery(['auditLogs', params], () => fetchAuditLogs(params), {
    staleTime: 15000,
  });
};

// React Query hooks - System Settings
export const useSystemSettings = () => {
  return useQuery('systemSettings', fetchSystemSettings, {
    staleTime: 60000,
  });
};

export const useUpdateSystemSettings = () => {
  const queryClient = useQueryClient();
  
  return useMutation(updateSystemSettings, {
    onSuccess: () => {
      queryClient.invalidateQueries('systemSettings');
    },
  });
};

// Utility functions
export const AVAILABLE_ROLES = [
  { value: 'super_admin', label: 'Super Admin', description: 'Full system access' },
  { value: 'admin', label: 'Admin', description: 'Organization management' },
  { value: 'manager', label: 'Manager', description: 'Team management' },
  { value: 'developer', label: 'Developer', description: 'Development access' },
  { value: 'user', label: 'User', description: 'Standard access' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
];

export const API_SCOPES = [
  { value: 'read:workflows', label: 'Read Workflows' },
  { value: 'write:workflows', label: 'Write Workflows' },
  { value: 'execute:workflows', label: 'Execute Workflows' },
  { value: 'read:agents', label: 'Read Agents' },
  { value: 'write:agents', label: 'Write Agents' },
  { value: 'execute:agents', label: 'Execute Agents' },
  { value: 'read:documents', label: 'Read Documents' },
  { value: 'write:documents', label: 'Write Documents' },
  { value: 'read:analytics', label: 'Read Analytics' },
  { value: 'admin', label: 'Admin Access' },
];

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

