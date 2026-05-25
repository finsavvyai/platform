import { EventEmitter } from 'events';
import puppeteer, { Browser, Page } from 'puppeteer';
import { 
  WebRecordingSession, 
  RecordedAction, 
  WebRecordingConfig, 
  SmartSelector, 
  AIAssertion, 
  ParameterCandidate,
  CloudCredentials,
  ElementInfo
} from '../types/recording.js';
import { logger } from '../utils/logger.js';
import { CloudTestingService } from './CloudTestingService.js';

export class WebRecordingService extends EventEmitter {
  private activeSessions = new Map<string, WebRecordingSession>();
  private browsers = new Map<string, Browser>();
  private cloudTestingService: CloudTestingService;

  constructor() {
    super();
    this.cloudTestingService = new CloudTestingService();
  }

  async startCloudRecording(sessionId: string, config: WebRecordingConfig): Promise<WebRecordingSession> {
    try {
      logger.info(`Starting enhanced cloud recording for session ${sessionId}`);

      // Create cloud session using the cloud testing service
      const cloudSession = await this.cloudTestingService.createCloudSession(sessionId, config);

      const session: WebRecordingSession = {
        id: sessionId,
        type: 'web',
        platform: config.browser || 'chrome',
        status: 'recording',
        startTime: Date.now(),
        actions: [],
        config,
        browser: cloudSession.browser,
        page: cloudSession.page,
        aiSuggestions: [],
        parameters: [],
        visualBaselines: [],
        performanceMetrics: [],
        cloudSession: {
          provider: cloudSession.provider,
          sessionId: cloudSession.sessionId,
          sessionUrl: cloudSession.sessionUrl,
          videoUrl: cloudSession.videoUrl
        }
      };

      // Set up enhanced recording infrastructure
      await this.setupEnhancedRecordingListeners(session.page!, sessionId, config);
      
      // Navigate to initial URL if provided
      if (config.url) {
        await session.page!.goto(config.url, { waitUntil: 'networkidle2' });
        
        // Capture initial performance metrics
        if (config.performance?.collectMetrics) {
          await this.capturePerformanceMetrics(session.page!, sessionId);
        }
        
        // Capture visual baseline if enabled
        if (config.visualTesting?.enableBaselines) {
          await this.captureVisualBaseline(session.page!, sessionId, 'initial_load');
        }
      }

      this.activeSessions.set(sessionId, session);
      this.browsers.set(sessionId, session.browser!);

      this.emit('recording:started', { sessionId, config, cloudSession: session.cloudSession });

      return session;
    } catch (error) {
      logger.error(`Failed to start enhanced cloud recording: ${error}`);
      throw new Error(`Failed to start recording: ${error.message}`);
    }
  }

