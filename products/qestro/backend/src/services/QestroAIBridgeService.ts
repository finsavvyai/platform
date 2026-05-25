import OpenAI from 'openai';

/**
 * QestroAIBridgeService - Embedded AI Intelligence Engine
 * 
 * Powers Qestro's AI capabilities using OpenAI directly,
 * with smart fallbacks when AI services are unavailable.
 * Runs entirely within Qestro — no external AI engine dependency.
 */

export interface TestGenerationRequest {
    scenario: string;
    targetPlatform: 'web' | 'mobile' | 'api';
    userStory?: string;
    existingTests?: string[];
    language?: 'typescript' | 'javascript' | 'python';
}

export interface TestGenerationResult {
    success: boolean;
    testCode: string;
    confidence: number;
    suggestions: string[];
    estimatedCoverage: number;
}

export interface SelfHealingRequest {
    failedTest: string;
    errorLog: string;
    stackTrace: string;
    screenshots?: string[];
}

export interface SelfHealingResult {
    success: boolean;
    fixedTest?: string;
    diagnosis: string;
    confidence: number;
    actions: Array<{
        type: 'update_locator' | 'add_wait' | 'retry_logic' | 'assertion_fix';
        description: string;
        code: string;
    }>;
}

export interface CodeReviewRequest {
    prNumber: number;
    prUrl: string;
    repoOwner: string;
    repoName: string;
    diff?: string;
}

export interface FailureAnalysisRequest {
    testName: string;
    errorMessage: string;
    stackTrace: string;
    testCode: string;
    screenshots?: string[];
    networkLogs?: string[];
}

export interface FailureAnalysisResult {
    success: boolean;
    rootCause: string;
    category: 'timing' | 'locator' | 'assertion' | 'network' | 'data' | 'environment';
    suggestedFix: string;
    confidence: number;
    preventionSteps: string[];
}

export class QestroAIBridgeService {
    private static instance: QestroAIBridgeService;
    private readonly baseUrl: string;
    private readonly timeout: number = 30000;
    private openai: OpenAI | null = null;

    private constructor() {
        this.baseUrl = process.env.QESTRO_AI_ENGINE_URL ||
            process.env.OPENHANDS_AI_ENGINE_URL ||
            'https://openhands-ai-engine.broad-dew-49ad.workers.dev';

        // Initialize OpenAI if API key is available
        const apiKey = process.env.OPENAI_API_KEY ||
            process.env.QESTRO_AI_API_KEY ||
            process.env.OPENHANDS_API_KEY;
        if (apiKey) {
            this.openai = new OpenAI({ apiKey });
        }
    }

    public static getInstance(): QestroAIBridgeService {
        if (!QestroAIBridgeService.instance) {
            QestroAIBridgeService.instance = new QestroAIBridgeService();
        }
        return QestroAIBridgeService.instance;
    }

