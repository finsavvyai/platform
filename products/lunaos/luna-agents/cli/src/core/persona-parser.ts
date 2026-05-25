import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface AgentPersona {
    name: string;
    slug: string;
    description: string;
    category: string;
    tier: 'free' | 'pro';
    systemPrompt: string;
    filePath: string;
}

const CATEGORY_MAP: Record<string, string> = {
    'requirements-analyzer': 'build',
    'design-architect': 'build',
    'task-planner': 'build',
    'task-executor': 'build',
    'api-generator': 'build',
    'glm-vision': 'build',
    'code-review': 'quality',
    'testing-validation': 'quality',
    'ui-test': 'quality',
    'ui-fix': 'quality',
    '365-security': 'quality',
    'auth': 'quality',
    'cloudflare': 'ship',
    'docker': 'ship',
    'deployment': 'ship',
    'documentation': 'ship',
    'post-launch-review': 'ship',
    'monitoring-observability': 'ship',
    'lemonsqueezy': 'ship',
    'rag': 'intelligence',
    'rag-enhanced': 'intelligence',
    'analytics': 'intelligence',
    'seo': 'intelligence',
    'openai-app': 'intelligence',
    'database': 'intelligence',
    'hig': 'design',
    'user-guide': 'design',
    'run': 'meta',
};

/**
 * Find the agents directory — works both in dev and when installed globally
 */
function findAgentsDir(): string {
    const thisFile = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url);
    const thisDir = path.dirname(thisFile);

    // Candidates in priority order:
    const candidates = [
        // Built mode: cli/dist/index.js → ../../agents
        path.resolve(thisDir, '..', '..', 'agents'),
        // Dev mode: cli/src/core/persona-parser.ts → ../../../agents
        path.resolve(thisDir, '..', '..', '..', 'agents'),
        // Monorepo root
        path.resolve(thisDir, '..', '..', '..', '..', 'luna-agents', 'agents'),
        // Global install: node_modules/@luna-agents/cli/dist → ../../luna-agents/agents
        path.resolve(thisDir, '..', '..', 'luna-agents', 'agents'),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    throw new Error(
        `Could not find agents directory. Searched:\n${candidates.map(c => `  - ${c}`).join('\n')}\nMake sure you are in the luna-agents repo or have it installed.`
    );
}

/**
 * Parse a single agent persona markdown file
 */
export function parsePersona(filePath: string): AgentPersona {
    const content = fs.readFileSync(filePath, 'utf-8');
    const filename = path.basename(filePath, '.md');

    // Extract slug: luna-code-review → code-review
    const slug = filename.replace(/^luna-/, '');

    // Extract the role/title from first ## Role or first heading
    const roleMatch = content.match(/^#\s+(.+)/m);
    const title = roleMatch
        ? roleMatch[1].replace(/^Luna\s+/i, '').replace(/\s+Agent$/i, '')
        : slug.replace(/-/g, ' ');

    // Extract description from first paragraph after the title
    const descMatch = content.match(/## Role\n+(.+?)(?:\n\n|\n##)/s);
    const description = descMatch
        ? descMatch[1].replace(/^You are .+?\.\s*/i, '').split('.')[0].trim().slice(0, 80)
        : `${title} agent`;

    const category = CATEGORY_MAP[slug] || 'other';
    const tier = 'free';

    return {
        name: title,
        slug,
        description: description || `${title} agent`,
        category,
        tier,
        systemPrompt: content,
        filePath,
    };
}

/**
 * Load all agent personas from the agents/ directory
 */
export async function loadAllAgents(): Promise<AgentPersona[]> {
    const agentsDir = findAgentsDir();
    const files = fs.readdirSync(agentsDir)
        .filter(f => f.endsWith('.md') && f.startsWith('luna-'))
        .sort();

    return files.map(f => parsePersona(path.join(agentsDir, f)));
}

/**
 * Load a specific agent by slug (e.g., "code-review", "testing-validation")
 */
export async function loadAgent(slug: string): Promise<AgentPersona | null> {
    const agents = await loadAllAgents();

    // Try exact match first
    let agent = agents.find(a => a.slug === slug);
    if (agent) return agent;

    // Try partial match
    agent = agents.find(a => a.slug.includes(slug) || a.name.toLowerCase().includes(slug.toLowerCase()));
    return agent || null;
}
