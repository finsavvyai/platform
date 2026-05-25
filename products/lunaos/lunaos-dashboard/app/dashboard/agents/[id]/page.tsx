// Server component wrapper for static export
import AgentExecutionClient from './client';

// Pre-render all known agent pages for static export
export function generateStaticParams() {
    return [
        { id: '365-security' },
        { id: 'analytics' },
        { id: 'api-generator' },
        { id: 'auth' },
        { id: 'cloudflare' },
        { id: 'code-review' },
        { id: 'database' },
        { id: 'deployment' },
        { id: 'design-architect' },
        { id: 'docker' },
        { id: 'documentation' },
        { id: 'glm-vision' },
        { id: 'hig' },
        { id: 'lemonsqueezy' },
        { id: 'monitoring-observability' },
        { id: 'openai-app' },
        { id: 'post-launch-review' },
        { id: 'rag' },
        { id: 'rag-enhanced' },
        { id: 'requirements-analyzer' },
        { id: 'run' },
        { id: 'seo' },
        { id: 'task-executor' },
        { id: 'task-planner' },
        { id: 'testing-validation' },
        { id: 'ui-fix' },
        { id: 'ui-test' },
        { id: 'user-guide' },
    ];
}

export default function AgentExecutionPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    return <AgentExecutionClient params={params} />;
}
