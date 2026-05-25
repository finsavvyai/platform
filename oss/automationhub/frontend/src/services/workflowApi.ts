import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';

// API base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

// Types
export interface Workflow {
  id: string;
  name: string;
  description: string;
  definition: any;
  status: 'active' | 'inactive' | 'running' | 'completed' | 'failed';
  owner_id: string;
  created_at: string;
  updated_at: string;
  execution_count?: number;
  last_execution?: string;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error_message?: string;
  started_at: string;
  completed_at?: string;
  duration?: number;
}

export interface CreateWorkflowRequest {
  name: string;
  description: string;
  definition: any;
}

export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  definition?: any;
  status?: 'active' | 'inactive';
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

// Workflow API calls
export const fetchWorkflows = async (): Promise<Workflow[]> => {
  const response = await api.get('/workflows');
  return response.data;
};

export const fetchWorkflow = async (id: string): Promise<Workflow> => {
  const response = await api.get(`/workflows/${id}`);
  return response.data;
};

export const createWorkflow = async (data: CreateWorkflowRequest): Promise<Workflow> => {
  const response = await api.post('/workflows', data);
  return response.data;
};

export const updateWorkflow = async (id: string, data: UpdateWorkflowRequest): Promise<Workflow> => {
  const response = await api.put(`/workflows/${id}`, data);
  return response.data;
};

export const deleteWorkflow = async (id: string): Promise<void> => {
  await api.delete(`/workflows/${id}`);
};

export const executeWorkflow = async (id: string): Promise<WorkflowExecution> => {
  const response = await api.post(`/workflows/${id}/execute`);
  return response.data;
};

export const fetchWorkflowExecutions = async (workflowId?: string): Promise<WorkflowExecution[]> => {
  const url = workflowId ? `/workflows/${workflowId}/executions` : '/workflow-executions';
  const response = await api.get(url);
  return response.data;
};

export const fetchWorkflowExecution = async (id: string): Promise<WorkflowExecution> => {
  const response = await api.get(`/workflow-executions/${id}`);
  return response.data;
};

export const stopWorkflowExecution = async (id: string): Promise<void> => {
  await api.post(`/workflow-executions/${id}/stop`);
};

// React Query hooks
export const useWorkflows = () => {
  return useQuery('workflows', fetchWorkflows, {
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000,
  });
};

export const useWorkflow = (id: string) => {
  return useQuery(['workflow', id], () => fetchWorkflow(id), {
    enabled: !!id,
  });
};

export const useCreateWorkflow = () => {
  const queryClient = useQueryClient();
  
  return useMutation(createWorkflow, {
    onSuccess: () => {
      queryClient.invalidateQueries('workflows');
    },
  });
};

export const useUpdateWorkflow = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    ({ id, data }: { id: string; data: UpdateWorkflowRequest }) => 
      updateWorkflow(id, data),
    {
      onSuccess: (_, { id }) => {
        queryClient.invalidateQueries('workflows');
        queryClient.invalidateQueries(['workflow', id]);
      },
    }
  );
};

export const useDeleteWorkflow = () => {
  const queryClient = useQueryClient();
  
  return useMutation(deleteWorkflow, {
    onSuccess: () => {
      queryClient.invalidateQueries('workflows');
    },
  });
};

export const useExecuteWorkflow = () => {
  const queryClient = useQueryClient();
  
  return useMutation(executeWorkflow, {
    onSuccess: () => {
      queryClient.invalidateQueries('workflows');
      queryClient.invalidateQueries('workflow-executions');
    },
  });
};

export const useWorkflowExecutions = (workflowId?: string) => {
  return useQuery(
    ['workflow-executions', workflowId],
    () => fetchWorkflowExecutions(workflowId),
    {
      refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
      enabled: true,
    }
  );
};

export const useWorkflowExecution = (id: string) => {
  return useQuery(
    ['workflow-execution', id],
    () => fetchWorkflowExecution(id),
    {
      refetchInterval: 2000, // Refresh every 2 seconds for active executions
      enabled: !!id,
    }
  );
};

export const useStopWorkflowExecution = () => {
  const queryClient = useQueryClient();
  
  return useMutation(stopWorkflowExecution, {
    onSuccess: (_, id) => {
      queryClient.invalidateQueries(['workflow-execution', id]);
      queryClient.invalidateQueries('workflow-executions');
    },
  });
};

// Utility functions
export const getWorkflowStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'success';
    case 'inactive':
      return 'default';
    case 'running':
      return 'warning';
    case 'completed':
      return 'primary';
    case 'failed':
      return 'error';
    default:
      return 'default';
  }
};

export const getExecutionStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'info';
    case 'running':
      return 'warning';
    case 'completed':
      return 'success';
    case 'failed':
      return 'error';
    default:
      return 'default';
  }
};

export const formatDuration = (duration: number): string => {
  if (duration < 1000) {
    return `${duration}ms`;
  } else if (duration < 60000) {
    return `${(duration / 1000).toFixed(1)}s`;
  } else {
    return `${(duration / 60000).toFixed(1)}m`;
  }
};

export const calculateDuration = (startedAt: string, completedAt?: string): number => {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  return end - start;
};

export default api;
