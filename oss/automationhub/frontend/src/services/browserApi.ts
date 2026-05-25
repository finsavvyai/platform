import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';

// API base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

// Types
export interface BrowserSession {
  id: string;
  name: string;
  browser_type: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  viewport: { width: number; height: number };
  user_agent?: string;
  extra_headers: Record<string, string>;
  proxy?: Record<string, string>;
  locale: string;
  timezone: string;
  status: 'active' | 'inactive' | 'error';
  created_at: string;
  last_activity: string;
}

export interface BrowserAction {
  id: string;
  type: 'navigate' | 'click' | 'fill' | 'select' | 'extract' | 'wait' | 'screenshot' | 'scroll' | 'hover' | 'double_click';
  selector?: string;
  value?: string;
  url?: string;
  timeout: number;
  wait_for?: 'load' | 'networkidle' | 'element';
  description: string;
  retry_count: number;
  self_healing: boolean;
}

export interface BrowserWorkflow {
  id: string;
  name: string;
  description: string;
  actions: BrowserAction[];
  variables: Record<string, any>;
  session_config: Partial<BrowserSession>;
  error_handling: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  last_execution?: string;
  execution_count?: number;
  success_rate?: number;
}

export interface BrowserExecutionResult {
  execution_id: string;
  workflow_id: string;
  session_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  results: any[];
  errors: string[];
  screenshots: string[];
  logs: string[];
  metadata: Record<string, any>;
}

export interface CreateSessionRequest {
  name: string;
  browser_type?: 'chromium' | 'firefox' | 'webkit';
  headless?: boolean;
  viewport?: { width: number; height: number };
  user_agent?: string;
  extra_headers?: Record<string, string>;
  locale?: string;
  timezone?: string;
}

export interface CreateWorkflowRequest {
  name: string;
  description: string;
  actions: BrowserAction[];
  session_config?: Partial<BrowserSession>;
  variables?: Record<string, any>;
  error_handling?: Record<string, any>;
}

export interface ExecuteWorkflowRequest {
  workflow_id: string;
  session_config?: Partial<BrowserSession>;
  variables?: Record<string, any>;
  timeout?: number;
}

// API functions
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Browser Session API calls
export const fetchBrowserSessions = async (): Promise<BrowserSession[]> => {
  const response = await api.get('/browser/sessions');
  return response.data;
};

export const fetchBrowserSession = async (sessionId: string): Promise<BrowserSession> => {
  const response = await api.get(`/browser/sessions/${sessionId}`);
  return response.data;
};

export const createBrowserSession = async (data: CreateSessionRequest): Promise<BrowserSession> => {
  const response = await api.post('/browser/sessions', data);
  return response.data;
};

export const updateBrowserSession = async (sessionId: string, data: Partial<CreateSessionRequest>): Promise<BrowserSession> => {
  const response = await api.put(`/browser/sessions/${sessionId}`, data);
  return response.data;
};

export const deleteBrowserSession = async (sessionId: string): Promise<void> => {
  await api.delete(`/browser/sessions/${sessionId}`);
};

export const startBrowserSession = async (sessionId: string): Promise<BrowserSession> => {
  const response = await api.post(`/browser/sessions/${sessionId}/start`);
  return response.data;
};

export const stopBrowserSession = async (sessionId: string): Promise<BrowserSession> => {
  const response = await api.post(`/browser/sessions/${sessionId}/stop`);
  return response.data;
};

export const takeSessionScreenshot = async (sessionId: string): Promise<string> => {
  const response = await api.post(`/browser/sessions/${sessionId}/screenshot`);
  return response.data.screenshot;
};

// Browser Workflow API calls
export const fetchBrowserWorkflows = async (): Promise<BrowserWorkflow[]> => {
  const response = await api.get('/browser/workflows');
  return response.data;
};

export const fetchBrowserWorkflow = async (workflowId: string): Promise<BrowserWorkflow> => {
  const response = await api.get(`/browser/workflows/${workflowId}`);
  return response.data;
};

export const createBrowserWorkflow = async (data: CreateWorkflowRequest): Promise<BrowserWorkflow> => {
  const response = await api.post('/browser/workflows', data);
  return response.data;
};

export const updateBrowserWorkflow = async (workflowId: string, data: Partial<CreateWorkflowRequest>): Promise<BrowserWorkflow> => {
  const response = await api.put(`/browser/workflows/${workflowId}`, data);
  return response.data;
};

export const deleteBrowserWorkflow = async (workflowId: string): Promise<void> => {
  await api.delete(`/browser/workflows/${workflowId}`);
};

