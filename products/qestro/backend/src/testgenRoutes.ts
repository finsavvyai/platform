import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from './db/schema';
import { verifyJWT } from './auth/jwt';

// Binding type for Cloudflare env
type Bindings = {
    DB: D1Database;
    ENVIRONMENT: string;
    JWT_SECRET: string;
    GITHUB_TOKEN?: string;
    GITHUB_REPOSITORY_TOKEN?: string;
};

type Variables = {
    userId: string;
    userRole: string;
    planId: string;
};

const testgenRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Simple in-memory mock for session states since KV isn't strictly requested for testgen yet.
// In a full production scenario without KV, we'd store these sessions in D1.
// For the scope of this migration, we will simulate the LLM session and actually persist the final result to D1.
const memorySessions: Record<string, any> = {};

const featureConfig = {
    feature: 'github_repository_scan',
    name: 'GitHub Repository Scenario Builder',
    minimumPlan: 'professional',
    usageType: 'repositoryScans',
};

const paidPlanRank: Record<string, number> = {
    free: 0,
    starter: 1,
    'starter-annual': 1,
    professional: 2,
    pro: 2,
    'professional-annual': 2,
    team: 2,
    enterprise: 3,
    'enterprise-annual': 3,
};

const repositoryScanLimits: Record<string, number> = {
    free: 0,
    starter: 0,
    'starter-annual': 0,
    professional: 50,
    pro: 50,
    'professional-annual': 50,
    team: 100,
    enterprise: -1,
    'enterprise-annual': -1,
};

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_FETCH_TIMEOUT_MS = 12000;
const MAX_TREE_FILES = 400;
const MAX_CONTEXT_FILES = 12;
const MAX_CONTEXT_CHARS_PER_FILE = 4000;

type GitHubTreeItem = {
    path?: string;
    type?: string;
    size?: number;
};

type RepositoryContextFile = {
    path: string;
    size: number;
    excerpt: string;
};

type RepositoryScanContext = {
    indexed: boolean;
    files: RepositoryContextFile[];
    treeSample: string[];
    error?: string;
};

const hasPlanAccess = (planId: string) =>
    (paidPlanRank[planId] ?? 0) >= paidPlanRank[featureConfig.minimumPlan];

const getUsageLimit = (planId: string) => repositoryScanLimits[planId] ?? 0;

const getAuthContext = async (c: any) => {
    const authorization = c.req.header('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
        return null;
    }

    const payload = await verifyJWT(authorization.slice(7), c.env.JWT_SECRET);
    const userId = String(payload.userId || payload.sub || '');
    if (!userId) {
        return null;
    }

    let planId = String(payload.planId || payload.subscription || 'free');
    try {
        const rows = await drizzle(c.env.DB)
            .select({ subscription: schema.users.subscription })
            .from(schema.users)
            .where(eq(schema.users.id, userId))
            .limit(1);
        if (rows[0]?.subscription) {
            planId = rows[0].subscription;
        }
    } catch {
        // Keep verified token plan fallback when local DB is not seeded.
    }

    return {
        userId,
        userRole: String(payload.role || 'user'),
        planId,
    };
};

const requireAuth = async (c: any, next: any) => {
    try {
        const auth = await getAuthContext(c);
        if (!auth) {
            return c.json({ success: false, error: 'Authentication required' }, 401);
        }
        c.set('userId', auth.userId);
        c.set('userRole', auth.userRole);
        c.set('planId', auth.planId);
        await next();
    } catch {
        return c.json({ success: false, error: 'Invalid or expired token' }, 401);
    }
};

