// Note: LangGraph integration temporarily simplified due to API changes
// import { StateGraph, END, START } from '@langchain/langgraph';
// import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { RecordingService, RecordingSession, RecordedAction, RecordingConfig } from './RecordingService.js';
import { logger } from '../utils/logger.js';
import { EventEmitter } from 'events';
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

// Analysis State Interface (simplified without LangGraph for now)
interface RecordingAnalysisState {
  session: RecordingSession;
  actions: RecordedAction[];
  analysis: {
    patterns: string[];
    assertions: string[];
    optimizations: string[];
    testCases: TestCase[];
  };
  currentStep: string;
  error?: string;
}

interface TestCase {
  id: string;
  name: string;
  description: string;
  steps: TestStep[];
  assertions: TestAssertion[];
  priority: 'high' | 'medium' | 'low';
  tags: string[];
}

interface TestStep {
  action: string;
  target: string;
  data?: string;
  description: string;
}

interface TestAssertion {
  type: 'visibility' | 'text' | 'attribute' | 'state';
  target: string;
  expected: string;
  description: string;
}

interface SyncUpdate {
  sessionId: string;
  type: 'action' | 'status' | 'analysis' | 'testGenerated';
  data: any;
  timestamp: number;
}

export class EnhancedRecordingService extends RecordingService {
  private io: SocketIOServer | null = null;
  private activeAnalysis = new Map<string, RecordingAnalysisState>();
  
  constructor(outputDir = './recordings', io?: SocketIOServer) {
    super(outputDir);
    this.io = io;
    this.setupRealTimeSync();
  }

  private setupRealTimeSync(): void {
    if (this.io) {
      this.io.on('connection', (socket) => {
        logger.info(`Client connected for real-time sync: ${socket.id}`);

        socket.on('join-session', (sessionId: string) => {
          socket.join(`session-${sessionId}`);
          logger.info(`Client ${socket.id} joined session ${sessionId}`);
        });

        socket.on('disconnect', () => {
          logger.info(`Client disconnected: ${socket.id}`);
        });
      });
    }

    // Listen to recording service events and broadcast updates
    this.on('recording:action', (data) => {
      this.broadcastUpdate({
        sessionId: data.session.id,
        type: 'action',
        data: data.action,
        timestamp: Date.now()
      });
    });

    this.on('recording:completed', (session) => {
      this.broadcastUpdate({
        sessionId: session.id,
        type: 'status',
        data: { status: 'completed', session },
        timestamp: Date.now()
      });
      
      // Start AI analysis automatically when recording completes
      this.startAIAnalysis(session.id);
    });
  }

  private broadcastUpdate(update: SyncUpdate): void {
    if (this.io) {
      this.io.to(`session-${update.sessionId}`).emit('sync-update', update);
      logger.debug(`Broadcasted update for session ${update.sessionId}: ${update.type}`);
    }
  }

  // Override the parent method to add real-time sync
  async startRecording(config: RecordingConfig): Promise<RecordingSession> {
    const session = await super.startRecording(config);
    
    // For demo purposes, add some sample actions when recording starts
    // In real implementation, these would come from actual device/browser interaction
    if (config.type === 'mobile') {
      session.actions = [
        {
          id: uuidv4(),
          type: 'tap',
          timestamp: Date.now(),
          coordinates: { x: 100, y: 200 },
          element: 'Login Button'
        },
        {
          id: uuidv4(),
          type: 'type',
          timestamp: Date.now() + 1000,
          text: 'username@example.com',
          element: 'Email Input'
        }
      ];
    } else {
      session.actions = [
        {
          id: uuidv4(),
          type: 'navigate',
          timestamp: Date.now(),
          text: 'https://example.com'
        },
        {
          id: uuidv4(),
          type: 'tap',
          timestamp: Date.now() + 500,
          selector: '[data-testid="submit-button"]',
          element: 'Submit Button'
        }
      ];
    }
    
    // Broadcast session start
    this.broadcastUpdate({
      sessionId: session.id,
      type: 'status',
      data: { status: 'recording', session },
      timestamp: Date.now()
    });

    return session;
  }

