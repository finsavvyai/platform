import { logger } from '../utils/logger.js';
import { healthCheckService } from '../services/HealthCheckService.js';
import Redis from 'redis';
import OpenAI from 'openai';

interface AIJob {
  id: string;
  type: 'test-generation' | 'assertion-suggestion' | 'selector-optimization' | 'failure-analysis';
  userId: string;
  data: any;
  priority: number;
  createdAt: Date;
}

class AIProcessorWorker {
  private redisClient: any;
  private openai: OpenAI | null = null;
  private isRunning = false;
  private maxConcurrentJobs: number;
  private currentJobs = new Set<string>();

  constructor() {
    this.maxConcurrentJobs = parseInt(process.env.MAX_CONCURRENT_JOBS || '5');
  }

  async initialize(): Promise<void> {
    try {
      // Initialize Redis connection
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) {
        throw new Error('REDIS_URL environment variable is required');
      }

      this.redisClient = Redis.createClient({ url: redisUrl });
      await this.redisClient.connect();

      // Initialize OpenAI client
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (openaiApiKey) {
        this.openai = new OpenAI({ apiKey: openaiApiKey });
        logger.info('OpenAI client initialized');
      } else {
        logger.warn('OpenAI API key not provided, AI features will be disabled');
      }

      // Setup health monitoring
      healthCheckService.startHealthMonitoring(30000); // 30 seconds

      logger.info('AI processor worker initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize AI processor worker:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('AI processor worker is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting AI processor worker...');

    // Start job processing loop
    this.processJobs();

    // Setup graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  private async processJobs(): Promise<void> {
    while (this.isRunning) {
      try {
        // Check if we can process more jobs
        if (this.currentJobs.size >= this.maxConcurrentJobs) {
          await this.sleep(1000);
          continue;
        }

        // Get next job from queue
        const jobData = await this.redisClient.brPop('ai-processing-queue', 5);
        if (!jobData) {
          continue;
        }

        const job: AIJob = JSON.parse(jobData.element);
        this.processAIJob(job);

      } catch (error) {
        logger.error('Error in AI job processing loop:', error);
        await this.sleep(5000); // Wait before retrying
      }
    }
  }

  private async processAIJob(job: AIJob): Promise<void> {
    const jobId = job.id;
    this.currentJobs.add(jobId);

    try {
      logger.info(`Starting AI processing for job ${jobId} (type: ${job.type})`);

      // Update job status to running
      await this.updateJobStatus(jobId, 'running', {
        startedAt: new Date(),
        workerId: process.pid
      });

      // Process the AI job based on type
      let result: any;
      switch (job.type) {
        case 'test-generation':
          result = await this.generateTest(job.data);
          break;
        case 'assertion-suggestion':
          result = await this.suggestAssertions(job.data);
          break;
        case 'selector-optimization':
          result = await this.optimizeSelectors(job.data);
          break;
        case 'failure-analysis':
          result = await this.analyzeFailure(job.data);
          break;
        default:
          throw new Error(`Unknown AI job type: ${job.type}`);
      }

      // Update job status to completed
      await this.updateJobStatus(jobId, 'completed', {
        completedAt: new Date(),
        result,
        workerId: process.pid
      });

      logger.info(`AI processing completed for job ${jobId}`);

    } catch (error) {
      logger.error(`AI processing failed for job ${jobId}:`, error);

      // Update job status to failed
      await this.updateJobStatus(jobId, 'failed', {
        failedAt: new Date(),
        error: error.message,
        workerId: process.pid
      });

    } finally {
      this.currentJobs.delete(jobId);
    }
  }

  private async generateTest(data: any): Promise<any> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const { description, framework = 'playwright' } = data;

    const prompt = `
Generate a comprehensive test script for the following scenario:
${description}

Requirements:
- Use ${framework} testing framework
- Include setup steps
- Add main test actions with proper selectors
- Include meaningful assertions
- Add cleanup steps
- Use TypeScript
- Follow best practices for test automation

Format the response as a complete, executable test file.
`;

    const response = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4000')
    });

    return {
      testScript: response.choices[0].message.content,
      framework,
      metadata: {
        model: process.env.OPENAI_MODEL || 'gpt-4',
        tokensUsed: response.usage?.total_tokens || 0
      }
    };
  }

  private async suggestAssertions(data: any): Promise<any> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const { element, context, pageContent } = data;

    const prompt = `
Based on the following web element and page context, suggest meaningful assertions for test automation:

Element: ${JSON.stringify(element, null, 2)}
Page Context: ${JSON.stringify(context, null, 2)}
Page Content Sample: ${pageContent?.substring(0, 1000) || 'Not provided'}

Suggest 3-5 different types of assertions:
1. Visual assertions (text content, visibility, styling)
2. Functional assertions (enabled/disabled, clickable)
3. Data assertions (values, attributes)
4. Behavioral assertions (interactions, state changes)

Format as JSON array with assertion type, selector, expected value, and description.
`;

    const response = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2000')
    });

    try {
      const suggestions = JSON.parse(response.choices[0].message.content || '[]');
      return {
        assertions: suggestions,
        metadata: {
          model: process.env.OPENAI_MODEL || 'gpt-4',
          tokensUsed: response.usage?.total_tokens || 0
        }
      };
    } catch (error) {
      logger.error('Failed to parse AI assertion suggestions:', error);
      return {
        assertions: [],
        error: 'Failed to parse AI response',
        rawResponse: response.choices[0].message.content
      };
    }
  }

  private async optimizeSelectors(data: any): Promise<any> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const { selectors, element, pageStructure } = data;

    const prompt = `
Optimize the following CSS selectors for better reliability and maintainability:

Current Selectors: ${JSON.stringify(selectors, null, 2)}
Target Element: ${JSON.stringify(element, null, 2)}
Page Structure: ${pageStructure?.substring(0, 2000) || 'Not provided'}

Provide optimized selectors with:
1. Better specificity
2. Reduced brittleness
3. Improved readability
4. Fallback strategies

Rank selectors by reliability (1-10) and explain the reasoning.
Format as JSON with selector, reliability score, and explanation.
`;

    const response = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2000')
    });

    try {
      const optimizedSelectors = JSON.parse(response.choices[0].message.content || '[]');
      return {
        optimizedSelectors,
        metadata: {
          model: process.env.OPENAI_MODEL || 'gpt-4',
          tokensUsed: response.usage?.total_tokens || 0
        }
      };
    } catch (error) {
      logger.error('Failed to parse AI selector optimization:', error);
      return {
        optimizedSelectors: [],
        error: 'Failed to parse AI response',
        rawResponse: response.choices[0].message.content
      };
    }
  }

  private async analyzeFailure(data: any): Promise<any> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const { error, testScript, screenshot, logs } = data;

    const prompt = `
Analyze the following test failure and provide insights:

Error: ${error}
Test Script: ${testScript?.substring(0, 2000) || 'Not provided'}
Logs: ${JSON.stringify(logs?.slice(-10), null, 2) || 'Not provided'}
Screenshot Available: ${screenshot ? 'Yes' : 'No'}

Provide:
1. Root cause analysis
2. Possible solutions
3. Prevention strategies
4. Code suggestions for fixes

Format as JSON with analysis, solutions, and recommendations.
`;

    const response = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '3000')
    });

    try {
      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      return {
        analysis,
        metadata: {
          model: process.env.OPENAI_MODEL || 'gpt-4',
          tokensUsed: response.usage?.total_tokens || 0
        }
      };
    } catch (error) {
      logger.error('Failed to parse AI failure analysis:', error);
      return {
        analysis: {},
        error: 'Failed to parse AI response',
        rawResponse: response.choices[0].message.content
      };
    }
  }

  private async updateJobStatus(jobId: string, status: string, data: any): Promise<void> {
    try {
      const statusKey = `ai-job:${jobId}:status`;
      const statusData = {
        status,
        updatedAt: new Date(),
        ...data
      };

      await this.redisClient.hSet(statusKey, statusData);
      await this.redisClient.expire(statusKey, 86400); // Expire after 24 hours

      // Publish status update
      await this.redisClient.publish('ai-job-status-updates', JSON.stringify({
        jobId,
        status,
        data: statusData
      }));

    } catch (error) {
      logger.error(`Failed to update AI job status for ${jobId}:`, error);
    }
  }

  private async shutdown(): Promise<void> {
    logger.info('Shutting down AI processor worker...');
    this.isRunning = false;

    // Wait for current jobs to complete (with timeout)
    const shutdownTimeout = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.currentJobs.size > 0 && (Date.now() - startTime) < shutdownTimeout) {
      logger.info(`Waiting for ${this.currentJobs.size} AI jobs to complete...`);
      await this.sleep(1000);
    }

    if (this.currentJobs.size > 0) {
      logger.warn(`Force shutting down with ${this.currentJobs.size} AI jobs still running`);
    }

    // Cleanup resources
    healthCheckService.stopHealthMonitoring();
    
    if (this.redisClient) {
      await this.redisClient.quit();
    }

    logger.info('AI processor worker shutdown complete');
    process.exit(0);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Start the worker if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const worker = new AIProcessorWorker();
  
  worker.initialize()
    .then(() => worker.start())
    .catch((error) => {
      logger.error('Failed to start AI processor worker:', error);
      process.exit(1);
    });
}

export { AIProcessorWorker };