import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import yaml from 'js-yaml';
import { logger } from '../utils/logger.js';

export interface RecordingSession {
  id: string;
  type: 'mobile' | 'web';
  platform: 'ios' | 'android' | 'chrome' | 'firefox' | 'safari';
  status: 'idle' | 'recording' | 'processing' | 'completed' | 'error';
  startTime: Date;
  endTime?: Date;
  duration: number;
  metadata: {
    deviceName?: string;
    appId?: string;
    url?: string;
    viewport?: { width: number; height: number };
    userAgent?: string;
  };
  actions: RecordedAction[];
  artifacts: {
    screenshots: string[];
    videos: string[];
    logs: string[];
  };
}

export interface RecordedAction {
  id: string;
  type: 'tap' | 'type' | 'swipe' | 'scroll' | 'assert' | 'wait' | 'screenshot' | 'navigate';
  timestamp: number;
  coordinates?: { x: number; y: number };
  text?: string;
  element?: string;
  selector?: string;
  screenshot?: string;
  metadata?: Record<string, any>;
}

export interface RecordingConfig {
  type: 'mobile' | 'web';
  platform: string;
  metadata: RecordingSession['metadata'];
  outputDir?: string;
  recordVideo?: boolean;
  recordScreenshots?: boolean;
}

export class RecordingService extends EventEmitter {
  private activeSessions = new Map<string, RecordingSession>();
  private recordingProcesses = new Map<string, ChildProcess>();
  private outputDir: string;

  constructor(outputDir = './recordings') {
    super();
    this.outputDir = outputDir;
    this.ensureOutputDir();
  }

