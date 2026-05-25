import type { Execution } from '@/lib/api';

/* ------------------------------------------------------------------
   Types for the reasoning chain visualization
   ------------------------------------------------------------------ */

export interface ThinkingStep {
    id: string;
    label: string;
    detail: string;
    status: 'done' | 'active' | 'pending';
    durationMs?: number;
    tokens?: number;
}

export interface ReasoningChain {
    agentName: string;
    startedAt: string;
    steps: ThinkingStep[];
    totalDurationMs: number;
    totalTokens: number;
    status: 'running' | 'complete' | 'error';
}

/* ------------------------------------------------------------------
   Extended type for execution with optional fields from the API
   ------------------------------------------------------------------ */

export interface ExtendedExecution extends Execution {
    output?: string;
    status?: string;
    input_tokens?: number;
    output_tokens?: number;
}
