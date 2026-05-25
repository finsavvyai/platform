/**
 * AI Step Recorder Service
 * 
 * Allows users to define test steps in natural language.
 * The AI interprets and executes those steps on a real website,
 * recording screenshots, DOM changes, and generated code.
 */

import { EventEmitter } from 'events';
import puppeteer, { Browser, Page } from 'puppeteer';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

// Simple console logger to avoid blocking winston initialization
const logger = {
    info: (...args: any[]) => console.log('[AI-RECORDER]', ...args),
    error: (...args: any[]) => console.error('[AI-RECORDER ERROR]', ...args),
    warn: (...args: any[]) => console.warn('[AI-RECORDER WARN]', ...args),
    debug: (...args: any[]) => console.debug('[AI-RECORDER DEBUG]', ...args),
};

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Types for the AI Step Recorder
export interface StepDefinition {
    id: string;
    description: string;
    order: number;
    expectedOutcome?: string;
}

export interface RecordingSession {
    id: string;
    url: string;
    steps: StepDefinition[];
    status: 'pending' | 'recording' | 'completed' | 'failed';
    createdAt: Date;
    updatedAt: Date;
    executedSteps: ExecutedStep[];
    generatedCode: string;
    screenshots: ScreenshotCapture[];
    errors: RecordingError[];
}

export interface ExecutedStep {
    stepId: string;
    description: string;
    action: StepAction;
    selector?: string;
    value?: string;
    screenshot?: string;
    timestamp: Date;
    duration: number;
    status: 'success' | 'failed' | 'skipped';
    error?: string;
}

export interface StepAction {
    type: 'click' | 'type' | 'navigate' | 'wait' | 'scroll' | 'hover' | 'select' | 'assert' | 'screenshot';
    target?: string;
    value?: string;
    options?: Record<string, any>;
}

export interface ScreenshotCapture {
    stepId: string;
    timestamp: Date;
    base64: string;
    filename: string;
}

export interface RecordingError {
    stepId: string;
    message: string;
    timestamp: Date;
    recoverable: boolean;
}

export interface AIStepRecorderConfig {
    headless?: boolean;
    timeout?: number;
    viewportWidth?: number;
    viewportHeight?: number;
    captureScreenshots?: boolean;
    generatePlaywrightCode?: boolean;
    slowMo?: number;
}

const defaultConfig: AIStepRecorderConfig = {
    headless: false,
    timeout: 30000,
    viewportWidth: 1920,
    viewportHeight: 1080,
    captureScreenshots: true,
    generatePlaywrightCode: true,
    slowMo: 100,
};

export class AIStepRecorderService extends EventEmitter {
    private openai: OpenAI | null = null;
    private activeSessions = new Map<string, RecordingSession>();
    private browsers = new Map<string, Browser>();
    private pages = new Map<string, Page>();

