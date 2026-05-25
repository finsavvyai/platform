import {
  sqliteTable,
  text,
  integer,
  real
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { coreSchema } from './core-schema.js';

// Voice recordings table - Store voice recording metadata and transcriptions (SQLite version)
export const voiceRecordings = sqliteTable('voice_recordings', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => coreSchema.projects.id, { onDelete: 'set null' }),
  sessionId: text('session_id').references(() => coreSchema.recordingSessions.id, { onDelete: 'set null' }),
  testCaseId: text('test_case_id').references(() => coreSchema.testCases.id, { onDelete: 'set null' }),

  // Recording metadata
  fileName: text('file_name').notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size').notNull(), // bytes
  duration: integer('duration').notNull(), // milliseconds
  format: text('format').notNull(), // wav, mp3, m4a, etc.

  // Audio properties
  sampleRate: integer('sample_rate'),
  bitRate: integer('bit_rate'),
  channels: integer('channels'),

  // Transcription
  transcriptionText: text('transcription_text'),
  transcriptionProvider: text('transcription_provider'), // openai, google, azure, aws
  transcriptionConfidence: real('transcription_confidence'),
  transcriptionLanguage: text('transcription_language'),

  // Processing status
  processingStatus: text('processing_status').default('pending'), // pending, processing, completed, failed
  processingError: text('processing_error'),

  // Voice command detection
  containsCommands: integer('contains_commands', { mode: 'boolean' }).default(false),
  detectedCommands: text('detected_commands', { mode: 'json' }).$defaultFn(() => '[]'),

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  userIdIdx: sql`CREATE INDEX voice_recordings_user_id_idx ON ${table.name} (user_id)`,
  projectIdIdx: sql`CREATE INDEX voice_recordings_project_id_idx ON ${table.name} (project_id)`,
  sessionIdIdx: sql`CREATE INDEX voice_recordings_session_id_idx ON ${table.name} (session_id)`,
  testCaseIdIdx: sql`CREATE INDEX voice_recordings_test_case_id_idx ON ${table.name} (test_case_id)`,
  processingStatusIdx: sql`CREATE INDEX voice_recordings_processing_status_idx ON ${table.name} (processing_status)`,
  containsCommandsIdx: sql`CREATE INDEX voice_recordings_contains_commands_idx ON ${table.name} (contains_commands)`,
}));

// Voice commands table - Define available voice commands (SQLite version)
export const voiceCommands = sqliteTable('voice_commands', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => coreSchema.users.id, { onDelete: 'cascade' }), // null for system commands

  // Command definition
  name: text('name').notNull(),
  trigger: text('trigger').notNull(), // voice phrase that triggers the command
  alternativeTriggers: text('alternative_triggers', { mode: 'json' }).$defaultFn(() => '[]'), // alternative phrases

  // Command metadata
  category: text('category').notNull(), // recording, navigation, assertion, etc.
  description: text('description'),

  // Command action
  actionType: text('action_type').notNull(), // ui-action, test-step, system-command
  actionConfig: text('action_config', { mode: 'json' }).notNull(), // configuration for the action

  // Parameters
  parameters: text('parameters', { mode: 'json' }).$defaultFn(() => '[]'), // expected parameters and their types

  // Language and localization
  language: text('language').notNull().default('en'),

  // Status and usage
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  isSystemCommand: integer('is_system_command', { mode: 'boolean' }).default(false),
  usageCount: integer('usage_count').default(0),

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  userIdIdx: sql`CREATE INDEX voice_commands_user_id_idx ON ${table.name} (user_id)`,
  categoryIdx: sql`CREATE INDEX voice_commands_category_idx ON ${table.name} (category)`,
  actionTypeIdx: sql`CREATE INDEX voice_commands_action_type_idx ON ${table.name} (action_type)`,
  languageIdx: sql`CREATE INDEX voice_commands_language_idx ON ${table.name} (language)`,
  isActiveIdx: sql`CREATE INDEX voice_commands_is_active_idx ON ${table.name} (is_active)`,
  triggerIdx: sql`CREATE INDEX voice_commands_trigger_idx ON ${table.name} (trigger)`,
}));