const featureAccessPayload = (planId: string, used = 0) => {
    const limit = getUsageLimit(planId);
    const hasAccess = hasPlanAccess(planId) && (limit === -1 || used < limit);
    return {
        feature: featureConfig.feature,
        name: featureConfig.name,
        planId,
        minimumPlan: featureConfig.minimumPlan,
        hasAccess,
        upgradeUrl: '/billing',
        description: 'Connect a GitHub repository reference and generate AI scenarios.',
        usage: {
            type: featureConfig.usageType,
            used,
            limit,
            remaining: limit === -1 ? -1 : Math.max(0, limit - used),
        },
        denialReason: hasAccess ? null : 'plan_required',
    };
};

const parseGitHubRepository = (repositoryUrl: string) => {
    try {
        const url = new URL(repositoryUrl);
        if (!['github.com', 'www.github.com'].includes(url.hostname.toLowerCase())) {
            return null;
        }
        const [owner, repo] = url.pathname.replace(/^\/+/, '').split('/');
        if (!owner || !repo) {
            return null;
        }
        return {
            owner,
            repo: repo.replace(/\.git$/, ''),
            fullName: `${owner}/${repo.replace(/\.git$/, '')}`,
        };
    } catch {
        return null;
    }
};

const personaLabels: Record<string, string> = {
    developer: 'Developer',
    product: 'Product Manager',
    business: 'Business Analyst',
    qa: 'QA Lead',
};

const githubHeaders = (token?: string) => ({
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Qestro-Repository-Scenario-Builder',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const isUsefulContextPath = (path: string) => {
    const normalized = path.toLowerCase();
    if (
        normalized.includes('node_modules/') ||
        normalized.includes('dist/') ||
        normalized.includes('build/') ||
        normalized.includes('.next/') ||
        normalized.includes('coverage/') ||
        normalized.includes('package-lock.json') ||
        normalized.includes('pnpm-lock.yaml') ||
        normalized.includes('yarn.lock')
    ) {
        return false;
    }

    return (
        normalized === 'readme.md' ||
        normalized === 'package.json' ||
        normalized.endsWith('/package.json') ||
        normalized.includes('openapi') ||
        normalized.includes('swagger') ||
        normalized.includes('routes/') ||
        normalized.includes('pages/') ||
        normalized.includes('app/') ||
        normalized.includes('src/') ||
        normalized.includes('test') ||
        normalized.includes('spec') ||
        normalized.includes('docs/') ||
        normalized.includes('features/')
    );
};

const contextPathWeight = (path: string) => {
    const normalized = path.toLowerCase();
    if (normalized === 'readme.md') return 0;
    if (normalized === 'package.json') return 1;
    if (normalized.includes('openapi') || normalized.includes('swagger')) return 2;
    if (normalized.includes('routes/') || normalized.includes('api/')) return 3;
    if (normalized.includes('pages/') || normalized.includes('app/')) return 4;
    if (normalized.includes('test') || normalized.includes('spec')) return 5;
    if (normalized.includes('docs/') || normalized.includes('features/')) return 6;
    return 10;
};

const fetchWithTimeout = (url: string, init: RequestInit = {}) =>
    fetch(url, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(GITHUB_FETCH_TIMEOUT_MS),
    });

