import { ReviewJob } from '../workers/ai-review/types.js';
import { QestroAIBridgeService } from './QestroAIBridgeService.js';

/**
 * QestroAIService - High-level orchestration layer for AI-powered features
 * Delegates to QestroAIBridgeService for actual AI engine communication
 */
export class QestroAIService {
    private static instance: QestroAIService;
    private bridge: QestroAIBridgeService;

    private constructor() {
        this.bridge = QestroAIBridgeService.getInstance();
    }

    public static getInstance(): QestroAIService {
        if (!QestroAIService.instance) {
            QestroAIService.instance = new QestroAIService();
        }
        return QestroAIService.instance;
    }

    /**
     * Trigger a code review for a given PR
     */
    public async triggerReview(job: ReviewJob): Promise<{ success: boolean; jobId: string; review?: any }> {
        console.log(`[QestroAIService] Triggering review for PR #${job.prNumber}`);

        try {
            const review = await this.bridge.triggerCodeReview({
                prNumber: job.prNumber,
                prUrl: job.prUrl,
                repoOwner: job.repoOwner,
                repoName: job.repoName
            });

            return {
                success: true,
                jobId: job.id,
                review
            };
        } catch (error) {
            console.error(`[QestroAIService] Review failed for job ${job.id}:`, error);
            return {
                success: false,
                jobId: job.id
            };
        }
    }

    /**
     * Generate a new test using AI
     */
    public async generateTest(params: {
        scenario: string;
        platform: 'web' | 'mobile' | 'api';
        userStory?: string;
    }): Promise<any> {
        console.log(`[QestroAIService] Generating ${params.platform} test for: ${params.scenario}`);

        return await this.bridge.generateTest({
            scenario: params.scenario,
            targetPlatform: params.platform,
            userStory: params.userStory,
            language: 'typescript'
        });
    }

    /**
     * Analyze and fix a failed test
     */
    public async healTest(params: {
        testCode: string;
        errorLog: string;
        stackTrace: string;
    }): Promise<any> {
        console.log('[QestroAIService] Initiating test self-healing');

        return await this.bridge.healFailedTest({
            failedTest: params.testCode,
            errorLog: params.errorLog,
            stackTrace: params.stackTrace
        });
    }

    /**
     * Analyze why a test failed
     */
    public async analyzeFailure(params: {
        testName: string;
        error: string;
        stackTrace: string;
        testCode: string;
        screenshots?: string[];
    }): Promise<any> {
        console.log(`[QestroAIService] Analyzing failure: ${params.testName}`);

        return await this.bridge.analyzeFailure({
            testName: params.testName,
            errorMessage: params.error,
            stackTrace: params.stackTrace,
            testCode: params.testCode,
            screenshots: params.screenshots
        });
    }

    /**
     * Check if AI services are available
     */
    public async isAvailable(): Promise<boolean> {
        return await this.bridge.healthCheck();
    }
}
