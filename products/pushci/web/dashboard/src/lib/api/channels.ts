import { apiFetch } from '../api-client';
import type {
  ChannelConnectionSummary,
  ChannelMessageRecord,
  ConnectChannelInput,
  ConnectChannelResponse,
} from './types';

export const channelsApi = {
  list: () =>
    apiFetch<{ connections: ChannelConnectionSummary[] }>('/api/channels'),
  connect: (input: ConnectChannelInput) =>
    apiFetch<ConnectChannelResponse>('/api/channels/connect', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  disconnect: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/channels/${id}`, { method: 'DELETE' }),
  test: (id: string) =>
    apiFetch<{ success: boolean; error?: string; detail?: string }>(
      `/api/channels/${id}/test`,
      { method: 'POST' },
    ),
  listMessages: (id: string) =>
    apiFetch<{ messages: ChannelMessageRecord[] }>(`/api/channels/${id}/messages`),
};
