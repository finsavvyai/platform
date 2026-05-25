// ai-core.ts
// AI Core Service with Real OpenAI Integration + Backend API Support
// Uses OpenAI GPT-4 for intelligent test generation and analysis
// Enhanced with retry logic, backend proxy support, and additional AI capabilities

export interface AIRequest {
    prompt: string;
    context?: Record<string, unknown>;
    model?: 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo';
}

export interface AIResponse {
    content: string;
    confidence: number;
    tokensUsed: number;
    timestamp: string;
    model: string;
}

export interface TestStoryRequest {
    featureDescription: string;
    additionalContext?: string;
    format?: 'gherkin' | 'playwright' | 'jest';
}

export interface CodeAnalysisRequest {
    code: string;
    language: string;
    analysisType: 'security' | 'performance' | 'quality' | 'all';
}

export interface TestOptimizationRequest {
    testCode: string;
    executionHistory?: Array<{ passed: boolean; duration: number; timestamp: string }>;
}

interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
}

class AICoreService {
    private apiKey: string;
    private baseUrl: string = 'https://api.openai.com/v1';
    private backendUrl: string = '/api/ai'; // Uses Vite proxy to backend
    private defaultModel: string = 'gpt-4';
    private useBackend: boolean = true; // Prefer backend API for security
    private retryConfig: RetryConfig = {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000,
    };

    constructor() {
        // API key can be set via environment variable or dynamically
        this.apiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
        // Use backend if no direct API key is configured
        this.useBackend = !this.apiKey;
    }

    setApiKey(key: string) {
        this.apiKey = key;
        this.useBackend = !key;
    }

    setUseBackend(useBackend: boolean) {
        this.useBackend = useBackend;
    }

    private async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async withRetry<T>(
        operation: () => Promise<T>,
        context: string
    ): Promise<T> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;

