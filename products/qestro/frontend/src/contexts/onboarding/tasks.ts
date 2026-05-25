/**
 * Qestro onboarding task catalogue.
 *
 * Buckets follow the tenantiq pattern (day1 / week1 / month1) but the items
 * are Qestro-specific: get a green run on Day 1, integrate on Week 1,
 * scale on Month 1.
 */

export type OnboardingBucket = 'day1' | 'week1' | 'month1';

export type OnboardingTaskId =
    | 'connect_project'
    | 'record_first_flow'
    | 'generate_first_test'
    | 'run_first_test'
    | 'enable_self_healing'
    | 'install_cli_or_cicd'
    | 'invite_teammate'
    | 'configure_webhook'
    | 'schedule_runs'
    | 'configure_mobile'
    | 'add_api_suite'
    | 'review_analytics';

export interface OnboardingTask {
    id: OnboardingTaskId;
    bucket: OnboardingBucket;
    title: string;
    description: string;
    cta: string;
    route: string;
    completed: boolean;
}

export const DEFAULT_TASKS: OnboardingTask[] = [
    // Day 1 — Get your first green run
    {
        id: 'connect_project', bucket: 'day1',
        title: 'Connect a project',
        description: 'Point Qestro at the app you want to test — paste a URL or import a repo.',
        cta: 'Create project', route: '/cases?action=new-project', completed: false,
    },
    {
        id: 'record_first_flow', bucket: 'day1',
        title: 'Record your first flow',
        description: 'Open the recorder, click through a happy path, and Qestro captures every step.',
        cta: 'Open recorder', route: '/recorder', completed: false,
    },
    {
        id: 'generate_first_test', bucket: 'day1',
        title: 'Generate your first AI test',
        description: 'Describe what you want in plain English — Qestro writes the Playwright or API test.',
        cta: 'Generate test', route: '/cases?mode=ai', completed: false,
    },
    {
        id: 'run_first_test', bucket: 'day1',
        title: 'Run the test and see the result',
        description: 'Execute on our hosted runners and watch the run trace stream back live.',
        cta: 'Run a test', route: '/runs', completed: false,
    },
    // Week 1 — Integrate into your workflow
    {
        id: 'enable_self_healing', bucket: 'week1',
        title: 'Enable self-healing assertions',
        description: 'When your UI changes, Qestro patches broken selectors before the build breaks.',
        cta: 'Turn on self-healing', route: '/settings?tab=ai', completed: false,
    },
    {
        id: 'install_cli_or_cicd', bucket: 'week1',
        title: 'Install the CLI or CI/CD integration',
        description: 'Run Qestro tests from GitHub Actions, GitLab CI, or your local shell.',
        cta: 'Set up CI/CD', route: '/settings?tab=integrations', completed: false,
    },
    {
        id: 'invite_teammate', bucket: 'week1',
        title: 'Invite a teammate',
        description: 'Qestro gets better with a team — invite a reviewer and share your first suite.',
        cta: 'Invite teammate', route: '/settings?tab=team', completed: false,
    },
    {
        id: 'configure_webhook', bucket: 'week1',
        title: 'Wire up Slack / webhook alerts',
        description: 'Ship failures into the channel you already live in — Slack, Discord, or a raw webhook.',
        cta: 'Configure alerts', route: '/settings?tab=notifications', completed: false,
    },
    // Month 1 — Scale
    {
        id: 'schedule_runs', bucket: 'month1',
        title: 'Schedule recurring runs',
        description: 'Hourly smoke, nightly regression — Qestro handles the cron.',
        cta: 'Schedule runs', route: '/automation-runs', completed: false,
    },
    {
        id: 'configure_mobile', bucket: 'month1',
        title: 'Configure mobile testing',
        description: 'Point Maestro at iOS and Android simulators from the Cloud Device Hub.',
        cta: 'Set up mobile', route: '/cloud-devices', completed: false,
    },
    {
        id: 'add_api_suite', bucket: 'month1',
        title: 'Add an API test suite',
        description: 'REST or GraphQL, with chained requests, auth, and JSON-path assertions.',
        cta: 'Add API tests', route: '/api-studio', completed: false,
    },
    {
        id: 'review_analytics', bucket: 'month1',
        title: "Review your first month's analytics",
        description: 'Flakiness, slowest tests, failure trends — the report that makes the case for Qestro.',
        cta: 'Open analytics', route: '/analytics', completed: false,
    },
];

export const BUCKET_LABELS: Record<OnboardingBucket, string> = {
    day1: 'Day 1 — Get your first green run',
    week1: 'Week 1 — Integrate into your workflow',
    month1: 'Month 1 — Scale',
};
