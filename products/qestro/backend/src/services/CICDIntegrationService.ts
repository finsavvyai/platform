import { EventEmitter } from 'events';
import crypto from 'crypto';

/**
 * Supported CI/CD providers
 */
export type CICDProvider = 'github' | 'gitlab' | 'generic';

/**
 * Webhook event payload from any CI/CD provider
 */
export interface WebhookEvent {
  provider: CICDProvider;
  event: 'push' | 'pull_request' | 'merge_request';
  repoUrl: string;
  branch: string;
  commit: string;
  author: string;
  message: string;
  prNumber?: number;
  timestamp: Date;
}

/**
 * CI/CD integration configuration per project
 */
export interface CICDConfig {
  projectId: string;
  provider: CICDProvider;
  repoUrl: string;
  authToken: string;
  webhookSecret?: string;
  testSuiteIds: string[];
  triggerEvents: ('push' | 'pull_request' | 'merge_request')[];
  branchFilter?: RegExp;
  postResults: boolean;
}

/**
 * Test run result to post back to CI/CD
 */
export interface CICDRunResult {
  cicdConfigId: string;
  testRunId: string;
  status: 'passed' | 'failed' | 'skipped';
  passCount: number;
  failCount: number;
  duration: number;
  failedTests: string[];
}

/**
 * CICDIntegrationService
 * Orchestrates webhook events and CI/CD integrations (GitHub, GitLab)
 * Single responsibility: convert CI/CD webhooks to test runs, post results back
 */
class CICDIntegrationService extends EventEmitter {
  private configs: Map<string, CICDConfig> = new Map();
  private testQueueService: any; // Injected Bull queue service
  private webhookSecrets: Map<string, string> = new Map();

  constructor(testQueueService: any) {
    super();
    this.testQueueService = testQueueService;
  }

  /**
   * Register a CI/CD integration for a Qestro project
   */
  async registerIntegration(config: CICDConfig): Promise<void> {
    if (!config.projectId || !config.provider || !config.repoUrl) {
      throw new Error('Invalid CICD config: missing required fields');
    }

    const configId = `${config.projectId}-${config.provider}`;
    this.configs.set(configId, config);

    if (config.webhookSecret) {
      this.webhookSecrets.set(configId, config.webhookSecret);
    }

    // Setup webhooks based on provider
    if (config.provider === 'github') {
      await this.setupGitHubWebhook(config);
    } else if (config.provider === 'gitlab') {
      await this.setupGitLabWebhook(config);
    }

    this.emit('integration-registered', { configId, provider: config.provider });
  }

  /**
   * Process incoming webhook event from any provider
   */
  async handleWebhook(
    body: Record<string, any>,
    provider: CICDProvider,
    signature?: string
  ): Promise<WebhookEvent | null> {
    // Verify webhook signature
    const config = Array.from(this.configs.values()).find(
      (c) => c.provider === provider
    );
    if (config?.webhookSecret && signature) {
      const isValid = this.verifySignature(
        JSON.stringify(body),
        signature,
        config.webhookSecret
      );
      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }
    }

    let event: WebhookEvent | null = null;

    if (provider === 'github') {
      event = this.parseGitHubEvent(body);
    } else if (provider === 'gitlab') {
      event = this.parseGitLabEvent(body);
    } else {
      event = this.parseGenericEvent(body);
    }

    if (!event) return null;

    // Check branch filter
    const matchingConfig = Array.from(this.configs.values()).find(
      (c) => c.repoUrl === event.repoUrl && c.triggerEvents.includes(event.event)
    );

    if (
      matchingConfig?.branchFilter &&
      !matchingConfig.branchFilter.test(event.branch)
    ) {
      return null;
    }

    // Queue test runs for matching test suites
    if (matchingConfig) {
      await this.queueTestRuns(matchingConfig, event);
    }