// Voice command history table - Track voice command executions (SQLite version)
export const voiceCommandHistory = sqliteTable('voice_command_history', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
  commandId: text('command_id').references(() => voiceCommands.id, { onDelete: 'set null' }),
  recordingId: text('recording_id').references(() => voiceRecordings.id, { onDelete: 'set null' }),

  // Execution context
  projectId: text('project_id').references(() => coreSchema.projects.id, { onDelete: 'set null' }),
  sessionId: text('session_id').references(() => coreSchema.recordingSessions.id, { onDelete: 'set null' }),
  testCaseId: text('test_case_id').references(() => coreSchema.testCases.id, { onDelete: 'set null' }),

  // Command execution
  recognizedText: text('recognized_text').notNull(),
  confidence: real('confidence'),
  parameters: text('parameters', { mode: 'json' }).$defaultFn(() => '{}'),

  // Execution result
  executionStatus: text('execution_status').notNull(), // success, failed, partial
  executionResult: text('execution_result', { mode: 'json' }),
  executionError: text('execution_error'),
  executionDuration: integer('execution_duration'), // milliseconds

  // User feedback
  userFeedback: text('user_feedback'), // correct, incorrect, partial
  correctedText: text('corrected_text'),

  executedAt: integer('executed_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  userIdIdx: sql`CREATE INDEX voice_command_history_user_id_idx ON ${table.name} (user_id)`,
  commandIdIdx: sql`CREATE INDEX voice_command_history_command_id_idx ON ${table.name} (command_id)`,
  recordingIdIdx: sql`CREATE INDEX voice_command_history_recording_id_idx ON ${table.name} (recording_id)`,
  executionStatusIdx: sql`CREATE INDEX voice_command_history_execution_status_idx ON ${table.name} (execution_status)`,
  executedAtIdx: sql`CREATE INDEX voice_command_history_executed_at_idx ON ${table.name} (executed_at)`,
  confidenceIdx: sql`CREATE INDEX voice_command_history_confidence_idx ON ${table.name} (confidence)`,
}));

// Voice annotations table - Associate voice recordings with test steps (SQLite version)
export const voiceAnnotations = sqliteTable('voice_annotations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  recordingId: text('recording_id').notNull().references(() => voiceRecordings.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),

  // Association with test elements
  testCaseId: text('test_case_id').references(() => coreSchema.testCases.id, { onDelete: 'cascade' }),
  actionId: text('action_id').references(() => coreSchema.recordedActions.id, { onDelete: 'cascade' }),

  // Annotation metadata
  annotationType: text('annotation_type').notNull(), // instruction, assertion, comment, explanation
  title: text('title'),
  description: text('description'),

  // Timing within the recording
  startTime: integer('start_time'), // milliseconds from start of recording
  endTime: integer('end_time'), // milliseconds from start of recording

  // Annotation content
  transcribedText: text('transcribed_text'),
  interpretedAction: text('interpreted_action', { mode: 'json' }), // structured action derived from voice

  // Status
  isProcessed: integer('is_processed', { mode: 'boolean' }).default(false),
  processingNotes: text('processing_notes'),

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  recordingIdIdx: sql`CREATE INDEX voice_annotations_recording_id_idx ON ${table.name} (recording_id)`,
  userIdIdx: sql`CREATE INDEX voice_annotations_user_id_idx ON ${table.name} (user_id)`,
  testCaseIdIdx: sql`CREATE INDEX voice_annotations_test_case_id_idx ON ${table.name} (test_case_id)`,
  actionIdIdx: sql`CREATE INDEX voice_annotations_action_id_idx ON ${table.name} (action_id)`,
  annotationTypeIdx: sql`CREATE INDEX voice_annotations_annotation_type_idx ON ${table.name} (annotation_type)`,
  isProcessedIdx: sql`CREATE INDEX voice_annotations_is_processed_idx ON ${table.name} (is_processed)`,
}));

