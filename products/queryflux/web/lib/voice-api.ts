/**
 * Voice Recognition API
 *
 * API methods for voice recognition and command processing
 */

import apiClient from './enhanced-api-client';

// ============================================================================
// Types
// ============================================================================

export interface VoiceSession {
  sessionId: string;
  userId: string;
  language: string;
  startTime: string;
  lastActivity: string;
}

export interface VoiceTranscriptRequest {
  sessionId: string;
  transcript: string;
  language: string;
}

export interface VoiceIntent {
  intent: string;
  confidence: number;
  entities: Record<string, string>;
  context: Record<string, unknown>;
  timestamp: string;
  requiresConfirmation: boolean;
}

export interface VoiceCommandResult {
  intent: VoiceIntent;
  response: string;
  data?: unknown;
  success: boolean;
  error?: string;
  executionTime: number;
}

export interface VoiceCommand {
  name: string;
  description: string;
  triggers: string[];
  parameters: VoiceCommandParameter[];
  category: string;
}

export interface VoiceCommandParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  examples: string[];
}

// ============================================================================
// Voice API Client
// ============================================================================

export const voiceAPI = {
  /**
   * Start a new voice recognition session
   */
  startSession: async (request: { language: string }): Promise<VoiceSession> => {
    const response = await apiClient.request<VoiceSession>('POST', '/api/v1/voice/session/start', request);
    return response;
  },

  /**
   * Process a voice transcript
   */
  processTranscript: async (request: VoiceTranscriptRequest): Promise<VoiceCommandResult> => {
    const response = await apiClient.request<VoiceCommandResult>(
      'POST',
      '/api/v1/voice/transcript',
      request
    );
    return response;
  },

  /**
   * End a voice recognition session
   */
  endSession: async (request: { sessionId: string }): Promise<void> => {
    await apiClient.request<void>('POST', '/api/v1/voice/session/end', request);
  },

  /**
   * Get active voice session
   */
  getSession: async (sessionId: string): Promise<VoiceSession> => {
    const response = await apiClient.request<VoiceSession>(
      'GET',
      `/api/v1/voice/session/${sessionId}`
    );
    return response;
  },

  /**
   * Register a custom voice command
   */
  registerCommand: async (command: Omit<VoiceCommand, 'name'>): Promise<VoiceCommand> => {
    const response = await apiClient.request<VoiceCommand>(
      'POST',
      '/api/v1/voice/commands',
      command
    );
    return response;
  },

  /**
   * List available voice commands
   */
  listCommands: async (): Promise<VoiceCommand[]> => {
    const response = await apiClient.request<VoiceCommand[]>('GET', '/api/v1/voice/commands');
    return response;
  },

  /**
   * Unregister a voice command
   */
  unregisterCommand: async (commandName: string): Promise<void> => {
    await apiClient.request<void>('DELETE', `/api/v1/voice/commands/${commandName}`);
  },
};

// Extend EnhancedAPIClient with voice property
declare module './enhanced-api-client' {
  interface EnhancedAPIClient {
    voice: typeof voiceAPI;
  }
}

// Add voice property to apiClient instance
(apiClient as any).voice = voiceAPI;

export default voiceAPI;