    constructor() {
        super();
        // Only initialize OpenAI if API key is available
        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey && apiKey.length > 10) {
            this.openai = new OpenAI({ apiKey });
            logger.info('OpenAI client initialized successfully');
        } else {
            logger.warn('OPENAI_API_KEY not set - AI features will be limited');
        }
    }

    /**
     * Create a new recording session with natural language steps
     */
    async createSession(
        url: string,
        stepsText: string[],
        config: AIStepRecorderConfig = {}
    ): Promise<RecordingSession> {
        const sessionId = uuidv4();
        const mergedConfig = { ...defaultConfig, ...config };

        // Parse natural language steps into structured format
        const steps: StepDefinition[] = stepsText.map((text, index) => ({
            id: uuidv4(),
            description: text,
            order: index + 1,
        }));

        const session: RecordingSession = {
            id: sessionId,
            url,
            steps,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
            executedSteps: [],
            generatedCode: '',
            screenshots: [],
            errors: [],
        };

        this.activeSessions.set(sessionId, session);

        logger.info(`AI Step Recorder session created: ${sessionId}`, {
            url,
            stepCount: steps.length,
        });

        this.emit('session:created', { sessionId, session });

        return session;
    }

    /**
     * Start recording and executing the defined steps
     */
    async startRecording(
        sessionId: string,
        config: AIStepRecorderConfig = {}
    ): Promise<RecordingSession> {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        const mergedConfig = { ...defaultConfig, ...config };

        try {
            session.status = 'recording';
            session.updatedAt = new Date();
            this.emit('session:started', { sessionId });

            // Launch browser
            const browser = await puppeteer.launch({
                headless: mergedConfig.headless,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    `--window-size=${mergedConfig.viewportWidth},${mergedConfig.viewportHeight}`,
                ],
                slowMo: mergedConfig.slowMo,
            });

            this.browsers.set(sessionId, browser);

            // Create page
            const page = await browser.newPage();
            await page.setViewport({
                width: mergedConfig.viewportWidth!,
                height: mergedConfig.viewportHeight!,
            });

            this.pages.set(sessionId, page);

            // Navigate to URL
            logger.info(`Navigating to ${session.url}`);
            await page.goto(session.url, { waitUntil: 'networkidle0', timeout: mergedConfig.timeout });

            // Take initial screenshot
            if (mergedConfig.captureScreenshots) {
                const screenshot = await this.captureScreenshot(sessionId, page, 'initial');
                session.screenshots.push(screenshot);
            }

            // Execute each step
            for (const step of session.steps) {
                try {
                    const executedStep = await this.executeStep(sessionId, step, page, mergedConfig);
                    session.executedSteps.push(executedStep);
                    session.updatedAt = new Date();

                    this.emit('step:executed', { sessionId, step: executedStep });
                } catch (error: any) {
                    const recordingError: RecordingError = {
                        stepId: step.id,
                        message: error.message,
                        timestamp: new Date(),
                        recoverable: false,
                    };
                    session.errors.push(recordingError);
                    session.executedSteps.push({
                        stepId: step.id,
                        description: step.description,
                        action: { type: 'click' },
                        timestamp: new Date(),
                        duration: 0,
                        status: 'failed',
                        error: error.message,
                    });

                    this.emit('step:failed', { sessionId, stepId: step.id, error: error.message });

                    logger.error(`Step failed: ${step.description}`, error);
                }
            }

            // Generate Playwright code
            if (mergedConfig.generatePlaywrightCode) {
                session.generatedCode = await this.generatePlaywrightCode(session);
            }

            session.status = 'completed';
            session.updatedAt = new Date();

            this.emit('session:completed', { sessionId, session });

            return session;
        } catch (error: any) {
            session.status = 'failed';
            session.errors.push({
                stepId: 'session',
                message: error.message,
                timestamp: new Date(),
                recoverable: false,
            });

            this.emit('session:failed', { sessionId, error: error.message });

            throw error;
        } finally {
            // Cleanup
            await this.cleanupSession(sessionId);
        }
    }

    /**
     * Use AI to interpret a natural language step and convert it to an action
     */
    private async interpretStep(step: StepDefinition, pageContext: string): Promise<StepAction> {
        const systemPrompt = `You are a test automation expert. Convert natural language test steps into specific browser actions.

Return a JSON object with the following structure:
{
    "type": "click" | "type" | "navigate" | "wait" | "scroll" | "hover" | "select" | "assert" | "screenshot",
    "target": "CSS selector or description of the element",
    "value": "text to type or value to select (if applicable)",
    "options": { additional options like timeout, force, etc. }
}

Consider the current page context when determining selectors.
Use robust selectors like data-testid, aria-label, or text content when possible.`;

        const userPrompt = `Step: "${step.description}"

Current page context (simplified HTML):
${pageContext.substring(0, 4000)}

Return ONLY the JSON object, no explanation.`;

        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.2,
                max_tokens: 500,
            });

            const content = response.choices[0].message.content || '{}';
            // Extract JSON from potential markdown code blocks
            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
            const jsonStr = jsonMatch[1] || content;

            return JSON.parse(jsonStr.trim());
        } catch (error: any) {
            logger.error('Failed to interpret step with AI', error);
            // Return a default action if AI fails
            return {
                type: 'click',
                target: step.description,
            };
        }
    }

    /**
     * Execute a single step on the page
     */
    private async executeStep(
        sessionId: string,
        step: StepDefinition,
        page: Page,
        config: AIStepRecorderConfig
    ): Promise<ExecutedStep> {
        const startTime = Date.now();

        logger.info(`Executing step: ${step.description}`);

        // Get page context for AI interpretation
        const pageContext = await page.evaluate(() => {
            const body = document.body;
            const elements: string[] = [];

            // Get interactive elements
            const interactiveSelector = 'a, button, input, select, textarea, [role="button"], [onclick]';
            document.querySelectorAll(interactiveSelector).forEach((el, i) => {
                if (i < 50) { // Limit to 50 elements
                    const tagName = el.tagName.toLowerCase();
                    const id = el.id ? `#${el.id}` : '';
                    const classes = el.className ? `.${el.className.split(' ').join('.')}` : '';
                    const text = (el as HTMLElement).innerText?.substring(0, 50);
                    const placeholder = (el as HTMLInputElement).placeholder || '';
                    const type = (el as HTMLInputElement).type || '';
                    const name = (el as HTMLInputElement).name || '';
                    const ariaLabel = el.getAttribute('aria-label') || '';
                    const testId = el.getAttribute('data-testid') || '';

                    elements.push(`<${tagName}${id}${classes} text="${text}" placeholder="${placeholder}" type="${type}" name="${name}" aria-label="${ariaLabel}" data-testid="${testId}">`);
                }
            });

            return elements.join('\n');
        });

        // Use AI to interpret the step
        const action = await this.interpretStep(step, pageContext);
        let selector: string | undefined;
        let executedValue: string | undefined;

        try {
            switch (action.type) {
                case 'click':
                    selector = await this.findBestSelector(page, action.target || step.description);
                    await page.click(selector);
                    break;

                case 'type':
                    selector = await this.findBestSelector(page, action.target || step.description);
                    await page.click(selector);
                    await page.type(selector, action.value || '', { delay: 50 });
                    executedValue = action.value;
                    break;

                case 'navigate':
                    await page.goto(action.value || '', { waitUntil: 'networkidle0', timeout: config.timeout });
                    executedValue = action.value;
                    break;

                case 'wait':
                    const waitTime = parseInt(action.value || '1000', 10);
                    await delay(waitTime);
                    executedValue = action.value;
                    break;

                case 'scroll':
                    if (action.target) {
                        selector = await this.findBestSelector(page, action.target);
                        await page.evaluate((sel) => {
                            document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth' });
                        }, selector);
                    } else {
                        await page.evaluate(() => {
                            window.scrollBy(0, 300);
                        });
                    }
                    break;

                case 'hover':
                    selector = await this.findBestSelector(page, action.target || step.description);
                    await page.hover(selector);
                    break;

                case 'select':
                    selector = await this.findBestSelector(page, action.target || step.description);
                    await page.select(selector, action.value || '');
                    executedValue = action.value;
                    break;

                case 'assert':
                    const assertSelector = await this.findBestSelector(page, action.target || step.description);
                    const exists = await page.$(assertSelector);
                    if (!exists) {
                        throw new Error(`Assertion failed: Element not found - ${action.target}`);
                    }
                    break;

                case 'screenshot':
                    // Just take screenshot below
                    break;
            }

            // Wait for any navigation or network activity to settle
            await delay(500);

            // Capture screenshot after step
            let screenshot: string | undefined;
            if (config.captureScreenshots) {
                const capture = await this.captureScreenshot(sessionId, page, step.id);
                const session = this.activeSessions.get(sessionId);
                session?.screenshots.push(capture);
                screenshot = capture.filename;
            }

            const duration = Date.now() - startTime;

            return {
                stepId: step.id,
                description: step.description,
                action,
                selector,
                value: executedValue,
                screenshot,
                timestamp: new Date(),
                duration,
                status: 'success',
            };
        } catch (error: any) {
            const duration = Date.now() - startTime;
            throw new Error(`Step "${step.description}" failed: ${error.message}`);
        }
    }

    /**
     * Find the best CSS selector for an element based on description
     */
    private async findBestSelector(page: Page, description: string): Promise<string> {
        // Try common patterns first
        const patterns = [
            // By text content
            `text="${description}"`,
            `text/${description}/i`,
            // By aria-label
            `[aria-label="${description}"]`,
            `[aria-label*="${description}" i]`,
            // By placeholder
            `[placeholder="${description}"]`,
            `[placeholder*="${description}" i]`,
            // By data-testid
            `[data-testid="${description}"]`,
            `[data-testid*="${description}" i]`,
            // By name
            `[name="${description}"]`,
            // By id
            `#${description.replace(/\s+/g, '-').toLowerCase()}`,
            // By button text
            `button:has-text("${description}")`,
            // By link text  
            `a:has-text("${description}")`,
        ];

        // Try each pattern
        for (const pattern of patterns) {
            try {
                const element = await page.$(pattern);
                if (element) {
                    return pattern;
                }
            } catch {
                // Pattern didn't work, try next
            }
        }

        // Use AI to find the selector as fallback
        const pageContent = await page.content();
        const aiSelector = await this.getAISelector(description, pageContent.substring(0, 6000));

        const element = await page.$(aiSelector);
        if (element) {
            return aiSelector;
        }

        throw new Error(`Could not find element matching: ${description}`);
    }

    /**
     * Use AI to suggest a CSS selector
     */
    private async getAISelector(description: string, pageContent: string): Promise<string> {
        const prompt = `Given this HTML page content and description, provide ONLY the CSS selector (no explanation):

Description: "${description}"

HTML (truncated):
${pageContent}

Return ONLY the CSS selector, nothing else.`;

        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0,
                max_tokens: 100,
            });

            return response.choices[0].message.content?.trim() || description;
        } catch {
            return description;
        }
    }

    /**
     * Capture a screenshot and return the capture info
     */
    private async captureScreenshot(
        sessionId: string,
        page: Page,
        stepId: string
    ): Promise<ScreenshotCapture> {
        const screenshot = await page.screenshot({ encoding: 'base64', fullPage: false });
        const filename = `${sessionId}_${stepId}_${Date.now()}.png`;

        return {
            stepId,
            timestamp: new Date(),
            base64: screenshot,
            filename,
        };
    }

    /**
     * Generate Playwright test code from executed steps
     */
    private async generatePlaywrightCode(session: RecordingSession): Promise<string> {
        const steps = session.executedSteps.filter(s => s.status === 'success');

        const systemPrompt = `You are a Playwright test code generator. Generate clean, readable Playwright test code from recorded steps.

Use modern Playwright patterns:
- import { test, expect } from '@playwright/test'
- Use page.getByRole(), page.getByText(), page.getByLabel() when possible
- Add meaningful test names and comments
- Include proper waits and assertions`;

        const userPrompt = `Generate Playwright test code for these recorded steps:

URL: ${session.url}

Steps:
${steps.map((s, i) => `${i + 1}. ${s.description}
   - Action: ${s.action.type}
   - Selector: ${s.selector || 'N/A'}
   - Value: ${s.value || 'N/A'}`).join('\n\n')}

Generate a complete, runnable test file.`;

        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.2,
                max_tokens: 2000,
            });

            let code = response.choices[0].message.content || '';
            // Extract code from markdown if present
            const codeMatch = code.match(/```(?:typescript|javascript)?\s*([\s\S]*?)```/);
            if (codeMatch) {
                code = codeMatch[1];
            }

            return code.trim();
        } catch (error: any) {
            logger.error('Failed to generate Playwright code', error);
            return this.generateBasicPlaywrightCode(session);
        }
    }

    /**
     * Generate basic Playwright code as fallback
     */
    private generateBasicPlaywrightCode(session: RecordingSession): string {
        const steps = session.executedSteps.filter(s => s.status === 'success');

        let code = `import { test, expect } from '@playwright/test';

test('${session.url} - Recorded Test', async ({ page }) => {
  // Navigate to the page
  await page.goto('${session.url}');
  
`;

        for (const step of steps) {
            code += `  // ${step.description}\n`;

            switch (step.action.type) {
                case 'click':
                    code += `  await page.click('${step.selector}');\n`;
                    break;
                case 'type':
                    code += `  await page.fill('${step.selector}', '${step.value}');\n`;
                    break;
                case 'navigate':
                    code += `  await page.goto('${step.value}');\n`;
                    break;
                case 'wait':
                    code += `  await page.waitForTimeout(${step.value});\n`;
                    break;
                case 'hover':
                    code += `  await page.hover('${step.selector}');\n`;
                    break;
                case 'select':
                    code += `  await page.selectOption('${step.selector}', '${step.value}');\n`;
                    break;
            }
            code += '\n';
        }

        code += '});\n';

        return code;
    }

    /**
     * Get session by ID
     */
    getSession(sessionId: string): RecordingSession | undefined {
        return this.activeSessions.get(sessionId);
    }

    /**
     * Get all active sessions
     */
    getAllSessions(): RecordingSession[] {
        return Array.from(this.activeSessions.values());
    }

    /**
     * Cleanup session resources
     */
    private async cleanupSession(sessionId: string): Promise<void> {
        const browser = this.browsers.get(sessionId);
        if (browser) {
            await browser.close().catch(() => { });
            this.browsers.delete(sessionId);
        }
        this.pages.delete(sessionId);
    }

    /**
     * Cancel a running session
     */
    async cancelSession(sessionId: string): Promise<void> {
        const session = this.activeSessions.get(sessionId);
        if (session) {
            session.status = 'failed';
            session.errors.push({
                stepId: 'session',
                message: 'Session cancelled by user',
                timestamp: new Date(),
                recoverable: false,
            });
        }
        await this.cleanupSession(sessionId);
        this.emit('session:cancelled', { sessionId });
    }

    /**
     * Delete a session
     */
    deleteSession(sessionId: string): boolean {
        return this.activeSessions.delete(sessionId);
    }
}

// Export singleton instance
export const aiStepRecorderService = new AIStepRecorderService();
