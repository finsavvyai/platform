/**
 * Agent Loader — dynamically loads available agents from the Luna CLI
 */

import { spawn } from 'child_process';

export interface AgentInfo {
    name: string;
    description: string;
    category: string;
}

const FALLBACK_AGENTS: AgentInfo[] = [
    { name: 'code-review', description: 'Review code quality', category: 'quality' },
    { name: 'testing-validation', description: 'Generate test strategies', category: 'quality' },
    { name: 'security-audit', description: 'Security vulnerability scan', category: 'quality' },
    { name: 'documentation', description: 'Generate documentation', category: 'build' },
    { name: 'deployment', description: 'Deployment assistance', category: 'ship' },
    { name: 'requirements-analyzer', description: 'Analyze requirements', category: 'intelligence' },
    { name: 'design-architect', description: 'Architecture design', category: 'design' },
    { name: 'api-design', description: 'API design patterns', category: 'design' },
];

/**
 * Load agents from `luna list --json`. Falls back to hardcoded list on failure.
 */
export async function loadAgents(cliPath: string = 'luna'): Promise<AgentInfo[]> {
    try {
        const output = await execCli(cliPath, ['list', '--json']);
        const agents = JSON.parse(output) as AgentInfo[];
        if (Array.isArray(agents) && agents.length > 0) return agents;
    } catch {
        // CLI not installed or failed — use fallback
    }
    return FALLBACK_AGENTS;
}

function execCli(cliPath: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        let stdout = '';
        const child = spawn(cliPath, args, {
            shell: process.platform === 'win32',
            env: process.env,
        });
        child.stdout.on('data', (d) => { stdout += d.toString(); });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) resolve(stdout);
            else reject(new Error(`Exit code ${code}`));
        });
    });
}