export const duplicateBrowserWorkflow = async (workflowId: string, newName?: string): Promise<BrowserWorkflow> => {
  const response = await api.post(`/browser/workflows/${workflowId}/duplicate`, { name: newName });
  return response.data;
};

export const executeBrowserWorkflow = async (data: ExecuteWorkflowRequest): Promise<BrowserExecutionResult> => {
  const response = await api.post('/browser/workflows/execute', data);
  return response.data;
};

export const stopWorkflowExecution = async (executionId: string): Promise<void> => {
  await api.post(`/browser/executions/${executionId}/stop`);
};

// Execution History API calls
export const fetchExecutionHistory = async (workflowId?: string, limit?: number): Promise<BrowserExecutionResult[]> => {
  const params = new URLSearchParams();
  if (workflowId) params.append('workflow_id', workflowId);
  if (limit) params.append('limit', limit.toString());
  
  const response = await api.get(`/browser/executions?${params}`);
  return response.data;
};

export const fetchExecutionResult = async (executionId: string): Promise<BrowserExecutionResult> => {
  const response = await api.get(`/browser/executions/${executionId}`);
  return response.data;
};

export const downloadExecutionReport = async (executionId: string): Promise<Blob> => {
  const response = await api.get(`/browser/executions/${executionId}/report`, {
    responseType: 'blob',
  });
  return response.data;
};

// Analytics API calls
export const fetchBrowserAnalytics = async (timeRange?: string): Promise<any> => {
  const params = timeRange ? `?time_range=${timeRange}` : '';
  const response = await api.get(`/browser/analytics${params}`);
  return response.data;
};

// React Query hooks
export const useBrowserSessions = () => {
  return useQuery('browser-sessions', fetchBrowserSessions, {
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000,
  });
};

export const useBrowserSession = (sessionId: string) => {
  return useQuery(['browser-session', sessionId], () => fetchBrowserSession(sessionId), {
    enabled: !!sessionId,
    refetchInterval: 5000, // Refresh every 5 seconds for active sessions
  });
};

export const useCreateBrowserSession = () => {
  const queryClient = useQueryClient();
  
  return useMutation(createBrowserSession, {
    onSuccess: () => {
      queryClient.invalidateQueries('browser-sessions');
    },
  });
};

export const useUpdateBrowserSession = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    ({ sessionId, data }: { sessionId: string; data: Partial<CreateSessionRequest> }) => 
      updateBrowserSession(sessionId, data),
    {
      onSuccess: (_, { sessionId }) => {
        queryClient.invalidateQueries('browser-sessions');
        queryClient.invalidateQueries(['browser-session', sessionId]);
      },
    }
  );
};

export const useDeleteBrowserSession = () => {
  const queryClient = useQueryClient();
  
  return useMutation(deleteBrowserSession, {
    onSuccess: () => {
      queryClient.invalidateQueries('browser-sessions');
    },
  });
};

export const useStartBrowserSession = () => {
  const queryClient = useQueryClient();
  
  return useMutation(startBrowserSession, {
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries('browser-sessions');
      queryClient.invalidateQueries(['browser-session', sessionId]);
    },
  });
};

export const useStopBrowserSession = () => {
  const queryClient = useQueryClient();
  
  return useMutation(stopBrowserSession, {
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries('browser-sessions');
      queryClient.invalidateQueries(['browser-session', sessionId]);
    },
  });
};

export const useBrowserWorkflows = () => {
  return useQuery('browser-workflows', fetchBrowserWorkflows, {
    refetchInterval: 30000,
    staleTime: 10000,
  });
};

export const useBrowserWorkflow = (workflowId: string) => {
  return useQuery(['browser-workflow', workflowId], () => fetchBrowserWorkflow(workflowId), {
    enabled: !!workflowId,
  });
};

export const useCreateBrowserWorkflow = () => {
  const queryClient = useQueryClient();
  
  return useMutation(createBrowserWorkflow, {
    onSuccess: () => {
      queryClient.invalidateQueries('browser-workflows');
    },
  });
};

export const useUpdateBrowserWorkflow = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    ({ workflowId, data }: { workflowId: string; data: Partial<CreateWorkflowRequest> }) => 
      updateBrowserWorkflow(workflowId, data),
    {
      onSuccess: (_, { workflowId }) => {
        queryClient.invalidateQueries('browser-workflows');
        queryClient.invalidateQueries(['browser-workflow', workflowId]);
      },
    }
  );
};

export const useDeleteBrowserWorkflow = () => {
  const queryClient = useQueryClient();
  
  return useMutation(deleteBrowserWorkflow, {
    onSuccess: () => {
      queryClient.invalidateQueries('browser-workflows');
    },
  });
};

