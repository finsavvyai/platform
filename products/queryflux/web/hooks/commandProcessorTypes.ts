/**
 * Voice Command Processor — shared types
 */

export type { VoiceIntent, VoiceCommandResult } from './useVoiceRecognition';

export interface ProcessedCommand {
  intent: import('./useVoiceRecognition').VoiceIntent;
  validated: boolean;
  validationErrors: string[];
  context: CommandContext;
  requiresConfirmation: boolean;
  estimatedCost: number;
  estimatedTime: number;
}

export interface CommandContext {
  sessionId: string;
  userId: string;
  currentConnection: string | null;
  lastCommands: import('./useVoiceRecognition').VoiceIntent[];
  variables: Record<string, unknown>;
  preferences: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface CommandSuggestion {
  name: string;
  description: string;
  triggers: string[];
  category: string;
}

export interface CommandHistoryEntry {
  intent: import('./useVoiceRecognition').VoiceIntent;
  result: import('./useVoiceRecognition').VoiceCommandResult;
  timestamp: string;
  executionTime: number;
  userId: string;
  sessionId: string;
}

export interface UseCommandProcessorReturn {
  processCommand: (sessionId: string, intent: import('./useVoiceRecognition').VoiceIntent) => Promise<ProcessedCommand>;
  executeCommand: (processed: ProcessedCommand) => Promise<import('./useVoiceRecognition').VoiceCommandResult>;
  context: CommandContext | null;
  updateContext: (sessionId: string, updates: Partial<CommandContext>) => Promise<void>;
  suggestions: CommandSuggestion[];
  getSuggestions: (sessionId: string) => Promise<CommandSuggestion[]>;
  history: CommandHistoryEntry[];
  getHistory: (sessionId: string, limit?: number) => Promise<CommandHistoryEntry[]>;
  isProcessing: boolean;
  isExecuting: boolean;
  error: Error | null;
}