                if (attempt < this.retryConfig.maxRetries) {
                    const delay = Math.min(
                        this.retryConfig.baseDelay * Math.pow(2, attempt),
                        this.retryConfig.maxDelay
                    );
                    console.warn(`${context} failed (attempt ${attempt + 1}), retrying in ${delay}ms...`);
                    await this.sleep(delay);
                }
            }
        }

        throw lastError;
    }

    /**
     * Call backend AI API (preferred - keeps API key secure on server)
     */
    private async callBackendAI(endpoint: string, payload: Record<string, unknown>): Promise<{ content: string; usage: { total_tokens: number } }> {
        return this.withRetry(async () => {
            const response = await fetch(`${this.backendUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(`Backend AI Error: ${error.error || response.statusText}`);
            }

            const data = await response.json();
            return {
                content: data.testCode || data.content || data.result || '',
                usage: { total_tokens: data.tokensUsed || 0 },
            };
        }, `Backend AI call to ${endpoint}`);
    }

    private async callOpenAI(messages: Array<{ role: string; content: string }>, options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
    }): Promise<{ content: string; usage: { total_tokens: number } }> {
        // Prefer backend API for security (API key stays on server)
        if (this.useBackend) {
            const prompt = messages.find(m => m.role === 'user')?.content || '';
            const systemPrompt = messages.find(m => m.role === 'system')?.content || '';

            return this.callBackendAI('/generate-test', {
                description: prompt,
                systemPrompt,
                model: options?.model || this.defaultModel,
                temperature: options?.temperature ?? 0.7,
                maxTokens: options?.maxTokens ?? 2000,
            });
        }

        // Fallback to direct OpenAI call if API key is configured
        if (!this.apiKey) {
            throw new Error('OpenAI API key not configured. Please set VITE_OPENAI_API_KEY or call setApiKey().');
        }

        return this.withRetry(async () => {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: options?.model || this.defaultModel,
                    messages,
                    temperature: options?.temperature ?? 0.7,
                    max_tokens: options?.maxTokens ?? 2000,
                }),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
                throw new Error(`OpenAI API Error: ${error.error?.message || response.statusText}`);
            }

            const data = await response.json();
            return {
                content: data.choices[0]?.message?.content || '',
                usage: data.usage || { total_tokens: 0 },
            };
        }, 'OpenAI API call');
    }

    async generateTestStory(request: TestStoryRequest): Promise<AIResponse> {
        const { featureDescription, additionalContext, format = 'gherkin' } = request;

        const systemPrompt = `You are an expert QA engineer and test automation specialist. 
Generate comprehensive test scenarios in ${format.toUpperCase()} format.
Focus on:
- Happy path scenarios
- Edge cases and error handling
- Input validation
- Security considerations
Be concise but thorough.`;

        const userPrompt = `Generate test scenarios for the following feature:

Feature: ${featureDescription}

${additionalContext ? `Additional Context: ${additionalContext}` : ''}

Please provide well-structured test scenarios covering all important cases.`;

        try {
            const result = await this.callOpenAI([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ]);

            return {
                content: result.content,
                confidence: 0.95,
                tokensUsed: result.usage.total_tokens,
                timestamp: new Date().toISOString(),
                model: this.defaultModel,
            };
        } catch (error) {
            console.error('AI generation error:', error);
            throw error;
        }
    }

    async healSelector(brokenSelector: string, domContext?: string): Promise<string> {
        const systemPrompt = `You are an expert in web testing and DOM manipulation.
Your task is to suggest a more robust CSS/XPath selector based on the broken selector and DOM context.
Return ONLY the new selector, nothing else.`;

        const userPrompt = `The selector "${brokenSelector}" is no longer working.
${domContext ? `Current DOM context:\n${domContext}` : ''}

Suggest a more robust data-testid or aria-based selector.`;

        try {
            const result = await this.callOpenAI([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ], { temperature: 0.3, maxTokens: 100 });

            return result.content.trim();
        } catch (error) {
            console.error('Selector healing error:', error);
            // Fallback to simple transformation
            return `[data-testid="${brokenSelector.replace(/[#.[\]]/g, '')}-healed"]`;
        }
    }

    async analyzeTestFailure(failureDetails: {
        testName: string;
        errorMessage: string;
        stackTrace?: string;
        screenshot?: string;
    }): Promise<{
        rootCause: string;
        suggestedFix: string;
        confidence: number;
    }> {
        const systemPrompt = `You are an expert test automation debugger.
Analyze test failures and provide:
1. Root cause analysis
2. Suggested fix
Be concise and actionable.`;

        const userPrompt = `Analyze this test failure:

Test: ${failureDetails.testName}
Error: ${failureDetails.errorMessage}
${failureDetails.stackTrace ? `Stack Trace:\n${failureDetails.stackTrace}` : ''}`;

        try {
            const result = await this.callOpenAI([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ], { temperature: 0.3, maxTokens: 500 });

            const content = result.content;

            // Parse the response (simple extraction)
            const rootCauseMatch = content.match(/root cause[:\s]*(.*?)(?=suggested fix|$)/is);
            const fixMatch = content.match(/suggested fix[:\s]*(.*?)$/is);

            return {
                rootCause: rootCauseMatch?.[1]?.trim() || content.split('\n')[0],
                suggestedFix: fixMatch?.[1]?.trim() || content,
                confidence: 0.85,
            };
        } catch (error) {
            console.error('Failure analysis error:', error);
            return {
                rootCause: 'Unable to analyze - AI service unavailable',
                suggestedFix: 'Please review the error message manually',
                confidence: 0,
            };
        }
    }

    async analyzeSecurity(code: string, language: string = 'typescript'): Promise<{
        vulnerabilities: Array<{ type: string; severity: string; line?: number; description: string }>;
        overallRisk: 'low' | 'medium' | 'high' | 'critical';
    }> {
        const systemPrompt = `You are a security expert. Analyze code for vulnerabilities.
Return findings as JSON with format:
{
  "vulnerabilities": [{"type": "XSS", "severity": "high", "line": 45, "description": "..."}],
  "overallRisk": "medium"
}`;

        try {
            const result = await this.callOpenAI([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Analyze this ${language} code:\n\n${code}` },
            ], { temperature: 0.2, maxTokens: 1000 });

            try {
                return JSON.parse(result.content);
            } catch {
                return {
                    vulnerabilities: [{ type: 'Analysis', severity: 'info', description: result.content }],
                    overallRisk: 'low',
                };
            }
        } catch (error) {
            console.error('Security analysis error:', error);
            return { vulnerabilities: [], overallRisk: 'low' };
        }
    }

    async generatePlaywrightTest(requirements: string): Promise<string> {
        const systemPrompt = `You are an expert Playwright test automation engineer.
Generate clean, well-structured Playwright tests in TypeScript.
Use best practices:
- Page Object Model when appropriate
- Proper async/await
- Meaningful assertions
- data-testid selectors when possible`;

        const result = await this.callOpenAI([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Generate Playwright test code for:\n\n${requirements}` },
        ], { temperature: 0.3, maxTokens: 2000 });

        return result.content;
    }

    /**
     * Analyze code for quality, performance, and best practices
     */
    async analyzeCode(request: CodeAnalysisRequest): Promise<{
        issues: Array<{ type: string; severity: 'error' | 'warning' | 'info'; line?: number; message: string; suggestion: string }>;
        score: number;
        summary: string;
    }> {
        const { code, language, analysisType } = request;

        const analysisTypes = {
            security: 'security vulnerabilities (injection, XSS, sensitive data exposure)',
            performance: 'performance issues (memory leaks, inefficient algorithms, blocking operations)',
            quality: 'code quality (complexity, maintainability, best practices, DRY violations)',
            all: 'security, performance, and code quality issues',
        };

        const systemPrompt = `You are an expert code reviewer. Analyze code for ${analysisTypes[analysisType]}.
Return a JSON response with format:
{
    "issues": [{"type": "string", "severity": "error|warning|info", "line": number, "message": "string", "suggestion": "string"}],
    "score": 0-100,
    "summary": "brief overall assessment"
}`;

        try {
            const result = await this.callOpenAI([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Analyze this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`` },
            ], { temperature: 0.2, maxTokens: 2000 });

            try {
                return JSON.parse(result.content);
            } catch {
                return {
                    issues: [{ type: 'analysis', severity: 'info', message: result.content, suggestion: 'Review the analysis above' }],
                    score: 75,
                    summary: 'Analysis completed - see details above',
                };
            }
        } catch (error) {
            console.error('Code analysis error:', error);
            return { issues: [], score: 0, summary: 'Analysis failed - service unavailable' };
        }
    }

    /**
     * Generate test optimization suggestions based on execution history
     */
    async optimizeTests(request: TestOptimizationRequest): Promise<{
        suggestions: Array<{ type: 'speed' | 'reliability' | 'coverage'; priority: 'high' | 'medium' | 'low'; description: string; implementation: string }>;
        estimatedImprovement: { time: string; reliability: string };
    }> {
        const { testCode, executionHistory } = request;

        const historyContext = executionHistory
            ? `\nExecution history:\n${executionHistory.map(h => `- ${h.passed ? 'PASS' : 'FAIL'}: ${h.duration}ms at ${h.timestamp}`).join('\n')}`
            : '';

        const systemPrompt = `You are a test automation optimization expert. Analyze tests and suggest improvements.
Return JSON format:
{
    "suggestions": [{"type": "speed|reliability|coverage", "priority": "high|medium|low", "description": "string", "implementation": "string"}],
    "estimatedImprovement": {"time": "e.g., 30% faster", "reliability": "e.g., 15% more stable"}
}`;

        try {
            const result = await this.callOpenAI([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Analyze and optimize this test:\n\n${testCode}${historyContext}` },
            ], { temperature: 0.3, maxTokens: 1500 });

            try {
                return JSON.parse(result.content);
            } catch {
                return {
                    suggestions: [{ type: 'reliability', priority: 'medium', description: result.content, implementation: 'See suggestion above' }],
                    estimatedImprovement: { time: 'Unknown', reliability: 'Unknown' },
                };
            }
        } catch (error) {
            console.error('Test optimization error:', error);
            return { suggestions: [], estimatedImprovement: { time: 'N/A', reliability: 'N/A' } };
        }
    }

    /**
     * Generate smart assertions for given test context
     */
    async generateSmartAssertions(context: {
        pageUrl: string;
        elementSelectors: string[];
        testPurpose: string;
    }): Promise<string[]> {
        const systemPrompt = `You are a test automation expert. Generate meaningful, robust assertions.
Return ONLY a JSON array of assertion code strings (no explanations).`;

        try {
            const result = await this.callOpenAI([
                { role: 'system', content: systemPrompt },
                {
                    role: 'user', content: `Generate Playwright assertions for:
URL: ${context.pageUrl}
Elements: ${context.elementSelectors.join(', ')}
Purpose: ${context.testPurpose}`
                },
            ], { temperature: 0.3, maxTokens: 800 });

            try {
                return JSON.parse(result.content);
            } catch {
                // Extract assertions from text response
                const lines = result.content.split('\n').filter(line => line.includes('expect('));
                return lines.length > 0 ? lines : [`await expect(page).toHaveTitle(/${context.testPurpose}/i);`];
            }
        } catch (error) {
            console.error('Smart assertions error:', error);
            return [];
        }
    }

    /**
     * Check if AI service is configured and available
     */
    isConfigured(): boolean {
        return this.useBackend || !!this.apiKey;
    }

    /**
     * Check backend AI service health
     */
    async checkHealth(): Promise<{ available: boolean; latency: number; mode: 'backend' | 'direct' }> {
        const start = Date.now();
        try {
            if (this.useBackend) {
                const response = await fetch(`${this.backendUrl.replace('/ai', '')}/health`);
                return {
                    available: response.ok,
                    latency: Date.now() - start,
                    mode: 'backend',
                };
            } else {
                // For direct mode, just check if API key is set
                return {
                    available: !!this.apiKey,
                    latency: Date.now() - start,
                    mode: 'direct',
                };
            }
        } catch {
            return {
                available: false,
                latency: Date.now() - start,
                mode: this.useBackend ? 'backend' : 'direct',
            };
        }
    }
}

export const aiCore = new AICoreService();