  private async ensureOutputDir(): Promise<void> {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create output directory:', error);
    }
  }

  async startRecording(config: RecordingConfig): Promise<RecordingSession> {
    const sessionId = uuidv4();
    const session: RecordingSession = {
      id: sessionId,
      type: config.type,
      platform: config.platform as any,
      status: 'recording',
      startTime: new Date(),
      duration: 0,
      metadata: config.metadata,
      actions: [],
      artifacts: {
        screenshots: [],
        videos: [],
        logs: []
      }
    };

    this.activeSessions.set(sessionId, session);

    try {
      if (config.type === 'mobile') {
        await this.startMobileRecording(session);
      } else {
        await this.startWebRecording(session);
      }

      this.emit('recording:started', session);
      logger.info(`Recording started for session ${sessionId}`);
      
      return session;
    } catch (error) {
      session.status = 'error';
      this.activeSessions.set(sessionId, session);
      logger.error(`Failed to start recording for session ${sessionId}:`, error);
      throw error;
    }
  }

  async stopRecording(sessionId: string): Promise<RecordingSession> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== 'recording') {
      throw new Error(`Session ${sessionId} is not currently recording`);
    }

    session.status = 'processing';
    session.endTime = new Date();
    session.duration = Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 1000);

    try {
      // Stop the recording process
      const process = this.recordingProcesses.get(sessionId);
      if (process) {
        process.kill('SIGTERM');
        this.recordingProcesses.delete(sessionId);
      }

      // Process recorded data
      await this.processRecordingData(session);
      
      session.status = 'completed';
      this.activeSessions.set(sessionId, session);

      this.emit('recording:completed', session);
      logger.info(`Recording completed for session ${sessionId}`);

      return session;
    } catch (error) {
      session.status = 'error';
      this.activeSessions.set(sessionId, session);
      logger.error(`Failed to stop recording for session ${sessionId}:`, error);
      throw error;
    }
  }

  private async startMobileRecording(session: RecordingSession): Promise<void> {
    const sessionDir = path.join(this.outputDir, session.id);
    await fs.mkdir(sessionDir, { recursive: true });

    // Use Maestro to record mobile interactions
    const maestroArgs = [
      'record',
      '--output', path.join(sessionDir, 'recording.yaml'),
      '--format', 'yaml'
    ];

    if (session.platform === 'ios') {
      maestroArgs.push('--platform', 'ios');
      if (session.metadata.deviceName) {
        maestroArgs.push('--device', session.metadata.deviceName);
      }
    } else if (session.platform === 'android') {
      maestroArgs.push('--platform', 'android');
      if (session.metadata.deviceName) {
        maestroArgs.push('--device', session.metadata.deviceName);
      }
    }

    if (session.metadata.appId) {
      maestroArgs.push('--app-id', session.metadata.appId);
    }

    const maestroProcess = spawn('maestro', maestroArgs, {
      cwd: sessionDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.recordingProcesses.set(session.id, maestroProcess);

    maestroProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      logger.debug(`Maestro output for ${session.id}: ${output}`);
      
      // Parse Maestro output for real-time action detection
      this.parseMaestroOutput(session, output);
    });

    maestroProcess.stderr?.on('data', (data) => {
      const error = data.toString();
      logger.warn(`Maestro error for ${session.id}: ${error}`);
    });

    maestroProcess.on('exit', (code) => {
      logger.info(`Maestro process for ${session.id} exited with code ${code}`);
      this.recordingProcesses.delete(session.id);
    });

    maestroProcess.on('error', (error) => {
      logger.error(`Maestro process error for ${session.id}:`, error);
      session.status = 'error';
      this.activeSessions.set(session.id, session);
      this.emit('recording:error', { session, error });
    });
  }

  private async startWebRecording(session: RecordingSession): Promise<void> {
    const sessionDir = path.join(this.outputDir, session.id);
    await fs.mkdir(sessionDir, { recursive: true });

    // Use workflow-use to record web interactions
    const workflowArgs = [
      'record',
      '--output', path.join(sessionDir, 'workflow.yaml'),
      '--browser', session.platform
    ];

    if (session.metadata.url) {
      workflowArgs.push('--url', session.metadata.url);
    }

    if (session.metadata.viewport) {
      workflowArgs.push(
        '--viewport', 
        `${session.metadata.viewport.width}x${session.metadata.viewport.height}`
      );
    }

    const workflowProcess = spawn('workflow-use', workflowArgs, {
      cwd: sessionDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.recordingProcesses.set(session.id, workflowProcess);

    workflowProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      logger.debug(`workflow-use output for ${session.id}: ${output}`);
      
      // Parse workflow-use output for real-time action detection
      this.parseWorkflowOutput(session, output);
    });

    workflowProcess.stderr?.on('data', (data) => {
      const error = data.toString();
      logger.warn(`workflow-use error for ${session.id}: ${error}`);
    });

    workflowProcess.on('exit', (code) => {
      logger.info(`workflow-use process for ${session.id} exited with code ${code}`);
      this.recordingProcesses.delete(session.id);
    });

    workflowProcess.on('error', (error) => {
      logger.error(`workflow-use process error for ${session.id}:`, error);
      session.status = 'error';
      this.activeSessions.set(session.id, session);
      this.emit('recording:error', { session, error });
    });
  }

  private parseMaestroOutput(session: RecordingSession, output: string): void {
    try {
      const lines = output.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        if (line.includes('ACTION:')) {
          const actionData = this.extractActionFromMaestroLine(line);
          if (actionData) {
            const action: RecordedAction = {
              id: uuidv4(),
              type: actionData.type || 'tap',
              timestamp: Date.now(),
              ...actionData
            };
            
            session.actions.push(action);
            this.activeSessions.set(session.id, session);
            this.emit('recording:action', { session, action });
          }
        }
      }
    } catch (error) {
      logger.error(`Error parsing Maestro output for ${session.id}:`, error);
    }
  }

  private parseWorkflowOutput(session: RecordingSession, output: string): void {
    try {
      const lines = output.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        if (line.includes('STEP:')) {
          const actionData = this.extractActionFromWorkflowLine(line);
          if (actionData) {
            const action: RecordedAction = {
              id: uuidv4(),
              type: actionData.type || 'tap',
              timestamp: Date.now(),
              ...actionData
            };
            
            session.actions.push(action);
            this.activeSessions.set(session.id, session);
            this.emit('recording:action', { session, action });
          }
        }
      }
    } catch (error) {
      logger.error(`Error parsing workflow-use output for ${session.id}:`, error);
    }
  }

  private extractActionFromMaestroLine(line: string): Omit<RecordedAction, 'id' | 'timestamp'> | null {
    // Parse Maestro output format
    // Example: "ACTION: tap at (100, 200) on Button"
    const tapMatch = line.match(/ACTION: tap at \((\d+), (\d+)\)(?: on (.+))?/);
    if (tapMatch) {
      return {
        type: 'tap',
        coordinates: { x: parseInt(tapMatch[1]), y: parseInt(tapMatch[2]) },
        element: tapMatch[3] || undefined
      };
    }

    const typeMatch = line.match(/ACTION: input text "(.+)"(?: to (.+))?/);
    if (typeMatch) {
      return {
        type: 'type',
        text: typeMatch[1],
        element: typeMatch[2] || undefined
      };
    }

    const swipeMatch = line.match(/ACTION: swipe from \((\d+), (\d+)\) to \((\d+), (\d+)\)/);
    if (swipeMatch) {
      return {
        type: 'scroll',
        coordinates: { x: parseInt(swipeMatch[1]), y: parseInt(swipeMatch[2]) },
        metadata: {
          endCoordinates: { x: parseInt(swipeMatch[3]), y: parseInt(swipeMatch[4]) }
        }
      };
    }

    return null;
  }

  private extractActionFromWorkflowLine(line: string): Omit<RecordedAction, 'id' | 'timestamp'> | null {
    // Parse workflow-use output format
    // Example: "STEP: click on button[data-testid='submit']"
    const clickMatch = line.match(/STEP: click on (.+)/);
    if (clickMatch) {
      return {
        type: 'tap',
        selector: clickMatch[1]
      };
    }

    const typeMatch = line.match(/STEP: type "(.+)" into (.+)/);
    if (typeMatch) {
      return {
        type: 'type',
        text: typeMatch[1],
        selector: typeMatch[2]
      };
    }

    const navigateMatch = line.match(/STEP: navigate to (.+)/);
    if (navigateMatch) {
      return {
        type: 'navigate',
        text: navigateMatch[1]
      };
    }

    return null;
  }

  private async processRecordingData(session: RecordingSession): Promise<void> {
    const sessionDir = path.join(this.outputDir, session.id);
    
    try {
      // Read generated files from recording tools
      if (session.type === 'mobile') {
        const recordingFile = path.join(sessionDir, 'recording.yaml');
        try {
          const content = await fs.readFile(recordingFile, 'utf8');
          const parsedYaml = yaml.load(content) as any;
          
          // Enhance actions with additional metadata from Maestro file
          this.enhanceActionsFromMaestroFile(session, parsedYaml);
        } catch (error) {
          logger.warn(`Could not read Maestro recording file for ${session.id}:`, error);
        }
      } else {
        const workflowFile = path.join(sessionDir, 'workflow.yaml');
        try {
          const content = await fs.readFile(workflowFile, 'utf8');
          const parsedYaml = yaml.load(content) as any;
          
          // Enhance actions with additional metadata from workflow-use file
          this.enhanceActionsFromWorkflowFile(session, parsedYaml);
        } catch (error) {
          logger.warn(`Could not read workflow-use file for ${session.id}:`, error);
        }
      }

      // Collect screenshots and other artifacts
      await this.collectArtifacts(session, sessionDir);
      
    } catch (error) {
      logger.error(`Error processing recording data for ${session.id}:`, error);
      throw error;
    }
  }

  private enhanceActionsFromMaestroFile(session: RecordingSession, maestroData: any): void {
    // Enhance recorded actions with data from the generated Maestro file
    if (Array.isArray(maestroData)) {
      maestroData.forEach((step, index) => {
        if (index < session.actions.length) {
          const action = session.actions[index];
          
          // Add additional metadata from Maestro step
          if (step.tapOn) {
            action.element = step.tapOn.element || step.tapOn.text;
          } else if (step.inputText) {
            action.text = step.inputText;
          } else if (step.assertVisible) {
            action.type = 'assert';
            action.element = step.assertVisible;
          }
        }
      });
    }
  }

  private enhanceActionsFromWorkflowFile(session: RecordingSession, workflowData: any): void {
    // Enhance recorded actions with data from the generated workflow-use file
    if (workflowData.steps && Array.isArray(workflowData.steps)) {
      workflowData.steps.forEach((step: any, index: number) => {
        if (index < session.actions.length) {
          const action = session.actions[index];
          
          // Add additional metadata from workflow step
          if (step.click) {
            action.selector = step.click.selector;
          } else if (step.type) {
            action.text = step.type.text;
            action.selector = step.type.selector;
          } else if (step.navigate) {
            action.type = 'navigate';
            action.text = step.navigate;
          }
        }
      });
    }
  }

  private async collectArtifacts(session: RecordingSession, sessionDir: string): Promise<void> {
    try {
      const files = await fs.readdir(sessionDir);
      
      for (const file of files) {
        const filePath = path.join(sessionDir, file);
        const relativePath = path.relative(this.outputDir, filePath);
        
        if (file.endsWith('.png') || file.endsWith('.jpg')) {
          session.artifacts.screenshots.push(relativePath);
        } else if (file.endsWith('.mp4') || file.endsWith('.mov')) {
          session.artifacts.videos.push(relativePath);
        } else if (file.endsWith('.log')) {
          session.artifacts.logs.push(relativePath);
        }
      }
    } catch (error) {
      logger.warn(`Error collecting artifacts for ${session.id}:`, error);
    }
  }

  getSession(sessionId: string): RecordingSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  getAllSessions(): RecordingSession[] {
    return Array.from(this.activeSessions.values());
  }

  async exportSession(sessionId: string, format: 'maestro' | 'workflow-use' | 'json'): Promise<string> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== 'completed') {
      throw new Error(`Session ${sessionId} is not completed`);
    }

    switch (format) {
      case 'maestro':
        return this.exportToMaestro(session);
      case 'workflow-use':
        return this.exportToWorkflowUse(session);
      case 'json':
        return JSON.stringify(session, null, 2);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private exportToMaestro(session: RecordingSession): string {
    let yaml = `# TestFlow Pro - Generated Maestro Test\n`;
    yaml += `# Recorded: ${session.startTime.toISOString()}\n`;
    yaml += `# Duration: ${session.duration}s\n`;
    
    if (session.metadata.appId) {
      yaml += `appId: ${session.metadata.appId}\n`;
    }
    
    yaml += `---\n`;

    session.actions.forEach((action) => {
      switch (action.type) {
        case 'tap':
          yaml += `- tapOn:\n`;
          if (action.coordinates) {
            yaml += `    point: ${action.coordinates.x},${action.coordinates.y}\n`;
          }
          if (action.element) {
            yaml += `    element: "${action.element}"\n`;
          }
          break;
        case 'type':
          yaml += `- inputText: "${action.text}"\n`;
          break;
        case 'swipe':
          yaml += `- swipe:\n`;
          yaml += `    direction: "up"\n`;
          break;
        case 'assert':
          yaml += `- assertVisible: "${action.element}"\n`;
          break;
        case 'wait':
          yaml += `- waitForAnimationToEnd\n`;
          break;
        case 'screenshot':
          yaml += `- takeScreenshot: "${action.screenshot}"\n`;
          break;
      }
    });

    return yaml;
  }

  private exportToWorkflowUse(session: RecordingSession): string {
    let yaml = `# TestFlow Pro - Generated workflow-use Test\n`;
    yaml += `# Recorded: ${session.startTime.toISOString()}\n`;
    yaml += `# Duration: ${session.duration}s\n`;
    yaml += `name: "Recorded Web Test"\n`;
    
    if (session.metadata.url) {
      yaml += `url: "${session.metadata.url}"\n`;
    }
    
    if (session.metadata.viewport) {
      yaml += `viewport:\n`;
      yaml += `  width: ${session.metadata.viewport.width}\n`;
      yaml += `  height: ${session.metadata.viewport.height}\n`;
    }
    
    yaml += `steps:\n`;

    session.actions.forEach((action) => {
      switch (action.type) {
        case 'tap':
          yaml += `  - click:\n`;
          if (action.selector) {
            yaml += `      selector: "${action.selector}"\n`;
          } else if (action.coordinates) {
            yaml += `      coordinates: [${action.coordinates.x}, ${action.coordinates.y}]\n`;
          }
          break;
        case 'type':
          yaml += `  - type:\n`;
          yaml += `      text: "${action.text}"\n`;
          if (action.selector) {
            yaml += `      selector: "${action.selector}"\n`;
          }
          break;
        case 'navigate':
          yaml += `  - navigate: "${action.text}"\n`;
          break;
        case 'scroll':
          yaml += `  - scroll:\n`;
          yaml += `      direction: "down"\n`;
          break;
        case 'assert':
          yaml += `  - assert:\n`;
          yaml += `      selector: "${action.selector}"\n`;
          yaml += `      visible: true\n`;
          break;
        case 'wait':
          yaml += `  - wait: 2000\n`;
          break;
        case 'screenshot':
          yaml += `  - screenshot: "${action.screenshot}"\n`;
          break;
      }
    });

    return yaml;
  }

  async cleanup(): Promise<void> {
    // Stop all active recordings
    for (const [sessionId, process] of this.recordingProcesses) {
      try {
        process.kill('SIGTERM');
        logger.info(`Stopped recording process for session ${sessionId}`);
      } catch (error) {
        logger.error(`Error stopping process for session ${sessionId}:`, error);
      }
    }
    
    this.recordingProcesses.clear();
    this.activeSessions.clear();
  }
}