export const useDuplicateBrowserWorkflow = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    ({ workflowId, newName }: { workflowId: string; newName?: string }) => 
      duplicateBrowserWorkflow(workflowId, newName),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('browser-workflows');
      },
    }
  );
};

export const useExecuteBrowserWorkflow = () => {
  const queryClient = useQueryClient();
  
  return useMutation(executeBrowserWorkflow, {
    onSuccess: () => {
      queryClient.invalidateQueries('browser-workflows');
      queryClient.invalidateQueries('browser-executions');
    },
  });
};

export const useExecutionHistory = (workflowId?: string) => {
  return useQuery(
    ['browser-executions', workflowId],
    () => fetchExecutionHistory(workflowId),
    {
      refetchInterval: 5000, // Refresh every 5 seconds for active executions
    }
  );
};

export const useExecutionResult = (executionId: string) => {
  return useQuery(
    ['browser-execution', executionId],
    () => fetchExecutionResult(executionId),
    {
      refetchInterval: 2000, // Refresh every 2 seconds for running executions
      enabled: !!executionId,
    }
  );
};

export const useStopWorkflowExecution = () => {
  const queryClient = useQueryClient();
  
  return useMutation(stopWorkflowExecution, {
    onSuccess: (_, executionId) => {
      queryClient.invalidateQueries(['browser-execution', executionId]);
      queryClient.invalidateQueries('browser-executions');
    },
  });
};

export const useBrowserAnalytics = (timeRange?: string) => {
  return useQuery(
    ['browser-analytics', timeRange],
    () => fetchBrowserAnalytics(timeRange),
    {
      refetchInterval: 60000, // Refresh every minute
    }
  );
};

// Utility functions
export const getWorkflowStatusColor = (status?: string) => {
  switch (status) {
    case 'completed':
      return 'success';
    case 'running':
      return 'warning';
    case 'failed':
      return 'error';
    case 'cancelled':
      return 'error';
    case 'pending':
      return 'info';
    default:
      return 'default';
  }
};

export const getSessionStatusColor = (status?: string) => {
  switch (status) {
    case 'active':
      return 'success';
    case 'inactive':
      return 'default';
    case 'error':
      return 'error';
    default:
      return 'default';
  }
};

export const getBrowserIcon = (browserType?: string) => {
  switch (browserType) {
    case 'chromium':
      return 'chrome';
    case 'firefox':
      return 'firefox';
    case 'webkit':
      return 'safari';
    default:
      return 'web';
  }
};

export const formatExecutionDuration = (durationMs?: number): string => {
  if (!durationMs) return 'N/A';
  
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  } else if (durationMs < 60000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  } else {
    return `${(durationMs / 60000).toFixed(1)}m`;
  }
};

export const getActionTypeLabel = (actionType?: string) => {
  switch (actionType) {
    case 'navigate':
      return 'Navigate to URL';
    case 'click':
      return 'Click Element';
    case 'fill':
      return 'Fill Form Field';
    case 'select':
      return 'Select Dropdown';
    case 'extract':
      return 'Extract Data';
    case 'wait':
      return 'Wait for Element';
    case 'screenshot':
      return 'Take Screenshot';
    case 'scroll':
      return 'Scroll Page';
    case 'hover':
      return 'Hover Element';
    case 'double_click':
      return 'Double Click';
    default:
      return actionType || 'Unknown';
  }
};

export const getActionTypeIcon = (actionType?: string) => {
  switch (actionType) {
    case 'navigate':
      return 'link';
    case 'click':
      return 'cursor';
    case 'fill':
      return 'edit';
    case 'select':
      return 'arrow_drop_down';
    case 'extract':
      return 'content_copy';
    case 'wait':
      return 'hourglass_empty';
    case 'screenshot':
      return 'photo_camera';
    case 'scroll':
      return 'swap_vert';
    case 'hover':
      return 'pan_tool';
    case 'double_click':
      return 'touch_app';
    default:
      return 'help';
  }
};

// Browser API service object
export const browserApi = {
  // Sessions
  fetchBrowserSessions,
  fetchBrowserSession,
  createBrowserSession,
  updateBrowserSession,
  deleteBrowserSession,
  startBrowserSession,
  stopBrowserSession,
  takeSessionScreenshot,
  
  // Workflows
  fetchBrowserWorkflows,
  fetchBrowserWorkflow,
  createBrowserWorkflow,
  updateBrowserWorkflow,
  deleteBrowserWorkflow,
  duplicateBrowserWorkflow,
  executeBrowserWorkflow,
  stopWorkflowExecution,
  
  // Executions
  fetchExecutionHistory,
  fetchExecutionResult,
  downloadExecutionReport,
  
  // Analytics
  fetchBrowserAnalytics,
};

export default browserApi;