const fetchRepositoryContext = async (
    repository: { owner: string; repo: string; fullName: string },
    branch: string,
    token?: string,
): Promise<RepositoryScanContext> => {
    try {
        const treeUrl = `${GITHUB_API_BASE}/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
        const treeResponse = await fetchWithTimeout(treeUrl, { headers: githubHeaders(token) });
        if (!treeResponse.ok) {
            return {
                indexed: false,
                files: [],
                treeSample: [],
                error: `GitHub tree request failed with ${treeResponse.status}`,
            };
        }

        const treeBody = await treeResponse.json() as { tree?: GitHubTreeItem[] };
        const tree = Array.isArray(treeBody.tree) ? treeBody.tree : [];
        const filePaths = tree
            .filter((item) => item.type === 'blob' && item.path)
            .slice(0, MAX_TREE_FILES);
        const selected = filePaths
            .filter((item) => isUsefulContextPath(String(item.path)))
            .sort((left, right) => contextPathWeight(String(left.path)) - contextPathWeight(String(right.path)))
            .slice(0, MAX_CONTEXT_FILES);

        const files: RepositoryContextFile[] = [];
        for (const item of selected) {
            const path = String(item.path);
            const contentsUrl = `${GITHUB_API_BASE}/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`;
            const contentsResponse = await fetchWithTimeout(contentsUrl, {
                headers: {
                    ...githubHeaders(token),
                    Accept: 'application/vnd.github.raw',
                },
            });
            if (!contentsResponse.ok) {
                continue;
            }

            const text = await contentsResponse.text();
            files.push({
                path,
                size: Number(item.size || text.length),
                excerpt: text.slice(0, MAX_CONTEXT_CHARS_PER_FILE),
            });
        }

        return {
            indexed: files.length > 0,
            files,
            treeSample: filePaths.map((item) => String(item.path)).slice(0, 40),
        };
    } catch (error) {
        return {
            indexed: false,
            files: [],
            treeSample: [],
            error: error instanceof Error ? error.message : 'GitHub scan failed',
        };
    }
};

const buildRepositoryPrompt = (input: {
    fullName: string;
    branch: string;
    focus?: string;
    persona: string;
    context?: RepositoryScanContext;
}) => [
    `You are Qestro's ${personaLabels[input.persona] || 'QA'} scenario builder.`,
    `Repository: ${input.fullName}`,
    `Branch: ${input.branch}`,
    input.focus ? `Focus: ${input.focus}` : 'Focus: release-risk discovery across product, API, and user journeys.',
    input.context?.indexed
        ? `Indexed files:\n${input.context.files.map((file) => `- ${file.path} (${file.size} bytes)`).join('\n')}`
        : 'Repository content indexing is unavailable; use the repository URL, branch, persona, and focus as planning context.',
    input.context?.indexed
        ? `Repository excerpts:\n${input.context.files.map((file) => `--- ${file.path} ---\n${file.excerpt}`).join('\n\n')}`
        : '',
    'Scan the repository structure, identify product surfaces and risk areas, then produce executable test scenarios.',
    'Return scenarios with source paths, rationale, priority, test type, and steps that can be reviewed by developers, QA, PMs, and business analysts.',
].filter(Boolean).join('\n');

const buildRepositoryScenarios = (fullName: string, persona: string, focus?: string, context?: RepositoryScanContext) => {
    const personaLabel = personaLabels[persona] || 'QA Lead';
    const focusText = focus?.trim() || 'core product behavior';
    const sourcePaths = context?.files.length
        ? context.files.map((file) => file.path)
        : ['README.md', 'src/**', 'app/**', 'tests/**'];
    const apiPaths = sourcePaths.filter((path) => /api|route|controller|service|openapi|swagger/i.test(path));
    const testPaths = sourcePaths.filter((path) => /test|spec/i.test(path));
    return [
        {
            id: 'repo-scenario-1',
            name: `${personaLabel} acceptance coverage for ${focusText}`,
            type: persona === 'developer' ? 'integration' : 'acceptance',
            priority: 'high',
            persona: personaLabel,
            rationale: `Validate that ${fullName} has test coverage for the highest-value workflow implied by ${focusText}.`,
            sourcePaths: sourcePaths.slice(0, 6),
            steps: [
                'Inspect repository entry points and route/API boundaries.',
                'Identify the primary user or system workflow.',
                'Generate happy-path and failure-path scenarios.',
                'Map each scenario to source paths and acceptance criteria.',
            ],
            selected: true,
        },
        {
            id: 'repo-scenario-2',
            name: 'Business rule and edge-case discovery',
            type: persona === 'business' ? 'business-rule' : 'risk',
            priority: 'medium',
            persona: personaLabel,
            rationale: 'Surface hidden business rules and edge cases before implementation or release signoff.',
            sourcePaths: sourcePaths.filter((path) => /docs|feature|domain|service|model|schema/i.test(path)).slice(0, 6),
            steps: [
                'Scan domain models, validators, and service methods.',
                'Extract decisions, constraints, and exception paths.',
                'Turn each rule into PM/BA-readable scenarios.',
                'Flag ambiguous rules for human review.',
            ],
            selected: true,
        },
        {
            id: 'repo-scenario-3',
            name: 'Regression risk from dependency and API boundaries',
            type: 'regression',
            priority: 'medium',
            persona: personaLabel,
            rationale: 'Target integration edges that commonly break during product changes.',
            sourcePaths: [...apiPaths, ...testPaths, 'package.json'].slice(0, 6),
            steps: [
                'Find external APIs, SDKs, and persistence boundaries.',
                'Generate contract tests for request/response behavior.',
                'Add negative cases for auth, limits, and unavailable dependencies.',
                'Recommend smoke tests for CI.',
            ],
            selected: true,
        },
    ];
};

testgenRoutes.post('/conversations/start', async (c) => {
    const { message, channel } = await c.req.json();
    const sessionId = 'ai_session_' + Date.now();

    // Simulate detecting the domain based on the message
    let domain = 'general';
    if (message.toLowerCase().includes('payment') || message.toLowerCase().includes('stripe') || message.toLowerCase().includes('checkout')) {
        domain = 'payment';
    } else if (message.toLowerCase().includes('auth') || message.toLowerCase().includes('login')) {
        domain = 'auth';
    } else if (message.toLowerCase().includes('api') || message.toLowerCase().includes('rest')) {
        domain = 'api';
    }

    memorySessions[sessionId] = {
        id: sessionId,
        domain,
        messageCount: 1,
        scenarios: [],
        createdAt: new Date().toISOString()
    };

    return c.json({
        success: true,
        data: {
            sessionId,
            domain,
            message: `I detected this is a **${domain.toUpperCase()}** testing domain. Let me ask a few questions to generate the best test suite:\n\n1. **Which specific scenarios** do you want to cover first?\n2. **What environments** should I target?`,
            options: ['Happy path only', 'Edge cases and negative tests', 'Full regression suite']
        }
    });
});

testgenRoutes.post('/conversations/:sessionId/answer', async (c) => {
    const sessionId = c.req.param('sessionId');

    // Generate mock Playwright code for the scenario
    const mockCode = `import { test, expect } from '@playwright/test';

test.describe('Automated AI Generated Flow', () => {
    test('Happy Path Scenario', async ({ page }) => {
        await page.goto('/');
        // AI generated steps based on context
        await expect(page).toHaveTitle(/Qestro/);
        console.log('Test generated successfully');
    });
});`;

    const scenarios = [
        { id: 's1', name: 'Primary Happy Path', type: 'happy_path', priority: 'critical', steps: ['Navigate to app', 'Perform core action', 'Verify result'] },
        { id: 's2', name: 'Error Handling', type: 'negative', priority: 'high', steps: ['Trigger error state', 'Verify error message visible'] }
    ];

    if (memorySessions[sessionId]) {
        memorySessions[sessionId].scenarios = scenarios.map(s => ({ ...s, generatedCode: mockCode }));
        memorySessions[sessionId].messageCount++;
    }

    return c.json({
        success: true,
        data: {
            sessionId,
            response: `Great! I've generated **${scenarios.length} test scenarios**. Please review them.`,
            scenarios
        }
    });
});

testgenRoutes.post('/conversations/:sessionId/approve', async (c) => {
    const sessionId = c.req.param('sessionId');
    const db = drizzle(c.env.DB);
    const session = memorySessions[sessionId];

    if (!session) {
        return c.json({ success: false, error: 'Session expired or not found' }, 404);
    }

    const savedScenarios = [];

    // Save each approved scenario to the D1 database
    const { allocateDisplayId } = await import('./lib/display-id');
    for (const scenario of session.scenarios) {
        const testCaseId = 'TC-AI-' + Date.now() + Math.floor(Math.random() * 1000);
        let displayId: string | null = null;
        try {
            displayId = await allocateDisplayId(c.env.DB, 'test_case');
        } catch (err) {
            console.error('display-id allocation failed (testgen):', err);
        }

        try {
            await db.insert(schema.testCases).values({
                id: testCaseId,
                displayId,
                projectId: '1', // Default project
                title: `AI Generated: ${scenario.name}`,
                status: 'Draft',
                priority: scenario.priority === 'critical' ? 'High' : 'Medium',
                type: 'AI Generated',
                description: `Automatically generated via Test Gen Studio for domain: ${session.domain}`,
                testCode: scenario.generatedCode,
                createdAt: new Date()
            });
            savedScenarios.push({ id: testCaseId, displayId, ...scenario });
        } catch (e) {
            console.error('Failed to save test case to DB', e);
        }
    }

    return c.json({
        success: true,
        message: 'Tests saved to library',
        data: {
            sessionId,
            savedScenarios
        }
    });
});

testgenRoutes.post('/repository-scan', requireAuth, async (c) => {
    const body = await c.req.json<Record<string, unknown>>().catch(() => ({}));
    const repositoryUrl = typeof body.repositoryUrl === 'string' ? body.repositoryUrl.trim() : '';
    const branch = typeof body.branch === 'string' && body.branch.trim() ? body.branch.trim() : 'main';
    const focus = typeof body.focus === 'string' ? body.focus.trim() : '';
    const persona = typeof body.persona === 'string' && personaLabels[body.persona] ? body.persona : 'qa';
    const planId = c.get('planId');
    const access = featureAccessPayload(planId);

    if (!access.hasAccess) {
        return c.json({
            success: false,
            error: 'GitHub repository scenario building requires a Professional, Team, or Enterprise plan.',
            access,
        }, 403);
    }

    const repository = parseGitHubRepository(repositoryUrl);
    if (!repository) {
        return c.json({ success: false, error: 'Enter a valid GitHub repository URL' }, 400);
    }

    const githubToken = c.env.GITHUB_REPOSITORY_TOKEN || c.env.GITHUB_TOKEN;
    const repositoryContext = await fetchRepositoryContext(repository, branch, githubToken);
    const prompt = buildRepositoryPrompt({
        fullName: repository.fullName,
        branch,
        focus,
        persona,
        context: repositoryContext,
    });

    const scenarios = buildRepositoryScenarios(repository.fullName, persona, focus, repositoryContext);
    const used = access.usage.used + 1;
    const usage = {
        ...access.usage,
        used,
        remaining: access.usage.limit === -1 ? -1 : Math.max(0, access.usage.limit - used),
    };

    return c.json({
        success: true,
        data: {
            repository: {
                url: repositoryUrl,
                fullName: repository.fullName,
                branch,
            },
            connection: {
                provider: 'github',
                status: repositoryContext.indexed ? 'indexed' : 'prompt_ready',
                liveIndexing: repositoryContext.indexed,
                indexedFiles: repositoryContext.files.map((file) => ({
                    path: file.path,
                    size: file.size,
                })),
                treeSample: repositoryContext.treeSample,
                error: repositoryContext.error,
            },
            billing: {
                feature: featureConfig.feature,
                planId,
                minimumPlan: featureConfig.minimumPlan,
                usage,
            },
            message: repositoryContext.indexed
                ? `Indexed ${repositoryContext.files.length} repository files and generated scenario draft.`
                : 'Repository prompt and scenario draft generated without live file indexing.',
            prompt,
            scenarios,
        },
    });
});

testgenRoutes.get('/conversations', async (c) => {
    return c.json({
        success: true,
        data: Object.values(memorySessions)
    });
});

export default testgenRoutes;
