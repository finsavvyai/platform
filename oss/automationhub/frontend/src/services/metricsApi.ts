import { useQuery } from 'react-query';
import api from './api';

// Types
export interface SystemMetrics {
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  active_connections: number;
  uptime_seconds: number;
}

export interface DashboardStats {
  total_workflows: number;
  active_workflows: number;
  total_agents: number;
  active_agents: number;
  total_documents: number;
  total_executions_today: number;
  successful_executions_today: number;
  failed_executions_today: number;
  api_calls_today: number;
  api_calls_this_month: number;
}

export interface ActivityItem {
  id: string;
  type: 'workflow_execution' | 'agent_action' | 'document_upload' | 'user_action' | 'system_event';
  title: string;
  description: string;
  status: 'success' | 'error' | 'warning' | 'info';
  timestamp: string;
  user_id?: string;
  user_name?: string;
  resource_id?: string;
  resource_type?: string;
}

export interface UsageData {
  date: string;
  api_calls: number;
  workflow_executions: number;
  agent_actions: number;
  document_processing: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  service: string;
  version: string;
  checks: {
    database: { status: string; latency_ms?: number; error?: string };
    redis: { status: string; latency_ms?: number; error?: string };
    ai_services: { status: string; services: Record<string, string> };
  };
}

// API functions
export const fetchSystemMetrics = async (): Promise<SystemMetrics> => {
  try {
    const response = await api.get('/health/metrics');
    return {
      cpu_percent: response.data.cpu?.percent || 0,
      memory_percent: response.data.memory?.percent || 0,
      disk_percent: 0,
      active_connections: 0,
      uptime_seconds: 0,
    };
  } catch {
    // Return default metrics if endpoint not available
    return {
      cpu_percent: 0,
      memory_percent: 0,
      disk_percent: 0,
      active_connections: 0,
      uptime_seconds: 0,
    };
  }
};

export const fetchDashboardStats = async (): Promise<DashboardStats> => {
  try {
    // Try to fetch from analytics endpoint
    const response = await api.get('/analytics/dashboard');
    return response.data;
  } catch {
    // Fallback: aggregate from individual endpoints
    try {
      const [workflows, agents, documents] = await Promise.all([
        api.get('/workflows').catch(() => ({ data: [] })),
        api.get('/agents').catch(() => ({ data: [] })),
        api.get('/documents').catch(() => ({ data: [] })),
      ]);

      const workflowList = Array.isArray(workflows.data) ? workflows.data : [];
      const agentList = Array.isArray(agents.data) ? agents.data : [];
      const documentList = Array.isArray(documents.data) ? documents.data : [];

      return {
        total_workflows: workflowList.length,
        active_workflows: workflowList.filter((w: any) => w.status === 'active').length,
        total_agents: agentList.length,
        active_agents: agentList.filter((a: any) => a.status === 'active').length,
        total_documents: documentList.length,
        total_executions_today: 0,
        successful_executions_today: 0,
        failed_executions_today: 0,
        api_calls_today: 0,
        api_calls_this_month: 0,
      };
    } catch {
      return {
        total_workflows: 0,
        active_workflows: 0,
        total_agents: 0,
        active_agents: 0,
        total_documents: 0,
        total_executions_today: 0,
        successful_executions_today: 0,
        failed_executions_today: 0,
        api_calls_today: 0,
        api_calls_this_month: 0,
      };
    }
  }
};

export const fetchRecentActivity = async (limit: number = 10): Promise<ActivityItem[]> => {
  try {
    const response = await api.get('/analytics/activity', { params: { limit } });
    return response.data;
  } catch {
    // Return empty activity if endpoint not available
    return [];
  }
};

export const fetchUsageData = async (days: number = 30): Promise<UsageData[]> => {
  try {
    const response = await api.get('/analytics/usage', { params: { days } });
    return response.data;
  } catch {
    // Generate mock data for demonstration
    const data: UsageData[] = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      data.push({
        date: date.toISOString().split('T')[0],
        api_calls: Math.floor(Math.random() * 1000) + 100,
        workflow_executions: Math.floor(Math.random() * 50) + 5,
        agent_actions: Math.floor(Math.random() * 100) + 10,
        document_processing: Math.floor(Math.random() * 30) + 2,
      });
    }
    return data;
  }
};

export const fetchHealthStatus = async (): Promise<HealthStatus> => {
  try {
    const response = await api.get('/health/detailed');
    return response.data;
  } catch {
    return {
      status: 'unknown' as any,
      timestamp: new Date().toISOString(),
      service: 'UPM.Plus API',
      version: '1.0.0',
      checks: {
        database: { status: 'unknown' },
        redis: { status: 'unknown' },
        ai_services: { status: 'unknown', services: {} },
      },
    };
  }
};

// React Query hooks
export const useSystemMetrics = () => {
  return useQuery('systemMetrics', fetchSystemMetrics, {
    refetchInterval: 10000, // Refresh every 10 seconds
    staleTime: 5000,
  });
};

export const useDashboardStats = () => {
  return useQuery('dashboardStats', fetchDashboardStats, {
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000,
  });
};

export const useRecentActivity = (limit: number = 10) => {
  return useQuery(['recentActivity', limit], () => fetchRecentActivity(limit), {
    refetchInterval: 15000, // Refresh every 15 seconds
    staleTime: 10000,
  });
};

export const useUsageData = (days: number = 30) => {
  return useQuery(['usageData', days], () => fetchUsageData(days), {
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });
};

export const useHealthStatus = () => {
  return useQuery('healthStatus', fetchHealthStatus, {
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000,
  });
};

