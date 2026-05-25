/**
 * Voice Recognition — shared types
 */

export interface VoiceConfig {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
}

export interface VoiceTranscript {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  timestamp: Date;
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

export interface UseVoiceRecognitionReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  intents: VoiceIntent[];
  lastResult: VoiceCommandResult | null;
  error: Error | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  executeVoiceCommand: (transcript: string) => Promise<VoiceCommandResult>;
}