  async stopRecording(sessionId: string): Promise<RecordingSession> {
    const session = await super.stopRecording(sessionId);
    return session;
  }

  // Additional method to get session and actions for the API
  async stopRecordingWithActions(sessionId: string): Promise<{ session: RecordingSession; actions: RecordedAction[] }> {
    const session = await super.stopRecording(sessionId);
    
    // Return both session and actions for the API
    return {
      session,
      actions: session.actions
    };
  }

  // AI Analysis Methods (simplified implementation)
  async startAIAnalysis(sessionId: string): Promise<void> {
    try {
      const session = this.getSession(sessionId);
      if (!session || session.status !== 'completed') {
        throw new Error('Session not found or not completed');
      }

      logger.info(`Starting AI analysis for session ${sessionId}`);

      const initialState: RecordingAnalysisState = {
        session,
        actions: session.actions,
        analysis: {
          patterns: [],
          assertions: [],
          optimizations: [],
          testCases: []
        },
        currentStep: 'start'
      };

      this.activeAnalysis.set(sessionId, initialState);

      // Run simplified analysis pipeline
      const finalState = await this.runAnalysisPipeline(initialState);
      
      // Broadcast analysis results
      this.broadcastUpdate({
        sessionId,
        type: 'analysis',
        data: finalState.analysis,
        timestamp: Date.now()
      });

      // Broadcast generated test cases
      this.broadcastUpdate({
        sessionId,
        type: 'testGenerated',
        data: finalState.analysis.testCases,
        timestamp: Date.now()
      });

      logger.info(`AI analysis completed for session ${sessionId}`);
    } catch (error) {
      logger.error(`AI analysis failed for session ${sessionId}:`, error);
      
      this.broadcastUpdate({
        sessionId,
        type: 'analysis',
        data: { error: 'Analysis failed' },
        timestamp: Date.now()
      });
    }
  }

  // Simplified analysis pipeline (replaces LangGraph for now)
  private async runAnalysisPipeline(state: RecordingAnalysisState): Promise<RecordingAnalysisState> {
    // Step 1: Analyze actions
    state = await this.analyzeActionsStep(state);
    
    // Step 2: Detect patterns
    state = await this.detectPatternsStep(state);
    
    // Step 3: Generate assertions
    state = await this.generateAssertionsStep(state);
    
    // Step 4: Optimize flow
    state = await this.optimizeFlowStep(state);
    
    // Step 5: Generate tests
    state = await this.generateTestsStep(state);
    
    state.currentStep = 'completed';
    return state;
  }

  // Analysis Step Functions
  private async analyzeActionsStep(state: RecordingAnalysisState): Promise<RecordingAnalysisState> {
    logger.debug('Analyzing actions...');
    
    const actionAnalysis = {
      totalActions: state.actions.length,
      actionTypes: [...new Set(state.actions.map(a => a.type))],
      timespan: state.session.duration,
      complexity: this.calculateComplexity(state.actions)
    };

    state.currentStep = 'analyze_actions';
    state.analysis.patterns.push(
      `${actionAnalysis.totalActions} total actions`,
      `Duration: ${actionAnalysis.timespan}s`,
      `Complexity score: ${actionAnalysis.complexity}`
    );

    return state;
  }

  private async detectPatternsStep(state: RecordingAnalysisState): Promise<RecordingAnalysisState> {
    logger.debug('Detecting patterns...');

    const patterns = this.detectUserPatterns(state.actions);
    state.currentStep = 'detect_patterns';
    state.analysis.patterns.push(...patterns);

    return state;
  }

  private async generateAssertionsStep(state: RecordingAnalysisState): Promise<RecordingAnalysisState> {
    logger.debug('Generating assertions...');

    const assertions = this.generateSmartAssertions(state.actions, state.session);
    state.currentStep = 'generate_assertions';
    state.analysis.assertions = assertions;

    return state;
  }

  private async optimizeFlowStep(state: RecordingAnalysisState): Promise<RecordingAnalysisState> {
    logger.debug('Optimizing flow...');

    const optimizations = this.suggestOptimizations(state.actions);
    state.currentStep = 'optimize_flow';
    state.analysis.optimizations = optimizations;

    return state;
  }

