/**
 * AI Testing Service - Frontend client for AI-powered testing features
 * 
 * Provides test generation, self-healing, and failure analysis capabilities
 * through the Qestro backend API.
 */

import { LOCAL_API_ORIGIN } from '../config/devDefaults';

const API_BASE = import.meta.env.VITE_API_URL || LOCAL_API_ORIGIN;

// Types
export interface TestGenerationRequest {
    scenario: string;
    platform: 'web' | 'mobile' | 'api';
    userStory?: string;
    framework?: 'playwright' | 'maestro' | 'cypress';
}

export interface TestGenerationResult {
    success: boolean;
    testCode: string;
    confidence: number;
    suggestions: string[];
    estimatedCoverage: number;
    metadata?: {
        generatedAt: string;
        model: string;
        tokensUsed: number;
    };
}

export interface SelfHealingRequest {
    testCode: string;
    errorLog: string;
    stackTrace?: string;
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

export interface FailureAnalysisRequest {
    testName: string;
    error: string;
    stackTrace?: string;
    testCode: string;
    screenshots?: string[];
}

export interface FailureAnalysisResult {
    success: boolean;
    rootCause: string;
    category: 'timing' | 'locator' | 'assertion' | 'network' | 'data' | 'environment';
    suggestedFix: string;
    confidence: number;
    preventionSteps: string[];
}

export interface TestExecutionRequest {
    testId: string;
    testCode: string;
    browser?: 'chromium' | 'firefox' | 'webkit';
    headless?: boolean;
    timeout?: number;
    baseUrl?: string;
    viewport?: { width: number; height: number };
}

export interface TestExecutionResult {
    testId: string;
    status: 'passed' | 'failed' | 'skipped' | 'timeout';
    duration: number;
    startTime: string;
    endTime: string;
    error?: {
        message: string;
        stack: string;
        location?: string;
    };
    artifacts: {
        screenshots: string[];
        videos: string[];
        traces: string[];
        logs: string[];
    };
    steps: Array<{
        name: string;
        status: 'passed' | 'failed' | 'skipped';
        duration: number;
        error?: string;
        screenshot?: string;
    }>;
    metrics: {
        networkRequests: number;
        consoleMessages: number;
        pageLoads: number;
    };
}

export interface AIHealthStatus {
    success: boolean;
    aiServicesAvailable: boolean;
    status: 'healthy' | 'degraded' | 'offline';
}

export interface ExecutionStats {
    runningTests: number;
    activeTestIds: string[];
}

// API Client
class AITestingService {
    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const url = `${API_BASE}${endpoint}`;
        const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');

        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `AI service request failed (${response.status})`);
        }

        return response.json();
    }

    // =====================
    // AI Generation APIs
    // =====================

    /**
     * Generate a test from natural language description
     */
    async generateTest(request: TestGenerationRequest): Promise<TestGenerationResult> {
        return this.request<TestGenerationResult>('/api/ai/generate-test', {
            method: 'POST',
            body: JSON.stringify(request),
        });
    }

    /**
     * Self-heal a failed test
     */
    async healTest(request: SelfHealingRequest): Promise<SelfHealingResult> {
        return this.request<SelfHealingResult>('/api/ai/heal-test', {
            method: 'POST',
            body: JSON.stringify(request),
        });
    }

    /**
     * Analyze why a test failed
     */
    async analyzeFailure(request: FailureAnalysisRequest): Promise<FailureAnalysisResult> {
        return this.request<FailureAnalysisResult>('/api/ai/analyze-failure', {
            method: 'POST',
            body: JSON.stringify(request),
        });
    }

    // =====================
    // Test Execution APIs
    // =====================

    /**
     * Execute a test asynchronously
     */
    async executeTest(request: TestExecutionRequest): Promise<{ success: boolean; testId: string; message: string }> {
        return this.request('/api/tests/execute', {
            method: 'POST',
            body: JSON.stringify(request),
        });
    }

    /**
     * Execute a test and wait for results
     */
    async executeTestSync(request: TestExecutionRequest): Promise<{ success: boolean; result: TestExecutionResult }> {
        return this.request('/api/tests/execute-sync', {
            method: 'POST',
            body: JSON.stringify(request),
        });
    }

    /**
     * Cancel a running test
     */
    async cancelTest(testId: string): Promise<{ success: boolean; cancelled: boolean }> {
        return this.request(`/api/tests/execute/${testId}`, {
            method: 'DELETE',
        });
    }

    /**
     * Check if a test is running
     */
    async getTestStatus(testId: string): Promise<{ success: boolean; testId: string; isRunning: boolean }> {
        return this.request(`/api/tests/status/${testId}`);
    }

    /**
     * Get execution statistics
     */
    async getExecutionStats(): Promise<{ success: boolean; stats: ExecutionStats }> {
        return this.request('/api/tests/stats');
    }

    // =====================
    // Health & Monitoring
    // =====================

    /**
     * Check AI services health
     */
    async checkHealth(): Promise<AIHealthStatus> {
        return this.request('/api/ai/health');
    }

    // =====================
    // Utility Methods
    // =====================

    /**
     * Generate a unique test ID
     */
    generateTestId(): string {
        return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Format test code for display
     */
    formatTestCode(code: string): string {
        // Basic formatting - could be enhanced with Prettier
        return code
            .replace(/;(?!\s*\n)/g, ';\n')
            .replace(/\{(?!\s*\n)/g, '{\n')
            .replace(/\}(?!\s*\n)/g, '\n}\n');
    }

    /**
     * Get category color for failure analysis
     */
    getCategoryColor(category: FailureAnalysisResult['category']): string {
        const colors: Record<string, string> = {
            timing: '#f59e0b',     // Amber
            locator: '#ef4444',    // Red
            assertion: '#8b5cf6',  // Purple
            network: '#3b82f6',    // Blue
            data: '#10b981',       // Green
            environment: '#6b7280', // Gray
        };
        return colors[category] || '#6b7280';
    }

    /**
     * Get confidence level label
     */
    getConfidenceLabel(confidence: number): { label: string; color: string } {
        if (confidence >= 0.8) return { label: 'High', color: '#10b981' };
        if (confidence >= 0.5) return { label: 'Medium', color: '#f59e0b' };
        return { label: 'Low', color: '#ef4444' };
    }
}

// Export singleton instance
export const aiTestingService = new AITestingService();
export default aiTestingService;