  async setupEnhancedRecordingListeners(page: Page, sessionId: string, config: WebRecordingConfig): Promise<void> {
    // Inject recording script into every page
    await page.evaluateOnNewDocument(() => {
      // Questro Web Recorder - Injected Script
      class QuestroWebRecorder {
        private recording = false;
        private actions: any[] = [];
        private startTime = Date.now();

        constructor() {
          this.setupEventListeners();
        }

        startRecording() {
          this.recording = true;
          console.log('QUESTRO_EVENT:RECORDING_STARTED', JSON.stringify({ timestamp: Date.now() }));
        }

        stopRecording() {
          this.recording = false;
          console.log('QUESTRO_EVENT:RECORDING_STOPPED', JSON.stringify({ 
            timestamp: Date.now(),
            totalActions: this.actions.length 
          }));
        }

        private setupEventListeners() {
          // Click events
          document.addEventListener('click', (event) => {
            if (!this.recording) return;
            const action = this.createClickAction(event);
            this.recordAction(action);
          }, true);

          // Input events
          document.addEventListener('input', (event) => {
            if (!this.recording) return;
            const action = this.createInputAction(event);
            this.recordAction(action);
          });

          // Form submission
          document.addEventListener('submit', (event) => {
            if (!this.recording) return;
            const action = this.createSubmitAction(event);
            this.recordAction(action);
          });

          // Scroll events (throttled)
          let scrollTimeout: NodeJS.Timeout;
          document.addEventListener('scroll', (event) => {
            if (!this.recording) return;
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
              const action = this.createScrollAction(event);
              this.recordAction(action);
            }, 100);
          });

          // Keyboard events
          document.addEventListener('keydown', (event) => {
            if (!this.recording) return;
            // Only record special keys (Enter, Tab, Escape, etc.)
            if (['Enter', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
              const action = this.createKeyboardAction(event);
              this.recordAction(action);
            }
          });

          // Page navigation
          window.addEventListener('beforeunload', () => {
            if (!this.recording) return;
            const action = {
              type: 'navigation',
              timestamp: Date.now() - this.startTime,
              fromUrl: window.location.href,
              event: 'beforeunload'
            };
            this.recordAction(action);
          });
        }

        private createClickAction(event: MouseEvent): any {
          const element = event.target as HTMLElement;
          return {
            type: 'click',
            timestamp: Date.now() - this.startTime,
            selector: this.generateSelector(element),
            coordinates: { x: event.clientX, y: event.clientY },
            element: this.getElementInfo(element),
            url: window.location.href,
            viewport: { width: window.innerWidth, height: window.innerHeight }
          };
        }

        private createInputAction(event: Event): any {
          const element = event.target as HTMLInputElement;
          return {
            type: 'input',
            timestamp: Date.now() - this.startTime,
            selector: this.generateSelector(element),
            value: element.value,
            element: this.getElementInfo(element),
            url: window.location.href
          };
        }

        private createSubmitAction(event: SubmitEvent): any {
          const form = event.target as HTMLFormElement;
          return {
            type: 'submit',
            timestamp: Date.now() - this.startTime,
            selector: this.generateSelector(form),
            element: this.getElementInfo(form),
            url: window.location.href,
            action: form.action,
            method: form.method
          };
        }

        private createScrollAction(event: Event): any {
          return {
            type: 'scroll',
            timestamp: Date.now() - this.startTime,
            scrollX: window.scrollX,
            scrollY: window.scrollY,
            url: window.location.href
          };
        }

        private createKeyboardAction(event: KeyboardEvent): any {
          const element = event.target as HTMLElement;
          return {
            type: 'keyboard',
            timestamp: Date.now() - this.startTime,
            key: event.key,
            code: event.code,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            metaKey: event.metaKey,
            selector: this.generateSelector(element),
            element: this.getElementInfo(element),
            url: window.location.href
          };
        }

        private generateSelector(element: HTMLElement): any {
          const selectors: string[] = [];

          // Priority 1: ID selector
          if (element.id) {
            selectors.push(`#${element.id}`);
          }

          // Priority 2: Test ID attributes
          const testId = element.getAttribute('data-testid') || 
                        element.getAttribute('data-test') || 
                        element.getAttribute('data-cy') ||
                        element.getAttribute('data-qa');
          if (testId) {
            selectors.push(`[data-testid="${testId}"]`);
          }

          // Priority 3: Aria label
          const ariaLabel = element.getAttribute('aria-label');
          if (ariaLabel) {
            selectors.push(`[aria-label="${ariaLabel}"]`);
          }

          // Priority 4: Name attribute (for form elements)
          const name = element.getAttribute('name');
          if (name) {
            selectors.push(`[name="${name}"]`);
          }

          // Priority 5: Text content for buttons/links
          if (['BUTTON', 'A'].includes(element.tagName) && element.textContent?.trim()) {
            const text = element.textContent.trim().replace(/"/g, '\\"');
            selectors.push(`${element.tagName.toLowerCase()}[text="${text}"]`);
          }

          // Priority 6: CSS path
          selectors.push(this.getCSSPath(element));

          return {
            primary: selectors[0],
            fallbacks: selectors.slice(1)
          };
        }

        private getCSSPath(element: HTMLElement): string {
          const path: string[] = [];
          let current: HTMLElement | null = element;

          while (current && current.nodeType === Node.ELEMENT_NODE) {
            let selector = current.tagName.toLowerCase();

            if (current.id) {
              selector += `#${current.id}`;
              path.unshift(selector);
              break;
            }

            if (current.className) {
              const classes = current.className.split(' ').filter(c => c && !c.includes(' '));
              if (classes.length > 0) {
                selector += `.${classes.join('.')}`;
              }
            }

            // Add nth-child if necessary for uniqueness
            const parent = current.parentElement;
            if (parent) {
              const siblings = Array.from(parent.children);
              const sameTagSiblings = siblings.filter(s => s.tagName === current!.tagName);
              if (sameTagSiblings.length > 1) {
                const index = sameTagSiblings.indexOf(current) + 1;
                selector += `:nth-child(${index})`;
              }
            }

            path.unshift(selector);
            current = current.parentElement;
          }

          return path.join(' > ');
        }

        private getElementInfo(element: HTMLElement): any {
          return {
            tagName: element.tagName,
            type: (element as HTMLInputElement).type || undefined,
            text: element.textContent?.trim() || undefined,
            value: (element as HTMLInputElement).value || undefined,
            placeholder: (element as HTMLInputElement).placeholder || undefined,
            href: (element as HTMLAnchorElement).href || undefined,
            src: (element as HTMLImageElement).src || undefined,
            alt: (element as HTMLImageElement).alt || undefined,
            title: element.title || undefined,
            className: element.className || undefined,
            attributes: this.getRelevantAttributes(element)
          };
        }

        private getRelevantAttributes(element: HTMLElement): Record<string, string> {
          const relevantAttrs = [
            'data-testid', 'data-test', 'data-cy', 'data-qa',
            'aria-label', 'aria-describedby', 'aria-labelledby',
            'role', 'name', 'id', 'class'
          ];
          
          const attrs: Record<string, string> = {};
          relevantAttrs.forEach(attr => {
            const value = element.getAttribute(attr);
            if (value) attrs[attr] = value;
          });
          
          return attrs;
        }

        private recordAction(action: any) {
          this.actions.push(action);
          console.log('QUESTRO_ACTION:', JSON.stringify(action));
        }
      }

      // Initialize recorder
      (window as any).questroRecorder = new QuestroWebRecorder();
    });

    // Listen for console messages from injected script
    page.on('console', async (msg) => {
      const text = msg.text();
      
      if (text.startsWith('QUESTRO_ACTION:')) {
        const actionData = JSON.parse(text.replace('QUESTRO_ACTION:', ''));
        await this.handleRecordedAction(sessionId, actionData);
      } else if (text.startsWith('QUESTRO_EVENT:')) {
        const eventData = JSON.parse(text.split('QUESTRO_EVENT:')[1]);
        this.emit('recording:event', { sessionId, event: eventData });
      }
    });

    // Listen for navigation events
    page.on('framenavigated', async (frame) => {
      if (frame === page.mainFrame()) {
        const navigationAction: RecordedAction = {
          id: `nav_${Date.now()}`,
          type: 'navigation',
          timestamp: Date.now(),
          url: frame.url(),
          element: 'page',
          metadata: {
            fromUrl: frame.url(),
            loadTime: Date.now()
          }
        };
        
        await this.handleRecordedAction(sessionId, navigationAction);
      }
    });

    // Start recording automatically
    await page.evaluate(() => {
      if ((window as any).questroRecorder) {
        (window as any).questroRecorder.startRecording();
      }
    });
  }

