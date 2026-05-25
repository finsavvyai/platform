export interface Env {
    GITHUB_WEBHOOK_SECRET: string;
    QESTRO_AI_API_URL?: string;
    QESTRO_AI_API_KEY?: string;
    OPENHANDS_API_URL?: string;
    OPENHANDS_API_KEY?: string;
    // REVIEW_QUEUE: Queue<ReviewJob>; // Cloudflare specific type, simplified for now
}

export interface ReviewJob {
    id: string;
    type: 'PR_REVIEW' | 'RE_REVIEW';
    prNumber: number;
    prTitle: string;
    prUrl: string;
    repoOwner: string;
    repoName: string;
    repoUrl: string;
    prAuthor: string;
    baseBranch: string;
    headBranch: string;
    headSha: string;
    installationId: number;
    createdAt: string;
    userQuestion?: string;
}

export interface GitHubWebhookEvent {
    action: string;
    pull_request: {
        number: number;
        title: string;
        html_url: string;
        user: { login: string };
        base: { ref: string };
        head: { ref: string; sha: string };
    };
    repository: {
        name: string;
        owner: { login: string };
        clone_url: string;
    };
    installation: { id: number };
    comment?: {
        body: string;
    };
}

export interface Ticket {
    id: string;
    title: string;
    description: string;
    source: 'jira' | 'linear' | 'github' | 'manual';
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'open' | 'in_progress' | 'done';
}

export interface TestScenario {
    id: string;
    title: string;
    description: string;
    type: 'positive' | 'negative' | 'edge_case' | 'security' | 'performance';
    steps: string[];
    prerequisites?: string[];
    persona: 'novice' | 'power_user' | 'hacker' | 'standard';
}

export interface TestPlan {
    id: string;
    ticketId: string;
    scenarios: TestScenario[];
    createdAt: Date;
    status: 'draft' | 'approved' | 'active';
    aiAnalysis?: string;
}

export interface PlanningJob {
    id: string;
    type: 'PLAN_GENERATION' | 'TEST_HARVESTING';
    ticket?: Ticket;
    targetUrl?: string; // For harvesting
    status: 'pending' | 'processing' | 'completed' | 'failed';
}
