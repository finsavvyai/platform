import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { 
  voiceRecordings,
  voiceCommands,
  voiceCommandHistory,
  voiceAnnotations,
  voicePreferences,
  voiceAnalytics,
  users,
  projects,
  recordingSessions,
  testCases,
  recordedActions
} from '../../../../backend/src/schema/index.js';
import { eq } from 'drizzle-orm';

describe('Voice System Database Models', () => {
  let db: any;
  let client: any;
  let testUser: any;
  let testProject: any;
  let testSession: any;
  let testCase: any;

  beforeAll(async () => {
    // Use test database
    const connectionString = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/qestro_test';
    client = postgres(connectionString);
    db = drizzle(client);
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    // Clean up test data
    await db.delete(voiceAnalytics);
    await db.delete(voiceAnnotations);
    await db.delete(voiceCommandHistory);
    await db.delete(voiceRecordings);
    await db.delete(voiceCommands);
    await db.delete(voicePreferences);
    await db.delete(recordedActions);
    await db.delete(testCases);
    await db.delete(recordingSessions);
    await db.delete(projects);
    await db.delete(users);

    // Create test user
    const [user] = await db.insert(users).values({
      email: 'test@example.com',
      password: 'hashedpassword',
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      isEmailVerified: true,
    }).returning();
    testUser = user;

    // Create test project
    const [project] = await db.insert(projects).values({
      userId: testUser.id,
      name: 'Test Project',
      type: 'web',
      platform: 'chrome',
    }).returning();
    testProject = project;

    // Create test recording session
    const [session] = await db.insert(recordingSessions).values({
      projectId: testProject.id,
      userId: testUser.id,
      name: 'Test Session',
      type: 'web',
      platform: 'chrome',
      status: 'completed',
    }).returning();
    testSession = session;

    // Create test case
    const [testCaseRecord] = await db.insert(testCases).values({
      projectId: testProject.id,
      sessionId: testSession.id,
      userId: testUser.id,
      name: 'Test Case',
      type: 'web',
      testData: { steps: [] },
    }).returning();
    testCase = testCaseRecord;
  });

  describe('Voice Recordings Table', () => {
    it('should create voice recordings with all metadata', async () => {
      const [recording] = await db.insert(voiceRecordings).values({
        userId: testUser.id,
        projectId: testProject.id,
        sessionId: testSession.id,
        testCaseId: testCase.id,
        fileName: 'test-recording.wav',
        filePath: '/uploads/voice/test-recording.wav',
        fileSize: 1024000,
        duration: 30000, // 30 seconds
        format: 'wav',
        sampleRate: 44100,
        bitRate: 128000,
        channels: 1,
        transcriptionText: 'Click on the login button and enter username',
        transcriptionProvider: 'openai',
        transcriptionConfidence: '0.95',
        transcriptionLanguage: 'en',
        processingStatus: 'completed',
        containsCommands: true,
        detectedCommands: [
          { command: 'click', confidence: 0.98, timestamp: 5000 },
          { command: 'type', confidence: 0.92, timestamp: 15000 }
        ],
      }).returning();

      expect(recording).toBeDefined();
      expect(recording.userId).toBe(testUser.id);
      expect(recording.projectId).toBe(testProject.id);
      expect(recording.sessionId).toBe(testSession.id);
      expect(recording.testCaseId).toBe(testCase.id);
      expect(recording.fileName).toBe('test-recording.wav');
      expect(recording.filePath).toBe('/uploads/voice/test-recording.wav');
      expect(recording.fileSize).toBe(1024000);
      expect(recording.duration).toBe(30000);
      expect(recording.format).toBe('wav');
      expect(recording.sampleRate).toBe(44100);
      expect(recording.bitRate).toBe(128000);
      expect(recording.channels).toBe(1);
      expect(recording.transcriptionText).toBe('Click on the login button and enter username');
      expect(recording.transcriptionProvider).toBe('openai');
      expect(recording.transcriptionConfidence).toBe('0.95');
      expect(recording.transcriptionLanguage).toBe('en');
      expect(recording.processingStatus).toBe('completed');
      expect(recording.containsCommands).toBe(true);
      expect(recording.detectedCommands).toEqual([
        { command: 'click', confidence: 0.98, timestamp: 5000 },
        { command: 'type', confidence: 0.92, timestamp: 15000 }
      ]);
    });

    it('should handle recordings without transcription', async () => {
      const [recording] = await db.insert(voiceRecordings).values({
        userId: testUser.id,
        fileName: 'untranscribed.wav',
        filePath: '/uploads/voice/untranscribed.wav',
        fileSize: 512000,
        duration: 15000,
        format: 'wav',
        processingStatus: 'pending',
      }).returning();

      expect(recording.processingStatus).toBe('pending');
      expect(recording.transcriptionText).toBeNull();
      expect(recording.transcriptionProvider).toBeNull();
      expect(recording.containsCommands).toBe(false); // default value
    });

    it('should handle processing errors', async () => {
      const [recording] = await db.insert(voiceRecordings).values({
        userId: testUser.id,
        fileName: 'error-recording.wav',
        filePath: '/uploads/voice/error-recording.wav',
        fileSize: 256000,
        duration: 10000,
        format: 'wav',
        processingStatus: 'failed',
        processingError: 'Transcription service unavailable',
      }).returning();

      expect(recording.processingStatus).toBe('failed');
      expect(recording.processingError).toBe('Transcription service unavailable');
    });
  });

  describe('Voice Commands Table', () => {
    it('should create system voice commands', async () => {
      const [command] = await db.insert(voiceCommands).values({
        name: 'Click Element',
        trigger: 'click',
        alternativeTriggers: ['tap', 'press'],
        category: 'interaction',
        description: 'Click on an element',
        actionType: 'ui-action',
        actionConfig: { action: 'click' },
        parameters: [{ name: 'element', type: 'string', required: true }],
        language: 'en',
        isSystemCommand: true,
      }).returning();

      expect(command).toBeDefined();
      expect(command.name).toBe('Click Element');
      expect(command.trigger).toBe('click');
      expect(command.alternativeTriggers).toEqual(['tap', 'press']);
      expect(command.category).toBe('interaction');
      expect(command.description).toBe('Click on an element');
      expect(command.actionType).toBe('ui-action');
      expect(command.actionConfig).toEqual({ action: 'click' });
      expect(command.parameters).toEqual([{ name: 'element', type: 'string', required: true }]);
      expect(command.language).toBe('en');
      expect(command.isSystemCommand).toBe(true);
      expect(command.isActive).toBe(true); // default value
      expect(command.usageCount).toBe(0); // default value
    });

    it('should create user-specific voice commands', async () => {
      const [command] = await db.insert(voiceCommands).values({
        userId: testUser.id,
        name: 'Custom Login',
        trigger: 'login to app',
        category: 'custom',
        description: 'Custom login command',
        actionType: 'test-step',
        actionConfig: { 
          action: 'sequence',
          steps: [
            { action: 'navigate', url: 'https://app.example.com/login' },
            { action: 'type', selector: '#username', text: 'testuser' },
            { action: 'type', selector: '#password', text: 'password' },
            { action: 'click', selector: '#login-btn' }
          ]
        },
        isSystemCommand: false,
      }).returning();

      expect(command.userId).toBe(testUser.id);
      expect(command.name).toBe('Custom Login');
      expect(command.trigger).toBe('login to app');
      expect(command.isSystemCommand).toBe(false);
      expect(command.actionConfig.action).toBe('sequence');
      expect(command.actionConfig.steps).toHaveLength(4);
    });

    it('should handle multilingual commands', async () => {
      const [command] = await db.insert(voiceCommands).values({
        name: 'Hacer Clic',
        trigger: 'hacer clic',
        alternativeTriggers: ['clickear', 'presionar'],
        category: 'interaction',
        description: 'Hacer clic en un elemento',
        actionType: 'ui-action',
        actionConfig: { action: 'click' },
        language: 'es',
        isSystemCommand: true,
      }).returning();

      expect(command.language).toBe('es');
      expect(command.trigger).toBe('hacer clic');
      expect(command.alternativeTriggers).toEqual(['clickear', 'presionar']);
    });
  });

  describe('Voice Command History Table', () => {
    let testCommand: any;
    let testRecording: any;

    beforeEach(async () => {
      const [command] = await db.insert(voiceCommands).values({
        name: 'Test Command',
        trigger: 'test command',
        category: 'test',
        actionType: 'ui-action',
        actionConfig: { action: 'test' },
        isSystemCommand: true,
      }).returning();
      testCommand = command;

      const [recording] = await db.insert(voiceRecordings).values({
        userId: testUser.id,
        fileName: 'command-test.wav',
        filePath: '/uploads/voice/command-test.wav',
        fileSize: 256000,
        duration: 5000,
        format: 'wav',
      }).returning();
      testRecording = recording;
    });

    it('should create command execution history', async () => {
      const [history] = await db.insert(voiceCommandHistory).values({
        userId: testUser.id,
        commandId: testCommand.id,
        recordingId: testRecording.id,
        projectId: testProject.id,
        sessionId: testSession.id,
        testCaseId: testCase.id,
        recognizedText: 'test command with parameters',
        confidence: '0.92',
        parameters: { element: '#test-button', timeout: 5000 },
        executionStatus: 'success',
        executionResult: { 
          success: true, 
          elementFound: true, 
          actionCompleted: true 
        },
        executionDuration: 1500,
        userFeedback: 'correct',
      }).returning();

      expect(history).toBeDefined();
      expect(history.userId).toBe(testUser.id);
      expect(history.commandId).toBe(testCommand.id);
      expect(history.recordingId).toBe(testRecording.id);
      expect(history.projectId).toBe(testProject.id);
      expect(history.sessionId).toBe(testSession.id);
      expect(history.testCaseId).toBe(testCase.id);
      expect(history.recognizedText).toBe('test command with parameters');
      expect(history.confidence).toBe('0.92');
      expect(history.parameters).toEqual({ element: '#test-button', timeout: 5000 });
      expect(history.executionStatus).toBe('success');
      expect(history.executionResult).toEqual({ 
        success: true, 
        elementFound: true, 
        actionCompleted: true 
      });
      expect(history.executionDuration).toBe(1500);
      expect(history.userFeedback).toBe('correct');
    });

    it('should handle failed command executions', async () => {
      const [history] = await db.insert(voiceCommandHistory).values({
        userId: testUser.id,
        commandId: testCommand.id,
        recognizedText: 'test command',
        confidence: '0.85',
        executionStatus: 'failed',
        executionError: 'Element not found: #missing-button',
        executionDuration: 500,
        userFeedback: 'incorrect',
        correctedText: 'click submit button',
      }).returning();

      expect(history.executionStatus).toBe('failed');
      expect(history.executionError).toBe('Element not found: #missing-button');
      expect(history.userFeedback).toBe('incorrect');
      expect(history.correctedText).toBe('click submit button');
    });

    it('should handle unrecognized commands', async () => {
      const [history] = await db.insert(voiceCommandHistory).values({
        userId: testUser.id,
        recognizedText: 'unknown voice command',
        confidence: '0.45',
        executionStatus: 'failed',
        executionError: 'Command not recognized',
      }).returning();

      expect(history.commandId).toBeNull();
      expect(history.recognizedText).toBe('unknown voice command');
      expect(history.confidence).toBe('0.45');
      expect(history.executionStatus).toBe('failed');
      expect(history.executionError).toBe('Command not recognized');
    });
  });

  describe('Voice Annotations Table', () => {
    let testRecording: any;
    let testAction: any;

    beforeEach(async () => {
      const [recording] = await db.insert(voiceRecordings).values({
        userId: testUser.id,
        projectId: testProject.id,
        sessionId: testSession.id,
        fileName: 'annotation-test.wav',
        filePath: '/uploads/voice/annotation-test.wav',
        fileSize: 512000,
        duration: 20000,
        format: 'wav',
      }).returning();
      testRecording = recording;

      const [action] = await db.insert(recordedActions).values({
        sessionId: testSession.id,
        sequenceNumber: 1,
        type: 'click',
        timestamp: new Date(),
        element: 'Login Button',
        selector: '#login-btn',
      }).returning();
      testAction = action;
    });

    it('should create voice annotations for test steps', async () => {
      const [annotation] = await db.insert(voiceAnnotations).values({
        recordingId: testRecording.id,
        userId: testUser.id,
        testCaseId: testCase.id,
        actionId: testAction.id,
        annotationType: 'instruction',
        title: 'Login Step',
        description: 'Click the login button to proceed',
        startTime: 5000,
        endTime: 8000,
        transcribedText: 'Now click on the login button',
        interpretedAction: {
          action: 'click',
          element: '#login-btn',
          description: 'Click login button'
        },
        isProcessed: true,
      }).returning();

      expect(annotation).toBeDefined();
      expect(annotation.recordingId).toBe(testRecording.id);
      expect(annotation.userId).toBe(testUser.id);
      expect(annotation.testCaseId).toBe(testCase.id);
      expect(annotation.actionId).toBe(testAction.id);
      expect(annotation.annotationType).toBe('instruction');
      expect(annotation.title).toBe('Login Step');
      expect(annotation.description).toBe('Click the login button to proceed');
      expect(annotation.startTime).toBe(5000);
      expect(annotation.endTime).toBe(8000);
      expect(annotation.transcribedText).toBe('Now click on the login button');
      expect(annotation.interpretedAction).toEqual({
        action: 'click',
        element: '#login-btn',
        description: 'Click login button'
      });
      expect(annotation.isProcessed).toBe(true);
    });

    it('should create assertion annotations', async () => {
      const [annotation] = await db.insert(voiceAnnotations).values({
        recordingId: testRecording.id,
        userId: testUser.id,
        testCaseId: testCase.id,
        annotationType: 'assertion',
        title: 'Verify Login Success',
        description: 'Check that the user is redirected to dashboard',
        startTime: 15000,
        endTime: 18000,
        transcribedText: 'Verify that we are now on the dashboard page',
        interpretedAction: {
          action: 'assert',
          type: 'url',
          expected: '/dashboard',
          description: 'Verify dashboard URL'
        },
        isProcessed: false,
        processingNotes: 'Needs manual review for assertion details',
      }).returning();

      expect(annotation.annotationType).toBe('assertion');
      expect(annotation.interpretedAction.action).toBe('assert');
      expect(annotation.isProcessed).toBe(false);
      expect(annotation.processingNotes).toBe('Needs manual review for assertion details');
    });

    it('should create comment annotations', async () => {
      const [annotation] = await db.insert(voiceAnnotations).values({
        recordingId: testRecording.id,
        userId: testUser.id,
        annotationType: 'comment',
        title: 'Test Note',
        description: 'This step might be flaky in CI environment',
        startTime: 10000,
        endTime: 12000,
        transcribedText: 'Note that this step sometimes fails in CI',
      }).returning();

      expect(annotation.annotationType).toBe('comment');
      expect(annotation.title).toBe('Test Note');
      expect(annotation.transcribedText).toBe('Note that this step sometimes fails in CI');
      expect(annotation.interpretedAction).toBeNull();
    });
  });

  describe('Voice Preferences Table', () => {
    it('should create user voice preferences', async () => {
      const [preferences] = await db.insert(voicePreferences).values({
        userId: testUser.id,
        primaryLanguage: 'en',
        secondaryLanguages: ['es', 'fr'],
        transcriptionProvider: 'openai',
        confidenceThreshold: '0.85',
        enableRealTimeTranscription: true,
        enableVoiceCommands: true,
        commandSensitivity: 'high',
        enableCustomCommands: true,
        audioQuality: 'high',
        noiseReduction: true,
        autoGainControl: true,
        storeRecordings: true,
        shareForImprovement: false,
        enableVoiceFeedback: true,
        voiceFeedbackLanguage: 'en',
      }).returning();

      expect(preferences).toBeDefined();
      expect(preferences.userId).toBe(testUser.id);
      expect(preferences.primaryLanguage).toBe('en');
      expect(preferences.secondaryLanguages).toEqual(['es', 'fr']);
      expect(preferences.transcriptionProvider).toBe('openai');
      expect(preferences.confidenceThreshold).toBe('0.85');
      expect(preferences.enableRealTimeTranscription).toBe(true);
      expect(preferences.enableVoiceCommands).toBe(true);
      expect(preferences.commandSensitivity).toBe('high');
      expect(preferences.enableCustomCommands).toBe(true);
      expect(preferences.audioQuality).toBe('high');
      expect(preferences.noiseReduction).toBe(true);
      expect(preferences.autoGainControl).toBe(true);
      expect(preferences.storeRecordings).toBe(true);
      expect(preferences.shareForImprovement).toBe(false);
      expect(preferences.enableVoiceFeedback).toBe(true);
      expect(preferences.voiceFeedbackLanguage).toBe('en');
    });

    it('should use default values for preferences', async () => {
      const [preferences] = await db.insert(voicePreferences).values({
        userId: testUser.id,
      }).returning();

      expect(preferences.primaryLanguage).toBe('en'); // default
      expect(preferences.transcriptionProvider).toBe('openai'); // default
      expect(preferences.confidenceThreshold).toBe('0.80'); // default
      expect(preferences.enableRealTimeTranscription).toBe(true); // default
      expect(preferences.commandSensitivity).toBe('medium'); // default
      expect(preferences.audioQuality).toBe('high'); // default
    });

    it('should enforce unique user constraint', async () => {
      await db.insert(voicePreferences).values({
        userId: testUser.id,
        primaryLanguage: 'en',
      });

      await expect(
        db.insert(voicePreferences).values({
          userId: testUser.id, // duplicate user
          primaryLanguage: 'es',
        })
      ).rejects.toThrow();
    });
  });

  describe('Voice Analytics Table', () => {
    it('should create voice analytics records', async () => {
      const date = new Date('2024-01-01T00:00:00Z');

      const [analytics] = await db.insert(voiceAnalytics).values({
        userId: testUser.id,
        date,
        granularity: 'day',
        recordingCount: 25,
        totalRecordingDuration: 300000, // 5 minutes total
        avgRecordingDuration: 12000, // 12 seconds average
        transcriptionCount: 25,
        transcriptionSuccessCount: 23,
        avgTranscriptionConfidence: '0.92',
        commandExecutionCount: 45,
        commandSuccessCount: 42,
        avgCommandConfidence: '0.88',
        languageDistribution: {
          'en': 20,
          'es': 3,
          'fr': 2
        },
        providerUsage: {
          'openai': 18,
          'google': 5,
          'azure': 2
        },
      }).returning();

      expect(analytics).toBeDefined();
      expect(analytics.userId).toBe(testUser.id);
      expect(analytics.granularity).toBe('day');
      expect(analytics.recordingCount).toBe(25);
      expect(analytics.totalRecordingDuration).toBe(300000);
      expect(analytics.avgRecordingDuration).toBe(12000);
      expect(analytics.transcriptionCount).toBe(25);
      expect(analytics.transcriptionSuccessCount).toBe(23);
      expect(analytics.avgTranscriptionConfidence).toBe('0.92');
      expect(analytics.commandExecutionCount).toBe(45);
      expect(analytics.commandSuccessCount).toBe(42);
      expect(analytics.avgCommandConfidence).toBe('0.88');
      expect(analytics.languageDistribution).toEqual({
        'en': 20,
        'es': 3,
        'fr': 2
      });
      expect(analytics.providerUsage).toEqual({
        'openai': 18,
        'google': 5,
        'azure': 2
      });
    });

    it('should enforce unique user-date-granularity constraint', async () => {
      const date = new Date('2024-01-01T00:00:00Z');

      await db.insert(voiceAnalytics).values({
        userId: testUser.id,
        date,
        granularity: 'day',
        recordingCount: 10,
      });

      await expect(
        db.insert(voiceAnalytics).values({
          userId: testUser.id,
          date, // same date
          granularity: 'day', // same granularity
          recordingCount: 20,
        })
      ).rejects.toThrow();
    });

    it('should allow different granularities for same date', async () => {
      const date = new Date('2024-01-01T00:00:00Z');

      const [dayAnalytics] = await db.insert(voiceAnalytics).values({
        userId: testUser.id,
        date,
        granularity: 'day',
        recordingCount: 10,
      }).returning();

      const [hourAnalytics] = await db.insert(voiceAnalytics).values({
        userId: testUser.id,
        date,
        granularity: 'hour', // different granularity
        recordingCount: 2,
      }).returning();

      expect(dayAnalytics.granularity).toBe('day');
      expect(hourAnalytics.granularity).toBe('hour');
    });
  });

  describe('Complex Voice System Queries', () => {
    it('should query user voice activity with recordings and commands', async () => {
      // Create voice recording
      const [recording] = await db.insert(voiceRecordings).values({
        userId: testUser.id,
        projectId: testProject.id,
        fileName: 'activity-test.wav',
        filePath: '/uploads/voice/activity-test.wav',
        fileSize: 256000,
        duration: 10000,
        format: 'wav',
        transcriptionText: 'Click the submit button',
        containsCommands: true,
      }).returning();

      // Create voice command
      const [command] = await db.insert(voiceCommands).values({
        name: 'Submit Action',
        trigger: 'submit',
        category: 'interaction',
        actionType: 'ui-action',
        actionConfig: { action: 'click' },
        isSystemCommand: true,
      }).returning();

      // Create command history
      await db.insert(voiceCommandHistory).values({
        userId: testUser.id,
        commandId: command.id,
        recordingId: recording.id,
        recognizedText: 'click the submit button',
        confidence: '0.95',
        executionStatus: 'success',
      });

      // Query user voice activity
      const userActivity = await db
        .select()
        .from(voiceRecordings)
        .leftJoin(voiceCommandHistory, eq(voiceRecordings.id, voiceCommandHistory.recordingId))
        .leftJoin(voiceCommands, eq(voiceCommandHistory.commandId, voiceCommands.id))
        .where(eq(voiceRecordings.userId, testUser.id));

      expect(userActivity).toHaveLength(1);
      expect(userActivity[0].voice_recordings.fileName).toBe('activity-test.wav');
      expect(userActivity[0].voice_command_history?.executionStatus).toBe('success');
      expect(userActivity[0].voice_commands?.name).toBe('Submit Action');
    });

    it('should query voice annotations with associated test elements', async () => {
      // Create voice recording
      const [recording] = await db.insert(voiceRecordings).values({
        userId: testUser.id,
        projectId: testProject.id,
        sessionId: testSession.id,
        testCaseId: testCase.id,
        fileName: 'annotation-query-test.wav',
        filePath: '/uploads/voice/annotation-query-test.wav',
        fileSize: 256000,
        duration: 15000,
        format: 'wav',
      }).returning();

      // Create recorded action
      const [action] = await db.insert(recordedActions).values({
        sessionId: testSession.id,
        sequenceNumber: 1,
        type: 'click',
        timestamp: new Date(),
        element: 'Submit Button',
        selector: '#submit-btn',
      }).returning();

      // Create voice annotation
      await db.insert(voiceAnnotations).values({
        recordingId: recording.id,
        userId: testUser.id,
        testCaseId: testCase.id,
        actionId: action.id,
        annotationType: 'instruction',
        title: 'Submit Form',
        transcribedText: 'Click the submit button to complete the form',
      });

      // Query annotations with related data
      const annotationsWithContext = await db
        .select()
        .from(voiceAnnotations)
        .leftJoin(voiceRecordings, eq(voiceAnnotations.recordingId, voiceRecordings.id))
        .leftJoin(recordedActions, eq(voiceAnnotations.actionId, recordedActions.id))
        .leftJoin(testCases, eq(voiceAnnotations.testCaseId, testCases.id))
        .where(eq(voiceAnnotations.userId, testUser.id));

      expect(annotationsWithContext).toHaveLength(1);
      expect(annotationsWithContext[0].voice_annotations.title).toBe('Submit Form');
      expect(annotationsWithContext[0].voice_recordings?.fileName).toBe('annotation-query-test.wav');
      expect(annotationsWithContext[0].recorded_actions?.element).toBe('Submit Button');
      expect(annotationsWithContext[0].test_cases?.name).toBe('Test Case');
    });
  });
});