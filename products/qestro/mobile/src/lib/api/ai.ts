import { apiFetch } from './client';
import type { ApiResponse } from '../../types';

export async function generateTest(data: {
  description: string;
  framework?: string;
  type?: string;
}): Promise<ApiResponse<{ code: string }>> {
  return apiFetch('/api/ai/generate-test', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function startConversation(data: {
  projectId?: string;
  context?: string;
}): Promise<ApiResponse<{ conversationId: string; question: string }>> {
  return apiFetch('/api/testgen/conversations/start', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function answerQuestion(
  conversationId: string,
  answer: string,
): Promise<ApiResponse<{ question?: string; code?: string; done: boolean }>> {
  return apiFetch(`/api/testgen/conversations/${conversationId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ answer }),
  });
}

export async function approveConversation(
  conversationId: string,
): Promise<ApiResponse<void>> {
  return apiFetch(`/api/testgen/conversations/${conversationId}/approve`, {
    method: 'POST',
  });
}

export async function cancelConversation(
  conversationId: string,
): Promise<ApiResponse<void>> {
  return apiFetch(`/api/testgen/conversations/${conversationId}/cancel`, {
    method: 'POST',
  });
}

export async function getConversations(): Promise<ApiResponse<unknown[]>> {
  return apiFetch('/api/testgen/conversations');
}

export async function getConversation(
  id: string,
): Promise<ApiResponse<unknown>> {
  return apiFetch(`/api/testgen/conversations/${id}`);
}

export async function getConversationCode(
  id: string,
): Promise<ApiResponse<{ code: string }>> {
  return apiFetch(`/api/testgen/conversations/${id}/code`);
}

export async function sendOpenClawCommand(
  data: unknown,
): Promise<ApiResponse<unknown>> {
  return apiFetch('/api/openclaw/incoming', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getOpenClawStatus(): Promise<ApiResponse<unknown>> {
  return apiFetch('/api/openclaw/status');
}
