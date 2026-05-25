import type { Agent } from '@/lib/api';
import type { ExtendedExecution, ReasoningChain, ThinkingStep } from './types';

/* ------------------------------------------------------------------
   Build a reasoning chain from an execution's metadata
   ------------------------------------------------------------------ */

export function buildChain(exec: ExtendedExecution, agent: Agent): ReasoningChain {
    const output = exec.output || '';
    const sections = output.split(/\n(?=#{1,3}\s)/);
    const totalMs = exec.duration_ms || Math.floor(Math.random() * 4000 + 1000);
    const totalTk = exec.output_tokens || output.length;

    const steps: ThinkingStep[] = [];

    // Step 1: Context analysis
    steps.push({
        id: 'ctx',
        label: 'Context Analysis',
        detail: `Reading project context, analyzing ${agent.name || agent.slug} scope`,
        status: 'done',
        durationMs: Math.round(totalMs * 0.1),
        tokens: Math.round(totalTk * 0.05),
    });

    // Step 2: Input parsing
    steps.push({
        id: 'parse',
        label: 'Input Parsing',
        detail: 'Parsing code input, identifying files and dependencies',
        status: 'done',
        durationMs: Math.round(totalMs * 0.05),
        tokens: Math.round(totalTk * 0.03),
    });

    // Dynamic steps from output sections
    sections.slice(0, 8).forEach((section, i) => {
        const firstLine = section.split('\n')[0].replace(/^#+\s*/, '').trim();
        if (firstLine.length > 3) {
            steps.push({
                id: `s${i}`,
                label: firstLine.slice(0, 48),
                detail: section.slice(0, 200).replace(/[#*`]/g, '').trim(),
                status: 'done',
                durationMs: Math.round(totalMs * 0.1),
                tokens: Math.round(section.length * 0.5),
            });
        }
    });

    // Final step: Report generation
    steps.push({
        id: 'report',
        label: 'Report Generation',
        detail: 'Compiling findings into structured markdown report',
        status: 'done',
        durationMs: Math.round(totalMs * 0.15),
        tokens: Math.round(totalTk * 0.2),
    });

    return {
        agentName: agent.name || agent.slug,
        startedAt: exec.created_at || new Date().toISOString(),
        steps,
        totalDurationMs: totalMs,
        totalTokens: totalTk,
        status: exec.status === 'error' ? 'error' : 'complete',
    };
}