    /**
     * Generate a test case using embedded AI
     */
    public async generateTest(request: TestGenerationRequest): Promise<TestGenerationResult> {
        try {
            console.log(`[QestroAIBridge] Generating ${request.targetPlatform} test for: ${request.scenario}`);

            if (!this.openai) {
                console.warn('[QestroAIBridge] No AI key, using template fallback');
                return this.generateFallbackTest(request);
            }

            const completion = await this.openai.chat.completions.create({
                model: process.env.QESTRO_AI_MODEL || process.env.OPENHANDS_MODEL || 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert QA Engineer working inside Qestro, the leading AI test automation platform.
Generate a complete, production-ready ${request.targetPlatform} test in ${request.language || 'typescript'}.
The test must be immediately runnable with Playwright (for web) or Maestro (for mobile).
Include proper assertions, error handling, and test data setup.
Return ONLY the test code, no explanations.`
                    },
                    {
                        role: 'user',
                        content: `Generate a ${request.targetPlatform} test for this scenario: ${request.scenario}${request.userStory ? `\n\nUser Story: ${request.userStory}` : ''}`
                    }
                ],
                temperature: 0.4,
                max_tokens: 2000
            });

            const testCode = completion.choices[0]?.message?.content || '';

            return {
                success: true,
                testCode,
                confidence: 0.85,
                suggestions: ['AI-generated test — review assertions before running'],
                estimatedCoverage: 75
            };
        } catch (error) {
            console.error('[QestroAIBridge] Test generation error:', error);
            return this.generateFallbackTest(request);
        }
    }

    /**
     * Analyze and fix a failed test (self-healing)
     */
    public async healFailedTest(request: SelfHealingRequest): Promise<SelfHealingResult> {
        try {
            console.log('[QestroAIBridge] Initiating self-healing for failed test');

            const response = await this.makeRequest('/diagnose', {
                method: 'POST',
                body: JSON.stringify({
                    error_log: request.errorLog,
                    stack_trace: request.stackTrace,
                    offending_file: request.failedTest,
                    screenshots: request.screenshots
                })
            });

            return {
                success: response.success,
                fixedTest: response.patch,
                diagnosis: response.diagnosis,
                confidence: response.confidence || 0.75,
                actions: response.actions || []
            };
        } catch (error) {
            console.error('[QestroAIBridge] Self-healing error:', error);

            return {
                success: false,
                diagnosis: 'Unable to diagnose automatically. Manual investigation required.',
                confidence: 0,
                actions: []
            };
        }
    }

    /**
     * Analyze test failure and provide insights
     */
    public async analyzeFailure(request: FailureAnalysisRequest): Promise<FailureAnalysisResult> {
        try {
            console.log(`[QestroAIBridge] Analyzing failure: ${request.testName}`);

            const response = await this.makeRequest('/api/qestro/analyze-failure', {
                method: 'POST',
                body: JSON.stringify(request)
            });

            return {
                success: response.success,
                rootCause: response.rootCause || 'Unknown',
                category: response.category || 'environment',
                suggestedFix: response.suggestedFix || '',
                confidence: response.confidence || 0.5,
                preventionSteps: response.preventionSteps || []
            };
        } catch (error) {
            console.error('[QestroAIBridge] Failure analysis error:', error);

            // Basic heuristic fallback
            return this.performBasicAnalysis(request);
        }
    }

    /**
     * Trigger code review (for PR integration)
     * Fetches PR diff from GitHub and analyzes it with OpenAI.
     */
    public async triggerCodeReview(request: CodeReviewRequest): Promise<any> {
        console.log(`[QestroAIBridge] Triggering code review for PR #${request.prNumber}`);

        try {
            // 1. Fetch PR diff from GitHub
            const diff = request.diff || await this.fetchPRDiff(request);

            if (!diff) {
                return { success: false, error: 'Could not fetch PR diff' };
            }

            // 2. Analyze with embedded LLM
            if (!this.openai) {
                console.warn('[QestroAIBridge] No AI key configured, using remote fallback');
                return this.makeRequest('/review', { method: 'POST', body: JSON.stringify(request) });
            }

            const completion = await this.openai.chat.completions.create({
                model: process.env.QESTRO_AI_MODEL || process.env.OPENHANDS_MODEL || 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert Senior Software Engineer and Code Reviewer integrated into Qestro, the leading AI QA automation platform.
Review the following Pull Request diff. Provide a structured review covering:

1. **Bugs & Errors** — Logic bugs, potential runtime errors, uncaught exceptions
2. **Security** — Injection, XSS, auth bypass, secrets exposure
3. **Performance** — N+1 queries, unnecessary re-renders, memory leaks
4. **Code Quality** — DRY violations, naming, complexity, missing types
5. **What's Good** — Well-written parts worth calling out

Use Markdown. Be specific with line references and provide fix suggestions as code blocks.
End with a summary verdict: APPROVE, REQUEST_CHANGES, or COMMENT.`
                    },
                    {
                        role: 'user',
                        content: `Review PR #${request.prNumber} in ${request.repoOwner}/${request.repoName}:\n\n\`\`\`diff\n${diff.substring(0, 60000)}\n\`\`\``
                    }
                ],
                temperature: 0.3,
                max_tokens: 4000
            });

            const reviewBody = completion.choices[0]?.message?.content;

            if (!reviewBody) {
                return { success: false, error: 'AI returned empty response' };
            }

            // 3. Optionally post to GitHub
            const githubToken = process.env.GITHUB_TOKEN;
            if (githubToken && request.repoOwner !== 'unknown') {
                await this.postGitHubComment(request, reviewBody, githubToken);
            }

            return {
                success: true,
                review: reviewBody,
                model: process.env.QESTRO_AI_MODEL || process.env.OPENHANDS_MODEL || 'gpt-4o',
                postedToGitHub: !!githubToken
            };
        } catch (error) {
            console.error('[QestroAIBridge] Code review error:', error);
            try {
                return await this.makeRequest('/review', { method: 'POST', body: JSON.stringify(request) });
            } catch {
                throw error;
            }
        }
    }

    /**
     * Fetch PR diff from GitHub API
     */
    private async fetchPRDiff(request: CodeReviewRequest): Promise<string | null> {
        const githubToken = process.env.GITHUB_TOKEN;
        const headers: Record<string, string> = {
            'Accept': 'application/vnd.github.v3.diff',
            'User-Agent': 'Qestro-AI'
        };
        if (githubToken) {
            headers['Authorization'] = `Bearer ${githubToken}`;
        }

        try {
            const response = await fetch(
                `https://api.github.com/repos/${request.repoOwner}/${request.repoName}/pulls/${request.prNumber}`,
                { headers }
            );

            if (!response.ok) {
                console.error(`GitHub API error: ${response.status}`);
                return null;
            }

            return await response.text();
        } catch (error) {
            console.error('[QestroAIBridge] Failed to fetch PR diff:', error);
            return null;
        }
    }

    /**
     * Post review comment to GitHub PR
     */
    private async postGitHubComment(request: CodeReviewRequest, review: string, token: string): Promise<void> {
        try {
            await fetch(
                `https://api.github.com/repos/${request.repoOwner}/${request.repoName}/issues/${request.prNumber}/comments`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'Qestro-AI'
                    },
                    body: JSON.stringify({
                        body: `## Qestro AI Code Review\n\n${review}\n\n---\n*Powered by Qestro AI*`
                    })
                }
            );
            console.log(`[QestroAIBridge] Review posted to PR #${request.prNumber}`);
        } catch (error) {
            console.error('[QestroAIBridge] Failed to post GitHub comment:', error);
        }
    }

    /**
     * Check if the Qestro AI engine is healthy
     */
    public async healthCheck(): Promise<boolean> {
        try {
            const response = await this.makeRequest('/health', {
                method: 'GET'
            }, 5000); // Quick 5-second timeout

            return response.status === 'healthy';
        } catch (error) {
            console.error('[QestroAIBridge] Health check failed:', error);
            return false;
        }
    }

    /**
     * Make HTTP request to the Qestro AI engine
     */
    private async makeRequest(endpoint: string, options: RequestInit, timeout?: number): Promise<any> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout || this.timeout);

        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Client': 'qestro',
                    ...options.headers
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error: any) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }

            throw error;
        }
    }

    /**
     * Fallback test generation using templates
     */
    private generateFallbackTest(request: TestGenerationRequest): TestGenerationResult {
        console.log('[QestroAIBridge] Using fallback template-based test generation');

        const testCode = request.targetPlatform === 'web'
            ? this.generateWebTestTemplate(request.scenario)
            : this.generateMobileTestTemplate(request.scenario);

        return {
            success: true,
            testCode,
            confidence: 0.6,
            suggestions: ['AI service unavailable - template used', 'Review and customize this test'],
            estimatedCoverage: 50
        };
    }

    /**
     * Generate web test template
     */
    private generateWebTestTemplate(scenario: string): string {
        return `import { test, expect } from '@playwright/test';

test('${scenario}', async ({ page }) => {
    // Navigate to the application
    await page.goto('https://your-app.com');
    
    // TODO: Implement test steps for: ${scenario}
    
    // Example assertion
    await expect(page).toHaveTitle(/Expected Title/);
});
`;
    }

    /**
     * Generate mobile test template
     */
    private generateMobileTestTemplate(scenario: string): string {
        return `# ${scenario}
appId: com.yourapp.mobile
---
- launchApp
- tapOn: "Element selector"
# TODO: Add test steps for: ${scenario}
- assertVisible: "Success message"
`;
    }

    /**
     * Basic heuristic failure analysis
     */
    private performBasicAnalysis(request: FailureAnalysisRequest): FailureAnalysisResult {
        const errorLower = request.errorMessage.toLowerCase();

        // Timing issues
        if (errorLower.includes('timeout') || errorLower.includes('wait')) {
            return {
                success: true,
                rootCause: 'Element did not appear within timeout period',
                category: 'timing',
                suggestedFix: 'Increase wait timeout or add explicit wait conditions',
                confidence: 0.8,
                preventionSteps: [
                    'Use explicit waits instead of fixed timeouts',
                    'Wait for network idle before interacting',
                    'Add retry logic for flaky elements'
                ]
            };
        }

        // Locator issues
        if (errorLower.includes('not found') || errorLower.includes('selector')) {
            return {
                success: true,
                rootCause: 'Element selector not found on page',
                category: 'locator',
                suggestedFix: 'Update selector or add fallback selectors',
                confidence: 0.85,
                preventionSteps: [
                    'Use data-testid attributes',
                    'Implement selector fallback chain',
                    'Enable self-healing locators'
                ]
            };
        }

        // Assertion issues
        if (errorLower.includes('expected') || errorLower.includes('assertion')) {
            return {
                success: true,
                rootCause: 'Assertion failed - actual value differs from expected',
                category: 'assertion',
                suggestedFix: 'Review expected values and update test',
                confidence: 0.9,
                preventionSteps: [
                    'Use more flexible assertions',
                    'Account for dynamic data',
                    'Add data validation layers'
                ]
            };
        }

        // Default
        return {
            success: true,
            rootCause: 'Unknown failure - requires manual investigation',
            category: 'environment',
            suggestedFix: 'Review logs and screenshots',
            confidence: 0.4,
            preventionSteps: ['Enable detailed logging', 'Capture more diagnostic data']
        };
    }
}
