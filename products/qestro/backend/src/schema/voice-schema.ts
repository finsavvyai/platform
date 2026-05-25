import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  unique,
  decimal,
} from "drizzle-orm/pg-core";

// ============================================================================
// Voice System Tables
// ============================================================================
//
// Foreign key references to tables in index.ts (users, projects,
// recordingSessions, testCases, recordedActions) are intentionally omitted
// to avoid circular imports. The columns retain correct types (uuid) and
// naming so Drizzle migrations and queries work correctly. Referential
// integrity is enforced at the database level via migrations.
// ============================================================================

// Voice recordings table - Store voice recording metadata and transcriptions
export const voiceRecordings = pgTable(
  "voice_recordings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(), // references users.id, onDelete: cascade
    projectId: uuid("project_id"), // references projects.id, onDelete: set null
    sessionId: uuid("session_id"), // references recordingSessions.id, onDelete: set null
    testCaseId: uuid("test_case_id"), // references testCases.id, onDelete: set null

    // Recording metadata
    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    fileSize: integer("file_size").notNull(), // bytes
    duration: integer("duration").notNull(), // milliseconds
    format: varchar("format", { length: 20 }).notNull(), // wav, mp3, m4a, etc.

    // Audio properties
    sampleRate: integer("sample_rate"),
    bitRate: integer("bit_rate"),
    channels: integer("channels"),

    // Transcription
    transcriptionText: text("transcription_text"),
    transcriptionProvider: varchar("transcription_provider", { length: 50 }), // openai, google, azure, aws
    transcriptionConfidence: decimal("transcription_confidence", {
      precision: 5,
      scale: 4,
    }),
    transcriptionLanguage: varchar("transcription_language", { length: 10 }),

    // Processing status
    processingStatus: varchar("processing_status", { length: 20 }).default(
      "pending",
    ), // pending, processing, completed, failed
    processingError: text("processing_error"),

    // Voice command detection
    containsCommands: boolean("contains_commands").default(false),
    detectedCommands: jsonb("detected_commands").default([]),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("voice_recordings_user_id_idx").on(table.userId),
    projectIdIdx: index("voice_recordings_project_id_idx").on(table.projectId),
    sessionIdIdx: index("voice_recordings_session_id_idx").on(table.sessionId),
    testCaseIdIdx: index("voice_recordings_test_case_id_idx").on(
      table.testCaseId,
    ),
    processingStatusIdx: index("voice_recordings_processing_status_idx").on(
      table.processingStatus,
    ),
    containsCommandsIdx: index("voice_recordings_contains_commands_idx").on(
      table.containsCommands,
    ),
  }),
);

// Voice commands table - Define available voice commands
export const voiceCommands = pgTable(
  "voice_commands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id"), // references users.id, onDelete: cascade — null for system commands

    // Command definition
    name: varchar("name", { length: 100 }).notNull(),
    trigger: varchar("trigger", { length: 255 }).notNull(), // voice phrase that triggers the command
    alternativeTriggers: jsonb("alternative_triggers").default([]), // alternative phrases

    // Command metadata
    category: varchar("category", { length: 50 }).notNull(), // recording, navigation, assertion, etc.
    description: text("description"),

    // Command action
    actionType: varchar("action_type", { length: 50 }).notNull(), // ui-action, test-step, system-command
    actionConfig: jsonb("action_config").notNull(), // configuration for the action

    // Parameters
    parameters: jsonb("parameters").default([]), // expected parameters and their types

    // Language and localization
    language: varchar("language", { length: 10 }).notNull().default("en"),

    // Status and usage
    isActive: boolean("is_active").default(true),
    isSystemCommand: boolean("is_system_command").default(false),
    usageCount: integer("usage_count").default(0),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("voice_commands_user_id_idx").on(table.userId),
    categoryIdx: index("voice_commands_category_idx").on(table.category),
    actionTypeIdx: index("voice_commands_action_type_idx").on(table.actionType),
    languageIdx: index("voice_commands_language_idx").on(table.language),
    isActiveIdx: index("voice_commands_is_active_idx").on(table.isActive),
    triggerIdx: index("voice_commands_trigger_idx").on(table.trigger),
  }),
);

// Voice command history table - Track voice command executions
export const voiceCommandHistory = pgTable(
  "voice_command_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(), // references users.id, onDelete: cascade
    commandId: uuid("command_id"), // references voiceCommands.id, onDelete: set null
    recordingId: uuid("recording_id"), // references voiceRecordings.id, onDelete: set null

    // Execution context
    projectId: uuid("project_id"), // references projects.id, onDelete: set null
    sessionId: uuid("session_id"), // references recordingSessions.id, onDelete: set null
    testCaseId: uuid("test_case_id"), // references testCases.id, onDelete: set null

    // Command execution
    recognizedText: text("recognized_text").notNull(),
    confidence: decimal("confidence", { precision: 5, scale: 4 }),
    parameters: jsonb("parameters").default({}),

    // Execution result
    executionStatus: varchar("execution_status", { length: 20 }).notNull(), // success, failed, partial
    executionResult: jsonb("execution_result"),
    executionError: text("execution_error"),
    executionDuration: integer("execution_duration"), // milliseconds

    // User feedback
    userFeedback: varchar("user_feedback", { length: 20 }), // correct, incorrect, partial
    correctedText: text("corrected_text"),

    executedAt: timestamp("executed_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("voice_command_history_user_id_idx").on(table.userId),
    commandIdIdx: index("voice_command_history_command_id_idx").on(
      table.commandId,
    ),
    recordingIdIdx: index("voice_command_history_recording_id_idx").on(
      table.recordingId,
    ),
    executionStatusIdx: index("voice_command_history_execution_status_idx").on(
      table.executionStatus,
    ),
    executedAtIdx: index("voice_command_history_executed_at_idx").on(
      table.executedAt,
    ),
    confidenceIdx: index("voice_command_history_confidence_idx").on(
      table.confidence,
    ),
  }),
);