    return event;
  }

  /**
   * Parse GitHub webhook payload
   */
  private parseGitHubEvent(body: Record<string, any>): WebhookEvent | null {
    const { action, pull_request, push, repository, ref, head_commit } = body;

    if (pull_request) {
      return {
        provider: 'github',
        event: 'pull_request',
        repoUrl: repository.clone_url,
        branch: pull_request.head.ref,
        commit: pull_request.head.sha,
        author: pull_request.user.login,
        message: pull_request.title,
        prNumber: pull_request.number,
        timestamp: new Date(),
      };
    }

    if (head_commit) {
      return {
        provider: 'github',
        event: 'push',
        repoUrl: repository.clone_url,
        branch: ref.replace('refs/heads/', ''),
        commit: head_commit.id,
        author: head_commit.author.name,
        message: head_commit.message,
        timestamp: new Date(),
      };
    }

    return null;
  }

  /**
   * Parse GitLab webhook payload
   */
  private parseGitLabEvent(body: Record<string, any>): WebhookEvent | null {
    const { object_kind, object_attributes, project, user_name } = body;

    if (object_kind === 'merge_request') {
      return {
        provider: 'gitlab',
        event: 'merge_request',
        repoUrl: project.http_url_to_repo,
        branch: object_attributes.source_branch,
        commit: object_attributes.last_commit.id,
        author: user_name,
        message: object_attributes.title,
        prNumber: object_attributes.iid,
        timestamp: new Date(),
      };
    }

    if (object_kind === 'push') {
      return {
        provider: 'gitlab',
        event: 'push',
        repoUrl: project.http_url_to_repo,
        branch: body.ref.replace('refs/heads/', ''),
        commit: body.after,
        author: user_name,
        message: body.commits?.[0]?.message || 'Push event',
        timestamp: new Date(),
      };
    }

    return null;
  }

  /**
   * Parse generic webhook payload
   */
  private parseGenericEvent(body: Record<string, any>): WebhookEvent {
    return {
      provider: 'generic',
      event: (body.event || 'push') as any,
      repoUrl: body.repo_url || body.repository,
      branch: body.branch || 'main',
      commit: body.commit || body.sha || '',
      author: body.author || 'unknown',
      message: body.message || '',
      timestamp: new Date(),
    };
  }

  /**
   * Queue test runs for a configuration
   */
  private async queueTestRuns(
    config: CICDConfig,
    event: WebhookEvent
  ): Promise<void> {
    for (const testSuiteId of config.testSuiteIds) {
      await this.testQueueService.enqueueTestRun({
        projectId: config.projectId,
        testSuiteId,
        cicdEventId: `${event.provider}-${event.commit}`,
        branch: event.branch,
        commit: event.commit,
        author: event.author,
      });
    }

    this.emit('tests-queued', {
      configId: `${config.projectId}-${config.provider}`,
      testCount: config.testSuiteIds.length,
    });
  }

  /**
   * Post test results back to GitHub
   */
  async postGitHubCheckRun(
    config: CICDConfig,
    result: CICDRunResult,
    prNumber?: number
  ): Promise<void> {
    if (config.provider !== 'github') return;

    const checkStatus = result.status === 'passed' ? 'completed' : 'completed';
    const conclusion =
      result.status === 'passed'
        ? 'success'
        : result.status === 'skipped'
          ? 'neutral'
          : 'failure';

    const payload = {
      status: checkStatus,
      conclusion,
      output: {
        title: `Qestro Tests: ${result.status.toUpperCase()}`,
        summary: `${result.passCount} passed, ${result.failCount} failed (${result.duration}ms)`,
        text: result.failedTests
          .slice(0, 10)
          .map((t) => `- ${t}`)
          .join('\n'),
      },
    };

    // TODO: Call GitHub API with config.authToken
    this.emit('result-posted', { configId: config.projectId, provider: 'github' });
  }

  /**
   * Post test results back to GitLab
   */
  async postGitLabStatus(
    config: CICDConfig,
    result: CICDRunResult
  ): Promise<void> {
    if (config.provider !== 'gitlab') return;

    const status =
      result.status === 'passed'
        ? 'success'
        : result.status === 'skipped'
          ? 'skipped'
          : 'failed';

    const payload = {
      status,
      description: `Qestro: ${result.passCount}/${result.passCount + result.failCount} passed`,
    };

    // TODO: Call GitLab API with config.authToken
    this.emit('result-posted', { configId: config.projectId, provider: 'gitlab' });
  }

  /**
   * Setup GitHub webhook for repository
   */
  private async setupGitHubWebhook(config: CICDConfig): Promise<void> {
    // TODO: Call GitHub API to register webhook
    // Requires GitHub App installation token from config.authToken
  }

  /**
   * Setup GitLab webhook for project
   */
  private async setupGitLabWebhook(config: CICDConfig): Promise<void> {
    // TODO: Call GitLab API to register webhook
    // Requires GitLab API token from config.authToken
  }

  /**
   * Verify HMAC-SHA256 webhook signature
   */
  private verifySignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const digest = `sha256=${hmac.digest('hex')}`;
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  }

  /**
   * Get integration config by ID
   */
  getConfig(configId: string): CICDConfig | undefined {
    return this.configs.get(configId);
  }

  /**
   * List all registered integrations
   */
  listConfigs(): CICDConfig[] {
    return Array.from(this.configs.values());
  }
}

// Export singleton
export const cicdIntegrationService = new CICDIntegrationService(null);
export default cicdIntegrationService;