// Voice preferences table - User voice settings and preferences (SQLite version)
export const voicePreferences = sqliteTable('voice_preferences', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }).unique(),

  // Language and locale preferences
  primaryLanguage: text('primary_language').notNull().default('en'),
  secondaryLanguages: text('secondary_languages', { mode: 'json' }).$defaultFn(() => '[]'),

  // Voice recognition settings
  transcriptionProvider: text('transcription_provider').default('openai'), // openai, google, azure, aws
  confidenceThreshold: real('confidence_threshold').default(0.80),
  enableRealTimeTranscription: integer('enable_real_time_transcription', { mode: 'boolean' }).default(true),

  // Voice command settings
  enableVoiceCommands: integer('enable_voice_commands', { mode: 'boolean' }).default(true),
  commandSensitivity: text('command_sensitivity').default('medium'), // low, medium, high
  enableCustomCommands: integer('enable_custom_commands', { mode: 'boolean' }).default(true),

  // Audio settings
  audioQuality: text('audio_quality').default('high'), // low, medium, high
  noiseReduction: integer('noise_reduction', { mode: 'boolean' }).default(true),
  autoGainControl: integer('auto_gain_control', { mode: 'boolean' }).default(true),

  // Privacy settings
  storeRecordings: integer('store_recordings', { mode: 'boolean' }).default(true),
  shareForImprovement: integer('share_for_improvement', { mode: 'boolean' }).default(false),

  // Accessibility settings
  enableVoiceFeedback: integer('enable_voice_feedback', { mode: 'boolean' }).default(false),
  voiceFeedbackLanguage: text('voice_feedback_language').default('en'),

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  primaryLanguageIdx: sql`CREATE INDEX voice_preferences_primary_language_idx ON ${table.name} (primary_language)`,
}));

// Voice analytics table - Aggregate voice usage analytics (SQLite version)
export const voiceAnalytics = sqliteTable('voice_analytics', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),

  // Time bucket
  date: integer('date', { mode: 'timestamp' }).notNull(), // date bucket (hour, day, week, month)
  granularity: text('granularity').notNull(), // hour, day, week, month

  // Recording metrics
  recordingCount: integer('recording_count').default(0),
  totalRecordingDuration: integer('total_recording_duration').default(0), // milliseconds
  avgRecordingDuration: integer('avg_recording_duration').default(0), // milliseconds

  // Transcription metrics
  transcriptionCount: integer('transcription_count').default(0),
  transcriptionSuccessCount: integer('transcription_success_count').default(0),
  avgTranscriptionConfidence: real('avg_transcription_confidence'),

  // Command metrics
  commandExecutionCount: integer('command_execution_count').default(0),
  commandSuccessCount: integer('command_success_count').default(0),
  avgCommandConfidence: real('avg_command_confidence'),

  // Language distribution
  languageDistribution: text('language_distribution', { mode: 'json' }).$defaultFn(() => '{}'), // language -> count mapping

  // Provider usage
  providerUsage: text('provider_usage', { mode: 'json' }).$defaultFn(() => '{}'), // provider -> count mapping

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  userIdDateIdx: sql`CREATE UNIQUE INDEX voice_analytics_user_date_granularity_unique ON ${table.name} (user_id, date, granularity)`,
  dateIdx: sql`CREATE INDEX voice_analytics_date_idx ON ${table.name} (date)`,
  granularityIdx: sql`CREATE INDEX voice_analytics_granularity_idx ON ${table.name} (granularity)`,
}));

// Voice system schema export
export const voiceSystemSchema = {
  voiceRecordings,
  voiceCommands,
  voiceCommandHistory,
  voiceAnnotations,
  voicePreferences,
  voiceAnalytics,
};

export default voiceSystemSchema;