// Voice annotations table - Associate voice recordings with test steps
export const voiceAnnotations = pgTable(
  "voice_annotations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recordingId: uuid("recording_id").notNull(), // references voiceRecordings.id, onDelete: cascade
    userId: uuid("user_id").notNull(), // references users.id, onDelete: cascade

    // Association with test elements
    testCaseId: uuid("test_case_id"), // references testCases.id, onDelete: cascade
    actionId: uuid("action_id"), // references recordedActions.id, onDelete: cascade

    // Annotation metadata
    annotationType: varchar("annotation_type", { length: 50 }).notNull(), // instruction, assertion, comment, explanation
    title: varchar("title", { length: 255 }),
    description: text("description"),

    // Timing within the recording
    startTime: integer("start_time"), // milliseconds from start of recording
    endTime: integer("end_time"), // milliseconds from start of recording

    // Annotation content
    transcribedText: text("transcribed_text"),
    interpretedAction: jsonb("interpreted_action"), // structured action derived from voice

    // Status
    isProcessed: boolean("is_processed").default(false),
    processingNotes: text("processing_notes"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    recordingIdIdx: index("voice_annotations_recording_id_idx").on(
      table.recordingId,
    ),
    userIdIdx: index("voice_annotations_user_id_idx").on(table.userId),
    testCaseIdIdx: index("voice_annotations_test_case_id_idx").on(
      table.testCaseId,
    ),
    actionIdIdx: index("voice_annotations_action_id_idx").on(table.actionId),
    annotationTypeIdx: index("voice_annotations_annotation_type_idx").on(
      table.annotationType,
    ),
    isProcessedIdx: index("voice_annotations_is_processed_idx").on(
      table.isProcessed,
    ),
  }),
);

// Voice preferences table - User voice settings and preferences
export const voicePreferences = pgTable(
  "voice_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique(), // references users.id, onDelete: cascade

    // Language and locale preferences
    primaryLanguage: varchar("primary_language", { length: 10 })
      .notNull()
      .default("en"),
    secondaryLanguages: jsonb("secondary_languages").default([]),

    // Voice recognition settings
    transcriptionProvider: varchar("transcription_provider", {
      length: 50,
    }).default("openai"), // openai, google, azure, aws
    confidenceThreshold: decimal("confidence_threshold", {
      precision: 3,
      scale: 2,
    }).default("0.80"),
    enableRealTimeTranscription: boolean(
      "enable_real_time_transcription",
    ).default(true),

    // Voice command settings
    enableVoiceCommands: boolean("enable_voice_commands").default(true),
    commandSensitivity: varchar("command_sensitivity", { length: 20 }).default(
      "medium",
    ), // low, medium, high
    enableCustomCommands: boolean("enable_custom_commands").default(true),

    // Audio settings
    audioQuality: varchar("audio_quality", { length: 20 }).default("high"), // low, medium, high
    noiseReduction: boolean("noise_reduction").default(true),
    autoGainControl: boolean("auto_gain_control").default(true),

    // Privacy settings
    storeRecordings: boolean("store_recordings").default(true),
    shareForImprovement: boolean("share_for_improvement").default(false),

    // Accessibility settings
    enableVoiceFeedback: boolean("enable_voice_feedback").default(false),
    voiceFeedbackLanguage: varchar("voice_feedback_language", {
      length: 10,
    }).default("en"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    primaryLanguageIdx: index("voice_preferences_primary_language_idx").on(
      table.primaryLanguage,
    ),
  }),
);

// Voice analytics table - Aggregate voice usage analytics
export const voiceAnalytics = pgTable(
  "voice_analytics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(), // references users.id, onDelete: cascade

    // Time bucket
    date: timestamp("date").notNull(), // date bucket (hour, day, week, month)
    granularity: varchar("granularity", { length: 10 }).notNull(), // hour, day, week, month

    // Recording metrics
    recordingCount: integer("recording_count").default(0),
    totalRecordingDuration: integer("total_recording_duration").default(0), // milliseconds
    avgRecordingDuration: integer("avg_recording_duration").default(0), // milliseconds

    // Transcription metrics
    transcriptionCount: integer("transcription_count").default(0),
    transcriptionSuccessCount: integer("transcription_success_count").default(
      0,
    ),
    avgTranscriptionConfidence: decimal("avg_transcription_confidence", {
      precision: 5,
      scale: 4,
    }),

    // Command metrics
    commandExecutionCount: integer("command_execution_count").default(0),
    commandSuccessCount: integer("command_success_count").default(0),
    avgCommandConfidence: decimal("avg_command_confidence", {
      precision: 5,
      scale: 4,
    }),

    // Language distribution
    languageDistribution: jsonb("language_distribution").default({}), // language -> count mapping

    // Provider usage
    providerUsage: jsonb("provider_usage").default({}), // provider -> count mapping

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdDateIdx: unique("voice_analytics_user_date_granularity_unique").on(
      table.userId,
      table.date,
      table.granularity,
    ),
    dateIdx: index("voice_analytics_date_idx").on(table.date),
    granularityIdx: index("voice_analytics_granularity_idx").on(
      table.granularity,
    ),
  }),
);
