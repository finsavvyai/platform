/**
 * Test fixtures for LunaOS Mobile tests.
 * Sample agents, users, auth tokens, and execution results.
 */

import type {
  AgentListItem,
  AgentListResponse,
  AuthUser,
  AuthResponse,
  Execution,
  ExecutionsResponse,
  ExecuteParams,
} from '../../types/api';

// --- Auth fixtures ---

export const mockUser: AuthUser = {
  id: 'user-001',
  email: 'test@lunaos.ai',
  name: 'Test User',
  tier: 'pro',
};

export const mockFreeUser: AuthUser = {
  id: 'user-002',
  email: 'free@lunaos.ai',
  name: 'Free User',
  tier: 'free',
};

export const mockAuthToken = 'mock-jwt-token-for-tests';

export const mockAuthResponse: AuthResponse = {
  token: mockAuthToken,
  user: mockUser,
};

export const mockSignupResponse: AuthResponse = {
  token: 'mock-jwt-token-signup',
  user: { id: 'user-new', email: 'new@lunaos.ai', name: 'New User', tier: 'free' },
};

// --- Agent fixtures ---

export const mockAgents: AgentListItem[] = [
  { slug: 'code-reviewer', name: 'Code Reviewer', category: 'code-quality', tier: 'free', hasSystemPrompt: true },
  { slug: 'debug-helper', name: 'Debug Helper', category: 'devops', tier: 'pro', hasSystemPrompt: true },
  { slug: 'api-designer', name: 'API Designer', category: 'solution', tier: 'pro', hasSystemPrompt: true },
  { slug: 'test-writer', name: 'Test Writer', category: 'testing', tier: 'free', hasSystemPrompt: false },
  { slug: 'sprint-planner', name: 'Sprint Planner', category: 'planning', tier: 'pro', hasSystemPrompt: true },
];

export const mockAgentListResponse: AgentListResponse = {
  agents: mockAgents,
  total: mockAgents.length,
  free: mockAgents.filter((a) => a.tier === 'free').length,
  pro: mockAgents.filter((a) => a.tier === 'pro').length,
};

// --- Execution fixtures ---

export const mockExecuteParams: ExecuteParams = {
  agent: 'code-reviewer',
  context: 'Review this function for bugs',
};

export const mockExecution: Execution = {
  id: 'exec-001',
  agent: 'code-reviewer',
  provider: 'deepseek',
  model: 'deepseek-chat',
  duration_ms: 2500,
  output_length: 1024,
  created_at: '2026-03-29T10:00:00Z',
};

export const mockExecutions: Execution[] = [
  mockExecution,
  {
    id: 'exec-002',
    agent: 'debug-helper',
    provider: 'anthropic',
    model: 'claude-3.5-sonnet',
    duration_ms: 4200,
    output_length: 2048,
    created_at: '2026-03-28T14:30:00Z',
  },
  {
    id: 'exec-003',
    agent: 'api-designer',
    provider: 'openai',
    model: 'gpt-4o',
    duration_ms: 1800,
    output_length: 512,
    created_at: '2026-03-27T09:15:00Z',
  },
];

export const mockExecutionsResponse: ExecutionsResponse = {
  executions: mockExecutions,
  count: mockExecutions.length,
};

// --- Login/signup form data ---

export const validLoginCredentials = {
  email: 'test@lunaos.ai',
  password: 'Test1234!',
};

export const validSignupData = {
  name: 'New User',
  email: 'new@lunaos.ai',
  password: 'NewPass123!',
};
