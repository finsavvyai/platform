import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import {
  MobileRecordingConfig,
  MobileRecordingSession,
  RecordedAction,
  ElementInfo
} from '../types/recording.js';
import fs from 'fs/promises';
import path from 'path';

export class MobileRecordingService extends EventEmitter {
  private activeSessions = new Map<string, MobileRecordingSession>();
  private recordingProcesses = new Map<string, ChildProcess>();
  private appiumServers = new Map<string, ChildProcess>();
  private recordingsDir = path.join(process.cwd(), 'recordings', 'mobile');

  constructor() {
    super();
    this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.recordingsDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create recordings directory:', error);
    }
  }

  /**
   * Start a mobile recording session
   */
  async startRecording(sessionId: string, config: MobileRecordingConfig): Promise<MobileRecordingSession> {
    try {
      logger.info(`Starting mobile recording for session ${sessionId} on ${config.platform}`);

      // Create session directory
      const sessionDir = path.join(this.recordingsDir, sessionId);
      await fs.mkdir(sessionDir, { recursive: true });

      const session: MobileRecordingSession = {
        id: sessionId,
        type: 'mobile',
        platform: config.platform,
        status: 'recording',
        startTime: Date.now(),
        actions: [],
        config,
        metadata: {
          deviceId: config.deviceId,
          deviceName: config.deviceName,
          osVersion: config.osVersion,
          appId: config.appId,
          simulator: config.simulator,
          sessionDir
        }
      };

      // Start Appium server if not already running
      await this.startAppiumServer(sessionId, config);

      // Start recording infrastructure
      await this.setupRecordingInfrastructure(session);

      this.activeSessions.set(sessionId, session);

      this.emit('recording:started', { sessionId, config });

      return session;
    } catch (error: any) {
      logger.error(`Failed to start mobile recording: ${error.message}`);
      throw new Error(`Failed to start mobile recording: ${error.message}`);
    }
  }

  /**
   * Start Appium server for mobile automation
   */
  private async startAppiumServer(sessionId: string, config: MobileRecordingConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const port = 4723 + Math.floor(Math.random() * 1000); // Random port to avoid conflicts

      const appiumArgs = [
        '--port', port.toString(),
        '--allow-insecure', 'chromedriver_autodownload',
        '--log-level', 'info'
      ];

      if (config.platform === 'ios') {
        appiumArgs.push('--base-path', '/wd/hub');
      }

      const appiumProcess = spawn('appium', appiumArgs, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.appiumServers.set(sessionId, appiumProcess);

      let serverReady = false;

      appiumProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        logger.debug(`Appium server ${sessionId}: ${output}`);

        if (output.includes('Appium REST http interface listener started') && !serverReady) {
          serverReady = true;
          logger.info(`Appium server started for session ${sessionId} on port ${port}`);
          resolve();
        }
      });

      appiumProcess.stderr?.on('data', (data) => {
        logger.warn(`Appium server error ${sessionId}: ${data.toString()}`);
      });

      appiumProcess.on('error', (error) => {
        logger.error(`Appium server process error ${sessionId}:`, error);
        reject(error);
      });

      // Timeout if server doesn't start
      setTimeout(() => {
        if (!serverReady) {
          reject(new Error('Appium server failed to start within timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Setup recording infrastructure for mobile
   */
  private async setupRecordingInfrastructure(session: MobileRecordingSession): Promise<void> {
    const sessionDir = session.metadata?.sessionDir as string;

    if (session.platform === 'ios') {
      await this.setupIOSRecording(session, sessionDir);
    } else if (session.platform === 'android') {
      await this.setupAndroidRecording(session, sessionDir);
    }
  }

  /**
   * Setup iOS recording using xcrun simctl or XCUITest
   */
  private async setupIOSRecording(session: MobileRecordingSession, sessionDir: string): Promise<void> {
    try {
      // Start screen recording on iOS simulator
      if (session.config.simulator) {
        const recordingProcess = spawn('xcrun', [
          'simctl',
          'io',
          session.config.deviceId,
          'recordVideo',
          path.join(sessionDir, 'recording.mp4')
        ]);

        this.recordingProcesses.set(session.id, recordingProcess);

        recordingProcess.on('error', (error) => {
          logger.error(`iOS recording error for ${session.id}:`, error);
        });
      }

      // Setup interaction listener using Appium/WebDriverAgent
      await this.setupIOSInteractionListener(session);

      logger.info(`iOS recording setup completed for session ${session.id}`);
    } catch (error) {
      logger.error(`Failed to setup iOS recording:`, error);
      throw error;
    }
  }

  /**
   * Setup Android recording using adb
   */
  private async setupAndroidRecording(session: MobileRecordingSession, sessionDir: string): Promise<void> {
    try {
      // Start screen recording on Android using adb
      const recordingProcess = spawn('adb', [
        '-s', session.config.deviceId,
        'shell',
        'screenrecord',
        '/sdcard/qestro_recording.mp4'
      ]);

      this.recordingProcesses.set(session.id, recordingProcess);

      recordingProcess.on('error', (error) => {
        logger.error(`Android recording error for ${session.id}:`, error);
      });

      // Setup interaction listener using UIAutomator2
      await this.setupAndroidInteractionListener(session);

      logger.info(`Android recording setup completed for session ${session.id}`);
    } catch (error) {
      logger.error(`Failed to setup Android recording:`, error);
      throw error;
    }
  }

  /**
   * Setup iOS interaction listener
   */
  private async setupIOSInteractionListener(session: MobileRecordingSession): Promise<void> {
    // This would integrate with WebDriverAgent or XCUITest to capture interactions
    // For now, we'll simulate interaction capture

    // In production, this would:
    // 1. Connect to WebDriverAgent
    // 2. Listen for touch events
    // 3. Capture element information
    // 4. Record screenshots at each interaction

    logger.info(`iOS interaction listener setup for session ${session.id}`);
  }

  /**
   * Setup Android interaction listener
   */
  private async setupAndroidInteractionListener(session: MobileRecordingSession): Promise<void> {
    // This would integrate with UIAutomator2 to capture interactions
    // For now, we'll simulate interaction capture

    // In production, this would:
    // 1. Connect to UIAutomator2
    // 2. Listen for touch events
    // 3. Capture element information using accessibility IDs
    // 4. Record screenshots at each interaction

    logger.info(`Android interaction listener setup for session ${session.id}`);
  }

  /**
   * Record a mobile action
   */
  async recordAction(sessionId: string, action: Partial<RecordedAction>): Promise<RecordedAction> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Mobile recording session ${sessionId} not found`);
    }

    const recordedAction: RecordedAction = {
      id: action.id || uuidv4(),
      type: action.type || 'tap',
      timestamp: Date.now(),
      coordinates: action.coordinates,
      text: action.text,
      element: action.element,
      selector: action.selector,
      metadata: {
        ...action.metadata,
        platform: session.platform,
        deviceId: session.config.deviceId
      }
    };

    session.actions.push(recordedAction);
    session.updatedAt = Date.now();

    this.activeSessions.set(sessionId, session);

    // Emit event
    this.emit('action:recorded', { sessionId, action: recordedAction });

    // Capture screenshot
    if (action.type !== 'scroll') {
      await this.captureScreenshot(sessionId, recordedAction.id);
    }

    return recordedAction;
  }

  /**
   * Capture screenshot
   */
  private async captureScreenshot(sessionId: string, actionId: string): Promise<string | null> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    const sessionDir = session.metadata?.sessionDir as string;
    const screenshotPath = path.join(sessionDir, `screenshot_${actionId}.png`);

    try {
      if (session.platform === 'ios' && session.config.simulator) {
        // iOS simulator screenshot
        await this.executeCommand('xcrun', [
          'simctl',
          'io',
          session.config.deviceId,
          'screenshot',
          screenshotPath
        ]);
      } else if (session.platform === 'android') {
        // Android screenshot using adb
        const tempPath = `/sdcard/qestro_screenshot_${actionId}.png`;
        await this.executeCommand('adb', [
          '-s', session.config.deviceId,
          'shell',
          'screencap',
          '-p',
          tempPath
        ]);

        // Pull screenshot from device
        await this.executeCommand('adb', [
          '-s', session.config.deviceId,
          'pull',
          tempPath,
          screenshotPath
        ]);

        // Delete from device
        await this.executeCommand('adb', [
          '-s', session.config.deviceId,
          'shell',
          'rm',
          tempPath
        ]);
      }

      logger.debug(`Screenshot captured for action ${actionId}`);
      return screenshotPath;
    } catch (error) {
      logger.error(`Failed to capture screenshot for ${actionId}:`, error);
      return null;
    }
  }

  /**
   * Stop mobile recording session
   */
  async stopRecording(sessionId: string): Promise<MobileRecordingSession> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Mobile recording session ${sessionId} not found`);
    }

    try {
      // Stop recording process
      const recordingProcess = this.recordingProcesses.get(sessionId);
      if (recordingProcess) {
        recordingProcess.kill('SIGINT');
        this.recordingProcesses.delete(sessionId);
      }

      // Pull recording from Android device if applicable
      if (session.platform === 'android') {
        const sessionDir = session.metadata?.sessionDir as string;
        const videoPath = path.join(sessionDir, 'recording.mp4');

        await this.executeCommand('adb', [
          '-s', session.config.deviceId,
          'pull',
          '/sdcard/qestro_recording.mp4',
          videoPath
        ]);

        await this.executeCommand('adb', [
          '-s', session.config.deviceId,
          'shell',
          'rm',
          '/sdcard/qestro_recording.mp4'
        ]);
      }

      // Stop Appium server
      const appiumServer = this.appiumServers.get(sessionId);
      if (appiumServer) {
        appiumServer.kill('SIGTERM');
        this.appiumServers.delete(sessionId);
      }

      // Update session
      session.status = 'completed';
      session.endTime = Date.now();
      session.duration = session.endTime - session.startTime;

      this.activeSessions.set(sessionId, session);

      logger.info(`Mobile recording stopped for session ${sessionId} with ${session.actions.length} actions`);
      this.emit('recording:completed', { sessionId, session });

      return session;
    } catch (error: any) {
      logger.error(`Failed to stop mobile recording ${sessionId}:`, error);
      session.status = 'failed';
      this.activeSessions.set(sessionId, session);
      throw error;
    }
  }

  /**
   * Get recording session
   */
  getSession(sessionId: string): MobileRecordingSession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): MobileRecordingSession[] {
    return Array.from(this.activeSessions.values())
      .filter(session => session.status === 'recording');
  }

  /**
   * Get all sessions
   */
  getAllSessions(): MobileRecordingSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Export mobile recording to various formats
   */
  async exportSession(sessionId: string, format: 'maestro' | 'appium' | 'xcuitest' | 'espresso' | 'json'): Promise<string> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Mobile recording session ${sessionId} not found`);
    }

    switch (format) {
      case 'maestro':
        return this.exportToMaestro(session);
      case 'appium':
        return this.exportToAppium(session);
      case 'xcuitest':
        return this.exportToXCUITest(session);
      case 'espresso':
        return this.exportToEspresso(session);
      case 'json':
        return JSON.stringify(session, null, 2);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export to Maestro format
   */
  private exportToMaestro(session: MobileRecordingSession): string {
    let yaml = `# Qestro Mobile Recording - Maestro Format\n`;
    yaml += `# Recorded: ${new Date(session.startTime).toISOString()}\n`;
    yaml += `# Platform: ${session.platform}\n`;
    yaml += `# Device: ${session.config.deviceName || session.config.deviceId}\n\n`;

    if (session.config.appId) {
      yaml += `appId: ${session.config.appId}\n`;
    }

    yaml += `---\n`;

    for (const action of session.actions) {
      switch (action.type) {
        case 'tap':
        case 'click':
          yaml += `- tapOn:\n`;
          if (action.coordinates) {
            yaml += `    point: "${action.coordinates.x},${action.coordinates.y}"\n`;
          }
          if (typeof action.element === 'string') {
            yaml += `    text: "${action.element}"\n`;
          } else if (action.element && typeof action.element === 'object') {
            const el = action.element as ElementInfo;
            if (el.text) {
              yaml += `    text: "${el.text}"\n`;
            }
          }
          break;

        case 'input':
          yaml += `- inputText: "${action.text || ''}"\n`;
          break;

        case 'swipe':
          yaml += `- swipe:\n`;
          yaml += `    direction: "${action.metadata?.direction || 'up'}"\n`;
          break;

        case 'scroll':
          yaml += `- scroll\n`;
          break;

        case 'wait':
          yaml += `- waitForAnimationToEnd\n`;
          break;

        case 'assert':
          if (typeof action.element === 'string') {
            yaml += `- assertVisible: "${action.element}"\n`;
          }
          break;

        case 'screenshot':
          yaml += `- takeScreenshot: "${action.screenshot || action.id}"\n`;
          break;
      }
    }

    return yaml;
  }

  /**
   * Export to Appium format (JavaScript/TypeScript)
   */
  private exportToAppium(session: MobileRecordingSession): string {
    let code = `// Qestro Mobile Recording - Appium Format\n`;
    code += `// Recorded: ${new Date(session.startTime).toISOString()}\n`;
    code += `// Platform: ${session.platform}\n\n`;

    code += `const wdio = require('webdriverio');\n\n`;
    code += `describe('Recorded Test', () => {\n`;
    code += `  let driver;\n\n`;
    code += `  before(async () => {\n`;
    code += `    const opts = {\n`;
    code += `      port: 4723,\n`;
    code += `      capabilities: {\n`;
    code += `        platformName: '${session.platform === 'ios' ? 'iOS' : 'Android'}',\n`;
    code += `        'appium:deviceName': '${session.config.deviceName || 'Device'}',\n`;

    if (session.config.appId) {
      code += `        'appium:app': '${session.config.appId}',\n`;
    }

    code += `        'appium:automationName': '${session.platform === 'ios' ? 'XCUITest' : 'UiAutomator2'}'\n`;
    code += `      }\n`;
    code += `    };\n`;
    code += `    driver = await wdio.remote(opts);\n`;
    code += `  });\n\n`;

    code += `  it('should execute recorded actions', async () => {\n`;

    for (const action of session.actions) {
      switch (action.type) {
        case 'tap':
        case 'click':
          if (action.coordinates) {
            code += `    await driver.touchAction({\n`;
            code += `      action: 'tap',\n`;
            code += `      x: ${action.coordinates.x},\n`;
            code += `      y: ${action.coordinates.y}\n`;
            code += `    });\n`;
          }
          break;

        case 'input':
          code += `    const inputElement = await driver.$('${action.selector || '//input'}');\n`;
          code += `    await inputElement.setValue('${action.text || ''}');\n`;
          break;

        case 'swipe':
          code += `    await driver.touchPerform([{\n`;
          code += `      action: 'press',\n`;
          code += `      options: { x: 100, y: 500 }\n`;
          code += `    }, {\n`;
          code += `      action: 'moveTo',\n`;
          code += `      options: { x: 100, y: 100 }\n`;
          code += `    }, {\n`;
          code += `      action: 'release'\n`;
          code += `    }]);\n`;
          break;

        case 'wait':
          code += `    await driver.pause(1000);\n`;
          break;
      }
    }

    code += `  });\n\n`;
    code += `  after(async () => {\n`;
    code += `    await driver.deleteSession();\n`;
    code += `  });\n`;
    code += `});\n`;

    return code;
  }

  /**
   * Export to XCUITest format (Swift)
   */
  private exportToXCUITest(session: MobileRecordingSession): string {
    let code = `// Qestro Mobile Recording - XCUITest Format\n`;
    code += `// Recorded: ${new Date(session.startTime).toISOString()}\n\n`;

    code += `import XCTest\n\n`;
    code += `class RecordedUITests: XCTestCase {\n`;
    code += `    var app: XCUIApplication!\n\n`;
    code += `    override func setUp() {\n`;
    code += `        super.setUp()\n`;
    code += `        continueAfterFailure = false\n`;
    code += `        app = XCUIApplication()\n`;
    code += `        app.launch()\n`;
    code += `    }\n\n`;

    code += `    func testRecordedActions() {\n`;

    for (const action of session.actions) {
      switch (action.type) {
        case 'tap':
        case 'click':
          if (action.coordinates) {
            code += `        let coordinate = app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0))\n`;
            code += `        let point = coordinate.withOffset(CGVector(dx: ${action.coordinates.x}, dy: ${action.coordinates.y}))\n`;
            code += `        point.tap()\n`;
          }
          break;

        case 'input':
          code += `        let textField = app.textFields.element\n`;
          code += `        textField.tap()\n`;
          code += `        textField.typeText("${action.text || ''}")\n`;
          break;

        case 'swipe':
          code += `        app.swipeUp()\n`;
          break;
      }
    }

    code += `    }\n`;
    code += `}\n`;

    return code;
  }

  /**
   * Export to Espresso format (Kotlin)
   */
  private exportToEspresso(session: MobileRecordingSession): string {
    let code = `// Qestro Mobile Recording - Espresso Format\n`;
    code += `// Recorded: ${new Date(session.startTime).toISOString()}\n\n`;

    code += `import androidx.test.ext.junit.runners.AndroidJUnit4\n`;
    code += `import androidx.test.espresso.Espresso.onView\n`;
    code += `import androidx.test.espresso.action.ViewActions.*\n`;
    code += `import androidx.test.espresso.matcher.ViewMatchers.*\n`;
    code += `import org.junit.Test\n`;
    code += `import org.junit.runner.RunWith\n\n`;

    code += `@RunWith(AndroidJUnit4::class)\n`;
    code += `class RecordedTest {\n`;
    code += `    @Test\n`;
    code += `    fun testRecordedActions() {\n`;

    for (const action of session.actions) {
      switch (action.type) {
        case 'tap':
        case 'click':
          code += `        onView(withId(R.id.view)).perform(click())\n`;
          break;

        case 'input':
          code += `        onView(withId(R.id.editText)).perform(typeText("${action.text || ''}"), closeSoftKeyboard())\n`;
          break;

        case 'swipe':
          code += `        onView(withId(R.id.scrollView)).perform(swipeUp())\n`;
          break;
      }
    }

    code += `    }\n`;
    code += `}\n`;

    return code;
  }

  /**
   * Get list of connected iOS devices
   */
  async getIOSDevices(): Promise<any[]> {
    try {
      const { stdout } = await this.executeCommand('xcrun', ['simctl', 'list', 'devices', 'available', '--json']);
      const devices = JSON.parse(stdout);

      const availableDevices: any[] = [];
      for (const runtime in devices.devices) {
        for (const device of devices.devices[runtime]) {
          if (device.state === 'Booted' || device.state === 'Shutdown') {
            availableDevices.push({
              id: device.udid,
              name: device.name,
              state: device.state,
              runtime: runtime,
              simulator: true
            });
          }
        }
      }

      return availableDevices;
    } catch (error) {
      logger.error('Failed to get iOS devices:', error);
      return [];
    }
  }

  /**
   * Get list of connected Android devices
   */
  async getAndroidDevices(): Promise<any[]> {
    try {
      const { stdout } = await this.executeCommand('adb', ['devices', '-l']);
      const lines = stdout.split('\n').slice(1).filter(line => line.trim());

      const devices: any[] = [];
      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length >= 2 && parts[1] === 'device') {
          const deviceId = parts[0];
          const modelMatch = line.match(/model:([^\s]+)/);
          const model = modelMatch ? modelMatch[1] : 'Unknown';

          devices.push({
            id: deviceId,
            name: model,
            state: 'connected',
            simulator: false
          });
        }
      }

      return devices;
    } catch (error) {
      logger.error('Failed to get Android devices:', error);
      return [];
    }
  }

  /**
   * Execute command helper
   */
  private executeCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args);
      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Cleanup and stop all sessions
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up mobile recording service...');

    // Stop all recording processes
    for (const [sessionId, process] of this.recordingProcesses) {
      try {
        process.kill('SIGINT');
        logger.info(`Stopped recording process for session ${sessionId}`);
      } catch (error) {
        logger.error(`Error stopping recording process for ${sessionId}:`, error);
      }
    }

    // Stop all Appium servers
    for (const [sessionId, server] of this.appiumServers) {
      try {
        server.kill('SIGTERM');
        logger.info(`Stopped Appium server for session ${sessionId}`);
      } catch (error) {
        logger.error(`Error stopping Appium server for ${sessionId}:`, error);
      }
    }

    this.recordingProcesses.clear();
    this.appiumServers.clear();
    this.activeSessions.clear();

    logger.info('Mobile recording service cleanup completed');
  }
}

export const mobileRecordingService = new MobileRecordingService();
