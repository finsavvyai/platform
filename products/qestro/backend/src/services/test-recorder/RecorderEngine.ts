/**
 * Recorder Engine
 * Main orchestrator for test recording, optimization, and code generation
 */

import { logger } from '../../utils/logger.js';
import {
  RecordingSession,
  RecordedAction,
  RecordingOptions,
  CodegenOptions,
  CodegenResult,
  SessionMetadata,
} from './types.js';
import { sessionManager } from './SessionManager.js';
import { actionOptimizer } from './ActionOptimizer.js';
import { playwrightCodegen } from './PlaywrightCodegen.js';

export class RecorderEngine {
  private static readonly DEFAULT_OPTIONS: RecordingOptions = {
    captureScreenshots: true,
    recordNetwork: false,
    recordConsole: false,
    smartWaits: true,
    preferredSelectors: ['testid', 'role', 'text', 'css'],
  };

  /**
   * Start a recording session
   */
  startRecording(
    projectId: string,
    url: string,
    options: Partial<RecordingOptions> = {},
    metadata?: SessionMetadata
  ): string {
    const finalOptions = { ...RecorderEngine.DEFAULT_OPTIONS, ...options };

    const session = sessionManager.startSession(projectId, url, finalOptions, metadata);

    logger.info('Recording started', {
      sessionId: session.id,
      projectId,
      url,
    });

    return session.id;
  }

  /**
   * Record an action in an active session
   */
  recordAction(sessionId: string, action: RecordedAction): void {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      logger.warn('Cannot record action: session not found', { sessionId });
      return;
    }

    sessionManager.addAction(sessionId, action);
  }

  /**
   * Stop recording and generate code
   */
  async stopRecording(
    sessionId: string,
    codegenOptions: CodegenOptions = {}
  ): Promise<CodegenResult> {
    const session = sessionManager.endSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    logger.info('Processing recording', {
      sessionId,
      actionCount: session.actions.length,
    });

    // Optimize actions
    const steps = actionOptimizer.optimizeActions(session.actions);

    // Generate code
    const codegenOpts = {
      ...codegenOptions,
      testName: codegenOptions.testName || `Test recorded from ${session.url}`,
    };

    const result = playwrightCodegen.generateCode(steps, codegenOpts);

    logger.info('Recording processed', {
      sessionId,
      steps: steps.length,
      assertions: result.assertions,
      estimatedTime: result.estimatedRunTime,
    });

    return result;
  }

  /**
   * Pause a recording session
   */
  pauseRecording(sessionId: string): RecordingSession | undefined {
    const session = sessionManager.pauseSession(sessionId);
    if (session) {
      logger.info('Recording paused', { sessionId });
    }
    return session;
  }

  /**
   * Resume a paused recording session
   */
  resumeRecording(sessionId: string): RecordingSession | undefined {
    const session = sessionManager.resumeSession(sessionId);
    if (session) {
      logger.info('Recording resumed', { sessionId });
    }
    return session;
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): RecordingSession | undefined {
    return sessionManager.getSession(sessionId);
  }

  /**
   * Export recording as different format
   */
  async exportRecording(
    sessionId: string,
    format: 'playwright' | 'cypress' = 'playwright'
  ): Promise<string> {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const steps = actionOptimizer.optimizeActions(session.actions);

    let code = '';

    if (format === 'playwright') {
      const result = playwrightCodegen.generateCode(steps, { testName: `Test from ${session.url}` });
      code = result.code;
    } else if (format === 'cypress') {
      code = this.generateCypressCode(steps);
    }

    logger.info('Recording exported', {
      sessionId,
      format,
      codeLength: code.length,
    });

    return code;
  }

  /**
   * Generate Cypress code (basic support)
   */
  private generateCypressCode(steps: any[]): string {
    let code = `describe('Recorded Test', () => {
  it('should complete recorded steps', () => {
    cy.visit('${steps[0]?.url || '/'}');
`;

    for (const step of steps) {
      switch (step.actionType) {
        case 'click':
          code += `    cy.get('${step.selector?.value || ''}').click();\n`;
          break;
        case 'fill':
          code += `    cy.get('${step.selector?.value || ''}').type('${step.text || ''}');\n`;
          break;
        case 'assert':
          code += `    cy.get('${step.selector?.value || ''}').should('be.visible');\n`;
          break;
      }
    }

    code += `  });
});
`;
    return code;
  }

  /**
   * Get recording statistics
   */
  getStats(): {
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    pausedSessions: number;
  } {
    return sessionManager.getStats();
  }

  /**
   * Cleanup session
   */
  deleteSession(sessionId: string): boolean {
    const deleted = sessionManager.deleteSession(sessionId);
    if (deleted) {
      logger.info('Session cleaned up', { sessionId });
    }
    return deleted;
  }

  /**
   * Get all sessions for project
   */
  getProjectSessions(projectId: string): RecordingSession[] {
    return sessionManager.getProjectSessions(projectId);
  }
}

export const recorderEngine = new RecorderEngine();