  private async generateTestsStep(state: RecordingAnalysisState): Promise<RecordingAnalysisState> {
    logger.debug('Generating test cases...');

    const testCases = this.generateTestCases(state.actions, state.analysis, state.session);
    state.currentStep = 'generate_tests';
    state.analysis.testCases = testCases;

    return state;
  }

  // Helper Methods for AI Analysis
  private calculateComplexity(actions: RecordedAction[]): number {
    const weights = { tap: 1, type: 2, swipe: 2, scroll: 1, assert: 3, wait: 1, screenshot: 1, navigate: 2 };
    return actions.reduce((sum, action) => sum + (weights[action.type] || 1), 0);
  }

  private detectUserPatterns(actions: RecordedAction[]): string[] {
    const patterns = [];

    // Detect form filling patterns
    const typeActions = actions.filter(a => a.type === 'type');
    if (typeActions.length > 2) {
      patterns.push(`Form filling pattern: ${typeActions.length} input fields`);
    }

    // Detect navigation patterns
    const navActions = actions.filter(a => a.type === 'tap' && a.element?.toLowerCase().includes('button'));
    if (navActions.length > 1) {
      patterns.push(`Navigation pattern: ${navActions.length} button interactions`);
    }

    // Detect repetitive actions
    const actionSequences = this.findRepeatingSequences(actions);
    if (actionSequences.length > 0) {
      patterns.push(`Repetitive actions detected: ${actionSequences.length} sequences`);
    }

    return patterns;
  }

  private findRepeatingSequences(actions: RecordedAction[]): string[] {
    // Simple sequence detection - look for repeated action types
    const sequences = [];
    const actionTypes = actions.map(a => a.type);
    
    for (let i = 0; i < actionTypes.length - 2; i++) {
      for (let len = 2; len <= Math.min(5, actionTypes.length - i); len++) {
        const sequence = actionTypes.slice(i, i + len);
        const nextSequence = actionTypes.slice(i + len, i + len * 2);
        
        if (sequence.length === nextSequence.length && 
            sequence.every((type, idx) => type === nextSequence[idx])) {
          sequences.push(`Repeated: ${sequence.join(' -> ')}`);
        }
      }
    }

    return [...new Set(sequences)];
  }

  private generateSmartAssertions(actions: RecordedAction[], session: RecordingSession): string[] {
    const assertions = [];

    // Generate assertions based on interactions
    actions.forEach(action => {
      switch (action.type) {
        case 'tap':
          if (action.element) {
            assertions.push(`Verify "${action.element}" is clickable`);
            assertions.push(`Verify "${action.element}" is visible`);
          }
          break;
        case 'type':
          if (action.element && action.text) {
            assertions.push(`Verify text "${action.text}" is entered in "${action.element}"`);
          }
          break;
        case 'navigate':
          if (action.text) {
            assertions.push(`Verify navigation to "${action.text}" successful`);
          }
          break;
      }
    });

    // Add context-based assertions
    if (session.type === 'mobile') {
      assertions.push('Verify app is responsive on mobile device');
    } else {
      assertions.push('Verify page loads within acceptable time');
    }

    return [...new Set(assertions)];
  }

  private suggestOptimizations(actions: RecordedAction[]): string[] {
    const optimizations = [];

    // Suggest removing unnecessary waits
    const waitActions = actions.filter(a => a.type === 'wait');
    if (waitActions.length > 3) {
      optimizations.push('Consider reducing wait times for faster test execution');
    }

    // Suggest combining similar actions
    const tapActions = actions.filter(a => a.type === 'tap');
    if (tapActions.length > 10) {
      optimizations.push('Consider grouping similar tap actions into reusable functions');
    }

    // Suggest adding checkpoints
    const actionCount = actions.length;
    if (actionCount > 15) {
      optimizations.push('Consider adding intermediate checkpoints for better debugging');
    }

    return optimizations;
  }

