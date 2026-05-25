/**
 * Shared API types used across multiple service modules
 */

export interface User {
    id: string;
    email: string;
    name: string;
    tier: 'free' | 'pro' | 'team';
}

export interface Agent {
    slug: string;
    name: string;
    category: string;
    tier: 'free' | 'pro';
    hasSystemPrompt: boolean;
}

export interface Execution {
    id: string;
    agent: string;
    provider: string;
    model: string;
    duration_ms: number;
    created_at: string;
}

export interface PromptVariant {
    id: string;
    content: string;
    weight: number;
}

export interface CustomAgent {
    id: string;
    name: string;
    slug: string;
    description: string;
    promptVariants: PromptVariant[];
    category: string;
    model: string;
    temperature: number;
    is_public: boolean;
    created_at: string;
    author_name?: string;
}
