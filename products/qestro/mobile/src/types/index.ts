export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'viewer' | 'developer' | 'tester' | 'manager';
  avatar?: string;
  preferences?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  tokens?: AuthTokens;
  user?: User;
}

export interface LoginForm {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignupForm {
  name: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  type: 'mobile' | 'web' | 'api';
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface TestCase {
  id: string;
  title: string;
  description?: string;
  status: 'active' | 'draft' | 'deprecated';
  priority: 'low' | 'medium' | 'high' | 'critical';
  type: 'manual' | 'automated';
  projectId: string;
  steps?: TestStep[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TestStep {
  id: string;
  order: number;
  action: string;
  expectedResult: string;
}

export interface TestPlan {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  projectId: string;
  testCaseIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TestCycle {
  id: string;
  name: string;
  status: 'planned' | 'in_progress' | 'completed';
  environment: string;
  projectId: string;
  testPlanId?: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRun {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled' | 'paused';
  projectId: string;
  testPlanId?: string;
  environment: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration?: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  pendingTests: number;
  passRate: number;
  totalRuns: number;
  activeRuns: number;
}

export interface Recording {
  id: string;
  name: string;
  url: string;
  status: 'active' | 'completed' | 'stopped';
  framework: string;
  viewport: string;
  interactionCount: number;
  duration?: number;
  code?: string;
  createdAt: string;
}

export interface Exploration {
  id: string;
  title: string;
  description?: string;
  status: 'active' | 'completed' | 'archived';
  projectId: string;
  findings?: ExplorationFinding[];
  createdAt: string;
  updatedAt: string;
}

export interface ExplorationFinding {
  id: string;
  type: 'bug' | 'observation' | 'improvement';
  title: string;
  description: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface Mission {
  id: string;
  type: 'TICKET' | 'SCOUT' | 'CONCIERGE';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export type { Integration, NotificationRule, BillingPlan, InsightsOverview, PaginatedResponse, Theme } from './platform';