  private generateTestCases(actions: RecordedAction[], analysis: any, session: RecordingSession): TestCase[] {
    const testCases = [];

    // Main flow test case
    const mainTestCase: TestCase = {
      id: uuidv4(),
      name: 'Main User Flow',
      description: `Complete user flow recorded in session ${session.id}`,
      steps: actions.map((action, index) => ({
        action: action.type,
        target: action.element || action.selector || `coordinates(${action.coordinates?.x},${action.coordinates?.y})`,
        data: action.text,
        description: `Step ${index + 1}: ${this.describeAction(action)}`
      })),
      assertions: analysis.assertions.map((assertion: string) => ({
        type: 'visibility' as const,
        target: 'element',
        expected: 'visible',
        description: assertion
      })),
      priority: 'high',
      tags: ['main-flow', session.type, session.platform]
    };

    testCases.push(mainTestCase);

    // Generate edge case tests
    const edgeCaseTest: TestCase = {
      id: uuidv4(),
      name: 'Edge Cases',
      description: 'Test edge cases and error conditions',
      steps: [
        {
          action: 'type',
          target: 'input[type="text"]',
          data: '',
          description: 'Test empty input validation'
        }
      ],
      assertions: [
        {
          type: 'text',
          target: '.error-message',
          expected: 'Field is required',
          description: 'Verify validation message appears'
        }
      ],
      priority: 'medium',
      tags: ['edge-cases', 'validation']
    };

    testCases.push(edgeCaseTest);

    return testCases;
  }

  private describeAction(action: RecordedAction): string {
    switch (action.type) {
      case 'tap':
        return `Tap on ${action.element || 'element'}`;
      case 'type':
        return `Type "${action.text}" into ${action.element || 'field'}`;
      case 'swipe':
        return `Swipe gesture`;
      case 'scroll':
        return `Scroll page`;
      case 'navigate':
        return `Navigate to ${action.text}`;
      default:
        return `Perform ${action.type} action`;
    }
  }

  // Public API Methods
  getAnalysis(sessionId: string): RecordingAnalysisState | undefined {
    return this.activeAnalysis.get(sessionId);
  }

  async exportTestCases(sessionId: string, format: 'maestro' | 'workflow-use' | 'playwright' | 'cypress'): Promise<string> {
    const analysis = this.activeAnalysis.get(sessionId);
    if (!analysis) {
      throw new Error('Analysis not found for session');
    }

    switch (format) {
      case 'playwright':
        return this.exportToPlaywright(analysis.analysis.testCases);
      case 'cypress':
        return this.exportToCypress(analysis.analysis.testCases);
      default:
        return super.exportSession(sessionId, format);
    }
  }

  private exportToPlaywright(testCases: TestCase[]): string {
    let code = `import { test, expect } from '@playwright/test';\n\n`;

    testCases.forEach(testCase => {
      code += `test('${testCase.name}', async ({ page }) => {\n`;
      code += `  // ${testCase.description}\n\n`;

      testCase.steps.forEach(step => {
        switch (step.action) {
          case 'tap':
            code += `  await page.click('${step.target}');\n`;
            break;
          case 'type':
            code += `  await page.fill('${step.target}', '${step.data}');\n`;
            break;
          case 'navigate':
            code += `  await page.goto('${step.data}');\n`;
            break;
        }
      });

      testCase.assertions.forEach(assertion => {
        code += `  await expect(page.locator('${assertion.target}')).toBeVisible();\n`;
      });

      code += `});\n\n`;
    });

    return code;
  }

  private exportToCypress(testCases: TestCase[]): string {
    let code = `describe('Generated Test Suite', () => {\n\n`;

    testCases.forEach(testCase => {
      code += `  it('${testCase.name}', () => {\n`;
      code += `    // ${testCase.description}\n\n`;

      testCase.steps.forEach(step => {
        switch (step.action) {
          case 'tap':
            code += `    cy.get('${step.target}').click();\n`;
            break;
          case 'type':
            code += `    cy.get('${step.target}').type('${step.data}');\n`;
            break;
          case 'navigate':
            code += `    cy.visit('${step.data}');\n`;
            break;
        }
      });

      testCase.assertions.forEach(assertion => {
        code += `    cy.get('${assertion.target}').should('be.visible');\n`;
      });

      code += `  });\n\n`;
    });

    code += `});\n`;
    return code;
  }
}