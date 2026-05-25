import { apiFetch } from './client';
import type { ApiResponse, Recording } from '../../types';

export async function getRecordingSessions(): Promise<ApiResponse<Recording[]>> {
  return apiFetch('/api/recordings/openclaw/sessions');
}

export async function getActiveRecordings(): Promise<ApiResponse<Recording[]>> {
  return apiFetch('/api/recordings/openclaw/sessions/active');
}

export async function getRecording(id: string): Promise<ApiResponse<Recording>> {
  return apiFetch(`/api/recordings/openclaw/${id}`);
}

export async function getRecordingStats(): Promise<ApiResponse<unknown>> {
  return apiFetch('/api/recordings/openclaw/stats');
}

interface StartRecordingData {
  url: string;
  name: string;
  framework?: string;
  viewport?: string;
}

export async function startRecording(
  data: StartRecordingData,
): Promise<ApiResponse<Recording>> {
  return apiFetch('/api/recordings/openclaw/start', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function stopRecording(id: string): Promise<ApiResponse<Recording>> {
  return apiFetch(`/api/recordings/openclaw/${id}/stop`, { method: 'POST' });
}

export async function addInteraction(
  id: string,
  interaction: unknown,
): Promise<ApiResponse<void>> {
  return apiFetch(`/api/recordings/openclaw/${id}/interactions`, {
    method: 'POST',
    body: JSON.stringify(interaction),
  });
}