  async handleRecordedAction(sessionId: string, action: RecordedAction): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Add unique ID and normalize action
    const normalizedAction: RecordedAction = {
      id: action.id || `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...action
    };

    session.actions.push(normalizedAction);

    // Emit for real-time updates
    this.emit('recording:action', {
      sessionId,
      action: normalizedAction,
      totalActions: session.actions.length
    });

    logger.debug(`Recorded action for session ${sessionId}: ${normalizedAction.type}`);
  }

  async stopCloudRecording(sessionId: string): Promise<WebRecordingSession> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Recording session ${sessionId} not found`);
    }

    try {
      // Stop recording in browser
      if (session.page) {
        await session.page.evaluate(() => {
          if ((window as any).questroRecorder) {
            (window as any).questroRecorder.stopRecording();
          }
        });
      }

      // Close browser
      if (session.browser) {
        await session.browser.close();
      }

      // Update session status
      session.status = 'completed';
      session.endTime = Date.now();
      session.duration = session.endTime - session.startTime;

      // Clean up
      this.activeSessions.delete(sessionId);
      this.browsers.delete(sessionId);

      this.emit('recording:completed', { sessionId, session });

      logger.info(`Cloud recording completed for session ${sessionId} with ${session.actions.length} actions`);

      return session;
    } catch (error) {
      logger.error(`Failed to stop recording ${sessionId}: ${error}`);
      throw error;
    }
  }

  async getRecordingSession(sessionId: string): Promise<WebRecordingSession | null> {
    return this.activeSessions.get(sessionId) || null;
  }

  async listActiveSessions(): Promise<string[]> {
    return Array.from(this.activeSessions.keys());
  }

  async getBrowserScreenshot(sessionId: string): Promise<Buffer | null> {
    const session = this.activeSessions.get(sessionId);
    if (!session?.page) return null;

    try {
      const screenshot = await session.page.screenshot({ 
        type: 'png',
        fullPage: false 
      });
      return Buffer.from(screenshot);
    } catch (error) {
      logger.error(`Failed to take screenshot for session ${sessionId}: ${error}`);
      return null;
    }
  }

  async executeAction(sessionId: string, action: RecordedAction): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session?.page) throw new Error('Session not found');

    try {
      switch (action.type) {
        case 'click':
          await session.page.click(action.selector as string);
          break;
        case 'input':
          await session.page.type(action.selector as string, action.text || '');
          break;
        case 'navigation':
          await session.page.goto(action.url || '');
          break;
        default:
          logger.warn(`Unknown action type: ${action.type}`);
      }
    } catch (error) {
      logger.error(`Failed to execute action: ${error}`);
      throw error;
    }
  }

  // Enhanced methods for AI-powered features
  async capturePerformanceMetrics(page: Page, sessionId: string): Promise<void> {
    try {
      const metrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const paint = performance.getEntriesByType('paint');
        
        return {
          loadTime: navigation.loadEventEnd - navigation.loadEventStart,
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
          largestContentfulPaint: 0, // Would need additional setup for LCP
          cumulativeLayoutShift: 0, // Would need additional setup for CLS
          firstInputDelay: 0 // Would need additional setup for FID
        };
      });

      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.performanceMetrics = session.performanceMetrics || [];
        session.performanceMetrics.push({
          timestamp: Date.now(),
          metrics
        });

        this.emit('performance:captured', { sessionId, metrics });
      }
    } catch (error) {
      logger.error(`Failed to capture performance metrics: ${error}`);
    }
  }

  async captureVisualBaseline(page: Page, sessionId: string, actionId: string): Promise<void> {
    try {
      const screenshot = await page.screenshot({ 
        type: 'png',
        fullPage: false 
      });

      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.visualBaselines = session.visualBaselines || [];
        session.visualBaselines.push({
          actionId,
          baseline: Buffer.from(screenshot).toString('base64'),
          timestamp: Date.now()
        });

        this.emit('visual:baseline_captured', { sessionId, actionId });
      }
    } catch (error) {
      logger.error(`Failed to capture visual baseline: ${error}`);
    }
  }

  async generateAIAssertions(sessionId: string, action: RecordedAction): Promise<AIAssertion[]> {
    const session = this.activeSessions.get(sessionId);
    if (!session?.page) return [];

    try {
      const { AssertionSuggestionService } = await import('./AssertionSuggestionService');
      const assertionService = new AssertionSuggestionService();

      const suggestions = await assertionService.generateAssertionSuggestions(
        session.page,
        action,
        {
          previousActions: session.actions.slice(-5),
          userIntent: 'User interaction during recording'
        }
      );

      // Add suggestions to session
      session.aiSuggestions = session.aiSuggestions || [];
      session.aiSuggestions.push(...suggestions);

      this.emit('ai:assertions_generated', { sessionId, suggestions });

      return suggestions;
    } catch (error) {
      logger.error(`Failed to generate AI assertions: ${error}`);
      return [];
    }
  }

  async detectParameters(sessionId: string): Promise<ParameterCandidate[]> {
    const session = this.activeSessions.get(sessionId);
    if (!session?.page) return [];

    try {
      const { ParameterizationService } = await import('./ParameterizationService');
      const paramService = new ParameterizationService();

      const parameters = await paramService.detectParameters(session.page, session.actions);

      // Add parameters to session
      session.parameters = parameters;

      this.emit('parameters:detected', { sessionId, parameters });

      return parameters;
    } catch (error) {
      logger.error(`Failed to detect parameters: ${error}`);
      return [];
    }
  }

  async generateSmartSelectors(sessionId: string, element: ElementInfo, coordinates?: { x: number; y: number }): Promise<SmartSelector> {
    const session = this.activeSessions.get(sessionId);
    if (!session?.page) throw new Error('Session not found');

    try {
      const { SmartSelectorService } = await import('./SmartSelectorService');
      const selectorService = new SmartSelectorService();

      return await selectorService.generateSmartSelectors(session.page, element, coordinates);
    } catch (error) {
      logger.error(`Failed to generate smart selectors: ${error}`);
      throw error;
    }
  }

  async healSelector(sessionId: string, originalSelector: SmartSelector, element: ElementInfo): Promise<SmartSelector> {
    const session = this.activeSessions.get(sessionId);
    if (!session?.page) throw new Error('Session not found');

    try {
      const { SmartSelectorService } = await import('./SmartSelectorService');
      const selectorService = new SmartSelectorService();

      return await selectorService.healSelector(session.page, originalSelector, element);
    } catch (error) {
      logger.error(`Failed to heal selector: ${error}`);
      throw error;
    }
  }

  async getSessionAnalytics(sessionId: string): Promise<any> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    return {
      sessionId,
      duration: session.endTime ? session.endTime - session.startTime : Date.now() - session.startTime,
      actionCount: session.actions.length,
      aiSuggestionsCount: session.aiSuggestions?.length || 0,
      parametersCount: session.parameters?.length || 0,
      visualBaselinesCount: session.visualBaselines?.length || 0,
      performanceMetricsCount: session.performanceMetrics?.length || 0,
      cloudProvider: session.cloudSession?.provider,
      averageActionInterval: session.actions.length > 1 ? 
        (session.actions[session.actions.length - 1].timestamp - session.actions[0].timestamp) / (session.actions.length - 1) : 0
    };
  }

  async exportEnhancedSession(sessionId: string, format: string): Promise<any> {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const exportData = {
      session: {
        id: session.id,
        type: session.type,
        platform: session.platform,
        config: session.config,
        duration: session.duration,
        cloudProvider: session.cloudSession?.provider
      },
      actions: session.actions,
      aiSuggestions: session.aiSuggestions || [],
      parameters: session.parameters || [],
      visualBaselines: session.visualBaselines || [],
      performanceMetrics: session.performanceMetrics || []
    };

    switch (format) {
      case 'json':
        return exportData;
      case 'yaml':
        const yaml = require('js-yaml');
        return yaml.dump(exportData);
      default:
        return exportData;
    }
  }

  // Missing methods for production tests
  async getAllConnections(): Promise<any[]> {
    return Array.from(this.activeSessions.values()).map(session => ({
      sessionId: session.sessionId,
      status: session.status,
      createdAt: session.createdAt,
      browserType: session.config.browserType || 'chrome'
    }));
  }

  async getActiveTests(): Promise<any[]> {
    return Array.from(this.activeSessions.values())
      .filter(session => session.status === 'recording')
      .map(session => ({
        sessionId: session.sessionId,
        actionsCount: session.actions.length,
        duration: Date.now() - new Date(session.createdAt).getTime()
      }));
  }
}

export const webRecordingService = new WebRecordingService();