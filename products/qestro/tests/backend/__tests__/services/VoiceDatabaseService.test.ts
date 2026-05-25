import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { VoiceDatabaseService } from '../../../../backend/src/services/VoiceDatabaseService';
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
  testCases
} from '../../../../backend/src/schema';

describe('VoiceDatabaseService', () => {
  let db: any;
  let client: any;
  let service: VoiceDatabaseService;
  let testUser: any;
  let testProject: any;
  let testSession: any;
  let testCase: any;

  beforeAll(async () => {
    const connectionString = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/qestro_test';
    client = postgres(connectionString);
    db = drizzle(client);
    service = new VoiceDatabaseService(db);
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

  describe('searchVoiceRecordings', () => {
    beforeEach(async () => {
      // Create test voice recordings
      await db.insert(voiceRecordings).values([
        {
          userId: testUser.id,
          projectId: testProject.id,
          sessionId: testSession.id,
          testCaseId: testCase.id,
          fileName: 'test-recording-1.wav',
          filePath: '/uploads/voice/test-recording-1.wav',
          fileSize: 1024000,
          duration: 30000,
          format: 'wav',
          transcriptionText: 'Click on the login button',
          transcriptionProvider: 'openai',
          transcriptionConfidence: '0.95',
          transcriptionLanguage: 'en',
          processingStatus: 'completed',
          containsCommands: true,
        },
        {
          userId: testUser.id,
          projectId: testProject.id,
          fileName: 'test-recording-2.wav',
          filePath: '/uploads/voice/test-recording-2.wav',
          fileSize: 512000,
          duration: 15000,
          format: 'wav',
          transcriptionText: 'Enter username and password',
          transcriptionProvider: 'google',
          transcriptionConfidence: '0.88',
          transcriptionLanguage: 'en',
          processingStatus: 'completed',
          containsCommands: false,
        },
        {
          userId: testUser.id,
          fileName: 'test-recording-3.wav',
          filePath: '/uploads/voice/test-recording-3.wav',
          fileSize: 256000,
          duration: 10000,
          format: 'wav',
          processingStatus: 'pending',
        },
      ]);
    });

    it('should search recordings by filename', async () => {
      const result = await service.searchVoiceRecordings('recording-1');

      expect(result.recordings).toHaveLength(1);
      expect(result.recordings[0].recording.fileName).toBe('test-recording-1.wav');
      expect(result.total).toBe(1);
    });

    it('should search recordings by transcription text', async () => {
      const result = await service.searchVoiceRecordings('login button');

      expect(result.recordings).toHaveLength(1);
      expect(result.recordings[0].recording.transcriptionText).toContain('login button');
    });

    it('should filter recordings by processing status', async () => {
      const result = await service.searchVoiceRecordings(undefined, {
        processingStatus: 'completed',
      });

      expect(result.recordings).toHaveLength(2);
      expect(result.recordings.every(r => r.recording.processingStatus === 'completed')).toBe(true);
    });

    it('should filter recordings by contains commands', async () => {
      const result = await service.searchVoiceRecordings(undefined, {
        containsCommands: true,
      });

      expect(result.recordings).toHaveLength(1);
      expect(result.recordings[0].recording.containsCommands).toBe(true);
    });

    it('should filter recordings by language', async () => {
      const result = await service.searchVoiceRecordings(undefined, {
        language: 'en',
      });

      expect(result.recordings).toHaveLength(2);
      expect(result.recordings.every(r => r.recording.transcriptionLanguage === 'en')).toBe(true);
    });

    it('should filter recordings by provider', async () => {
      const result = await service.searchVoiceRecordings(undefined, {
        provider: 'openai',
      });

      expect(result.recordings).toHaveLength(1);
      expect(result.recordings[0].recording.transcriptionProvider).toBe('openai');
    });

    it('should filter recordings by duration range', async () => {
      const result = await service.searchVoiceRecordings(undefined, {
        minDuration: 20000,
        maxDuration: 35000,
      });

      expect(result.recordings).toHaveLength(1);
      expect(result.recordings[0].recording.duration).toBe(30000);
    });

    it('should filter recordings by confidence threshold', async () => {
      const result = await service.searchVoiceRecordings(undefined, {
        minConfidence: 0.9,
      });

      expect(result.recordings).toHaveLength(1);
      expect(parseFloat(result.recordings[0].recording.transcriptionConfidence)).toBeGreaterThanOrEqual(0.9);
    });

    it('should handle pagination', async () => {
      const result = await service.searchVoiceRecordings(undefined, {
        limit: 2,
        offset: 0,
      });

      expect(result.recordings).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.limit).toBe(2);
      expect(result.offset).toBe(0);
    });
  });

  describe('searchVoiceCommands', () => {
    beforeEach(async () => {
      // Create test voice commands
      await db.insert(voiceCommands).values([
        {
          name: 'Click Element',
          trigger: 'click',
          alternativeTriggers: ['tap', 'press'],
          category: 'interaction',
          description: 'Click on an element',
          actionType: 'ui-action',
          actionConfig: { action: 'click' },
          language: 'en',
          isSystemCommand: true,
          usageCount: 100,
        },
        {
          userId: testUser.id,
          name: 'Custom Login',
          trigger: 'login to app',
          category: 'custom',
          description: 'Custom login command',
          actionType: 'test-step',
          actionConfig: { action: 'sequence' },
          language: 'en',
          isSystemCommand: false,
          usageCount: 10,
        },
        {
          name: 'Hacer Clic',
          trigger: 'hacer clic',
          category: 'interaction',
          description: 'Hacer clic en un elemento',
          actionType: 'ui-action',
          actionConfig: { action: 'click' },
          language: 'es',
          isSystemCommand: true,
          usageCount: 5,
        },
      ]);
    });

    it('should search commands by name', async () => {
      const result = await service.searchVoiceCommands('Click Element');

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].command.name).toBe('Click Element');
    });

    it('should search commands by trigger', async () => {
      const result = await service.searchVoiceCommands('login');

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].command.trigger).toContain('login');
    });

    it('should filter commands by category', async () => {
      const result = await service.searchVoiceCommands(undefined, {
        category: 'interaction',
      });

      expect(result.commands).toHaveLength(2);
      expect(result.commands.every(c => c.command.category === 'interaction')).toBe(true);
    });

    it('should filter commands by action type', async () => {
      const result = await service.searchVoiceCommands(undefined, {
        actionType: 'ui-action',
      });

      expect(result.commands).toHaveLength(2);
      expect(result.commands.every(c => c.command.actionType === 'ui-action')).toBe(true);
    });

    it('should filter commands by language', async () => {
      const result = await service.searchVoiceCommands(undefined, {
        language: 'es',
      });

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].command.language).toBe('es');
    });

    it('should filter system commands', async () => {
      const result = await service.searchVoiceCommands(undefined, {
        isSystemCommand: true,
      });

      expect(result.commands).toHaveLength(2);
      expect(result.commands.every(c => c.command.isSystemCommand)).toBe(true);
    });

    it('should include user-specific commands for user', async () => {
      const result = await service.searchVoiceCommands(undefined, {
        userId: testUser.id,
      });

      expect(result.commands.length).toBeGreaterThan(0);
      expect(result.commands.some(c => c.command.userId === testUser.id)).toBe(true);
      expect(result.commands.some(c => c.command.isSystemCommand)).toBe(true);
    });
  });

  describe('getVoiceCommandHistory', () => {
    let testCommand: any;
    let testRecording: any;

    beforeEach(async () => {
      // Create test command
      const [command] = await db.insert(voiceCommands).values({
        name: 'Test Command',
        trigger: 'test command',
        category: 'test',
        actionType: 'ui-action',
        actionConfig: { action: 'test' },
        isSystemCommand: true,
      }).returning();
      testCommand = command;

      // Create test recording
      const [recording] = await db.insert(voiceRecordings).values({
        userId: testUser.id,
        fileName: 'command-test.wav',
        filePath: '/uploads/voice/command-test.wav',
        fileSize: 256000,
        duration: 5000,
        format: 'wav',
      }).returning();
      testRecording = recording;

      // Create command history
      await db.insert(voiceCommandHistory).values([
        {
          userId: testUser.id,
          commandId: testCommand.id,
          recordingId: testRecording.id,
          projectId: testProject.id,
          recognizedText: 'test command success',
          confidence: '0.95',
          executionStatus: 'success',
          executionDuration: 1000,
        },
        {
          userId: testUser.id,
          commandId: testCommand.id,
          recognizedText: 'test command failed',
          confidence: '0.80',
          executionStatus: 'failed',
          executionError: 'Element not found',
          executionDuration: 500,
        },
        {
          userId: testUser.id,
          recognizedText: 'unknown command',
          confidence: '0.60',
          executionStatus: 'failed',
          executionError: 'Command not recognized',
        },
      ]);
    });

    it('should get command history for user', async () => {
      const result = await service.getVoiceCommandHistory(testUser.id);

      expect(result.history).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.history.every(h => h.history.userId === testUser.id)).toBe(true);
    });

    it('should filter history by command', async () => {
      const result = await service.getVoiceCommandHistory(testUser.id, {
        commandId: testCommand.id,
      });

      expect(result.history).toHaveLength(2);
      expect(result.history.every(h => h.history.commandId === testCommand.id)).toBe(true);
    });

    it('should filter history by execution status', async () => {
      const result = await service.getVoiceCommandHistory(testUser.id, {
        executionStatus: 'success',
      });

      expect(result.history).toHaveLength(1);
      expect(result.history[0].history.executionStatus).toBe('success');
    });

    it('should calculate statistics', async () => {
      const result = await service.getVoiceCommandHistory(testUser.id);

      expect(result.stats.totalExecutions).toBe(3);
      expect(result.stats.successfulExecutions).toBe(1);
      expect(result.stats.successRate).toBeCloseTo(33.33, 1);
      expect(result.stats.avgConfidence).toBeCloseTo(0.78, 1);
      expect(result.stats.avgDuration).toBeCloseTo(750, 0);
    });

    it('should handle pagination', async () => {
      const result = await service.getVoiceCommandHistory(testUser.id, {
        limit: 2,
        offset: 0,
      });

      expect(result.history).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.limit).toBe(2);
      expect(result.offset).toBe(0);
    });
  });

  describe('getVoiceAnnotations', () => {
    let testRecording: any;

    beforeEach(async () => {
      // Create test recording
      const [recording] = await db.insert(voiceRecordings).values({
        userId: testUser.id,
        projectId: testProject.id,
        sessionId: testSession.id,
        testCaseId: testCase.id,
        fileName: 'annotation-test.wav',
        filePath: '/uploads/voice/annotation-test.wav',
        fileSize: 512000,
        duration: 20000,
        format: 'wav',
      }).returning();
      testRecording = recording;

      // Create annotations
      await db.insert(voiceAnnotations).values([
        {
          recordingId: testRecording.id,
          userId: testUser.id,
          testCaseId: testCase.id,
          annotationType: 'instruction',
          title: 'Login Step',
          description: 'Click the login button',
          startTime: 5000,
          endTime: 8000,
          transcribedText: 'Click on the login button',
          isProcessed: true,
        },
        {
          recordingId: testRecording.id,
          userId: testUser.id,
          testCaseId: testCase.id,
          annotationType: 'assertion',
          title: 'Verify Success',
          description: 'Check login success',
          startTime: 15000,
          endTime: 18000,
          transcribedText: 'Verify that login was successful',
          isProcessed: false,
        },
        {
          recordingId: testRecording.id,
          userId: testUser.id,
          annotationType: 'comment',
          title: 'Test Note',
          description: 'This might be flaky',
          startTime: 10000,
          endTime: 12000,
          transcribedText: 'Note that this step is sometimes flaky',
          isProcessed: true,
        },
      ]);
    });

    it('should get annotations for recording', async () => {
      const result = await service.getVoiceAnnotations({
        recordingId: testRecording.id,
      });

      expect(result.annotations).toHaveLength(3);
      expect(result.annotations.every(a => a.annotation.recordingId === testRecording.id)).toBe(true);
    });

    it('should filter annotations by type', async () => {
      const result = await service.getVoiceAnnotations({
        annotationType: 'instruction',
      });

      expect(result.annotations).toHaveLength(1);
      expect(result.annotations[0].annotation.annotationType).toBe('instruction');
    });

    it('should filter annotations by processing status', async () => {
      const result = await service.getVoiceAnnotations({
        isProcessed: true,
      });

      expect(result.annotations).toHaveLength(2);
      expect(result.annotations.every(a => a.annotation.isProcessed)).toBe(true);
    });

    it('should filter annotations by user', async () => {
      const result = await service.getVoiceAnnotations({
        userId: testUser.id,
      });

      expect(result.annotations).toHaveLength(3);
      expect(result.annotations.every(a => a.annotation.userId === testUser.id)).toBe(true);
    });
  });

  describe('getUserVoicePreferences', () => {
    it('should return null for user without preferences', async () => {
      const preferences = await service.getUserVoicePreferences(testUser.id);
      expect(preferences).toBeUndefined();
    });

    it('should return user preferences', async () => {
      // Create preferences
      await db.insert(voicePreferences).values({
        userId: testUser.id,
        primaryLanguage: 'en',
        transcriptionProvider: 'openai',
        confidenceThreshold: '0.85',
        enableVoiceCommands: true,
      });

      const preferences = await service.getUserVoicePreferences(testUser.id);

      expect(preferences).toBeDefined();
      expect(preferences.userId).toBe(testUser.id);
      expect(preferences.primaryLanguage).toBe('en');
      expect(preferences.transcriptionProvider).toBe('openai');
      expect(preferences.confidenceThreshold).toBe('0.85');
      expect(preferences.enableVoiceCommands).toBe(true);
    });
  });

  describe('upsertUserVoicePreferences', () => {
    it('should create new preferences for user', async () => {
      const preferences = await service.upsertUserVoicePreferences(testUser.id, {
        primaryLanguage: 'es',
        transcriptionProvider: 'google',
        confidenceThreshold: '0.90',
      });

      expect(preferences).toBeDefined();
      expect(preferences.userId).toBe(testUser.id);
      expect(preferences.primaryLanguage).toBe('es');
      expect(preferences.transcriptionProvider).toBe('google');
      expect(preferences.confidenceThreshold).toBe('0.90');
    });

    it('should update existing preferences', async () => {
      // Create initial preferences
      await db.insert(voicePreferences).values({
        userId: testUser.id,
        primaryLanguage: 'en',
        transcriptionProvider: 'openai',
      });

      // Update preferences
      const updated = await service.upsertUserVoicePreferences(testUser.id, {
        primaryLanguage: 'fr',
        confidenceThreshold: '0.95',
      });

      expect(updated.primaryLanguage).toBe('fr');
      expect(updated.confidenceThreshold).toBe('0.95');
      expect(updated.transcriptionProvider).toBe('openai'); // Should remain unchanged
    });
  });

  describe('getVoiceProcessingQueue', () => {
    beforeEach(async () => {
      // Create recordings with different statuses
      await db.insert(voiceRecordings).values([
        {
          userId: testUser.id,
          fileName: 'pending-1.wav',
          filePath: '/uploads/voice/pending-1.wav',
          fileSize: 256000,
          duration: 10000,
          format: 'wav',
          processingStatus: 'pending',
        },
        {
          userId: testUser.id,
          fileName: 'pending-2.wav',
          filePath: '/uploads/voice/pending-2.wav',
          fileSize: 512000,
          duration: 15000,
          format: 'wav',
          processingStatus: 'pending',
        },
        {
          userId: testUser.id,
          fileName: 'processing-1.wav',
          filePath: '/uploads/voice/processing-1.wav',
          fileSize: 256000,
          duration: 8000,
          format: 'wav',
          processingStatus: 'processing',
        },
        {
          userId: testUser.id,
          fileName: 'completed-1.wav',
          filePath: '/uploads/voice/completed-1.wav',
          fileSize: 256000,
          duration: 12000,
          format: 'wav',
          processingStatus: 'completed',
        },
      ]);
    });

    it('should get pending recordings', async () => {
      const queue = await service.getVoiceProcessingQueue('pending');

      expect(queue).toHaveLength(2);
      expect(queue.every(r => r.recording.processingStatus === 'pending')).toBe(true);
    });

    it('should get processing recordings', async () => {
      const queue = await service.getVoiceProcessingQueue('processing');

      expect(queue).toHaveLength(1);
      expect(queue[0].recording.processingStatus).toBe('processing');
    });

    it('should respect limit parameter', async () => {
      const queue = await service.getVoiceProcessingQueue('pending', 1);

      expect(queue).toHaveLength(1);
    });
  });

  describe('updateVoiceRecordingStatus', () => {
    let testRecording: any;

    beforeEach(async () => {
      const [recording] = await db.insert(voiceRecordings).values({
        userId: testUser.id,
        fileName: 'status-test.wav',
        filePath: '/uploads/voice/status-test.wav',
        fileSize: 256000,
        duration: 10000,
        format: 'wav',
        processingStatus: 'pending',
      }).returning();
      testRecording = recording;
    });

    it('should update recording status', async () => {
      const updated = await service.updateVoiceRecordingStatus(
        testRecording.id,
        'completed',
        {
          transcriptionText: 'Test transcription',
          transcriptionProvider: 'openai',
          transcriptionConfidence: '0.95',
        }
      );

      expect(updated.processingStatus).toBe('completed');
      expect(updated.transcriptionText).toBe('Test transcription');
      expect(updated.transcriptionProvider).toBe('openai');
      expect(updated.transcriptionConfidence).toBe('0.95');
    });

    it('should update status to failed with error', async () => {
      const updated = await service.updateVoiceRecordingStatus(
        testRecording.id,
        'failed',
        {
          processingError: 'Transcription service unavailable',
        }
      );

      expect(updated.processingStatus).toBe('failed');
      expect(updated.processingError).toBe('Transcription service unavailable');
    });
  });
});