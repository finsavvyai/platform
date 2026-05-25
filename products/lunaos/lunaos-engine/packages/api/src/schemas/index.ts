/**
 * Zod Schemas — input validation for all API endpoints
 *
 * Imported by route handlers via @hono/zod-validator
 * Ensures no endpoint accepts unvalidated input.
 */

import { z } from 'zod';

// ─── Auth Schemas ─────────────────────────────────────────────────────────────

export const signupSchema = z.object({
    email: z.string().email('Invalid email address').max(255).transform(v => v.toLowerCase()),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    name: z.string().max(100).optional().default(''),
});

export const loginSchema = z.object({
    email: z.string().email('Invalid email address').max(255).transform(v => v.toLowerCase()),
    password: z.string().min(1, 'Password is required').max(128),
});

// ─── Agent Schemas ────────────────────────────────────────────────────────────

export const agentExecuteSchema = z.object({
    agent: z.string().min(1, 'Agent ID is required').max(64),
    context: z.string().min(1, 'Context is required').max(50000),
    provider: z.enum(['anthropic', 'openai', 'deepseek']).optional(),
    model: z.string().max(64).optional(),
    useRag: z.boolean().optional(),
    repo: z.string().max(256).optional(),
});

export const createCustomAgentSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
    slug: z.string().min(1, 'Slug is required').max(64).regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric with hyphens'),
    description: z.string().max(500).optional(),
    promptVariants: z.array(z.object({
        id: z.string().max(32),
        content: z.string().min(1).max(50000),
        weight: z.number().min(0).max(100).default(100)
    })).min(1, 'At least one prompt variant is required').max(10),
    category: z.string().max(64).optional().default('custom'),
    model: z.string().max(64).optional(),
    temperature: z.number().min(0).max(2).optional(),
    isPublic: z.boolean().optional().default(false),
});

// ─── API Key Schemas ──────────────────────────────────────────────────────────

export const createApiKeySchema = z.object({
    name: z.string().max(64).optional().default('Default'),
});

// ─── Billing Schemas ──────────────────────────────────────────────────────────

export const checkoutSchema = z.object({
    plan: z.enum(['pro', 'team'], {
        errorMap: () => ({ message: "Plan must be 'pro' or 'team'" }),
    }),
});

// ─── Chain Schemas ────────────────────────────────────────────────────────────

const chainNodeSchema = z.object({
    id: z.string().min(1).max(64),
    agent: z.string().min(1).max(64),
    label: z.string().max(128).optional(),
    promptTemplate: z.string().max(10000).optional(),
    config: z.object({
        provider: z.string().max(32).optional(),
        model: z.string().max(64).optional(),
        maxTokens: z.number().int().min(1).max(100000).optional(),
        temperature: z.number().min(0).max(2).optional(),
    }).optional(),
});

const chainEdgeSchema = z.object({
    from: z.string().min(1).max(64),
    to: z.string().min(1).max(64),
});

const chainDefinitionSchema = z.object({
    name: z.string().min(1).max(128),
    description: z.string().max(500).optional(),
    nodes: z.array(chainNodeSchema).min(1).max(20),
    edges: z.array(chainEdgeSchema).default([]),
});

export const chainExecuteSchema = z.object({
    preset: z.string().max(64).optional(),
    chain: chainDefinitionSchema.optional(),
    context: z.string().min(1, 'Context is required').max(50000),
    provider: z.enum(['anthropic', 'openai', 'deepseek']).optional(),
    model: z.string().max(64).optional(),
}).refine(
    data => data.preset || data.chain,
    { message: 'Either "preset" or "chain" must be provided' }
);

// ─── RAG Schemas ──────────────────────────────────────────────────────────────

export const ragSearchSchema = z.object({
    query: z.string().min(1, 'Query is required').max(2000),
    topK: z.number().int().min(1).max(20).optional().default(5),
    repo: z.string().max(256).optional(),
});

export const ragIndexSchema = z.object({
    files: z.array(z.object({
        path: z.string().min(1).max(512),
        content: z.string().min(1).max(500000),
        type: z.string().max(32).optional(),
    })).min(1, 'At least one file is required').max(100),
    repoName: z.string().max(256).optional(),
});

export const ragMemorySchema = z.object({
    agentId: z.string().min(1).max(64),
    content: z.string().min(1, 'Memory content is required').max(10000),
    metadata: z.record(z.any()).optional(),
});

export const ragMemorySearchSchema = z.object({
    agentId: z.string().min(1).max(64).optional(),
    q: z.string().min(1, 'Query is required').max(2000),
    topK: z.coerce.number().int().min(1).max(20).optional().default(5),
});

export const kbUploadSchema = z.object({
    title: z.string().min(1, 'Title is required').max(200),
    content: z.string().min(1, 'Content is required').max(1000000),
    tags: z.array(z.string()).optional(),
});

// ─── Query Param Schemas ──────────────────────────────────────────────────────

export const paginationSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    offset: z.coerce.number().int().min(0).optional().default(0),
});

export const ragSearchQuerySchema = z.object({
    q: z.string().min(1, 'Query parameter "q" is required').max(2000),
});

// ─── Team Schemas (see team-schemas.ts) ──────────────────────────────────────
export { createTeamSchema } from './team-schemas';

// ─── OpenClaw Schemas ─────────────────────────────────────────────────────────

export const openclawToolRunSchema = z.object({
    agent: z.string().min(1, 'Agent slug is required').max(64),
    context: z.string().min(1, 'Context is required').max(50000),
    useRag: z.boolean().optional().default(true),
    provider: z.enum(['anthropic', 'openai', 'deepseek']).optional(),
    model: z.string().max(64).optional(),
});

export const openclawToolChainSchema = z.object({
    preset: z.string().min(1, 'Chain preset is required').max(64),
    context: z.string().min(1, 'Context is required').max(50000),
    provider: z.enum(['anthropic', 'openai', 'deepseek']).optional(),
    model: z.string().max(64).optional(),
});

export const openclawToolSearchSchema = z.object({
    query: z.string().min(1, 'Query is required').max(2000),
    topK: z.number().int().min(1).max(20).optional().default(5),
});

export const openclawToolIndexSchema = z.object({
    files: z.array(z.object({
        path: z.string().min(1).max(512),
        content: z.string().min(1).max(500000),
        type: z.string().max(32).optional(),
    })).min(1, 'At least one file is required').max(100),
    repoName: z.string().max(256).optional(),
});

export const openclawGatewayRegisterSchema = z.object({
    gatewayUrl: z.string().min(1, 'Gateway URL is required').max(512)
        .refine(url => url.startsWith('wss://') || url.startsWith('ws://'), {
            message: 'Gateway URL must start with wss:// or ws://',
        }),
    token: z.string().min(1, 'Gateway auth token is required').max(1024),
    label: z.string().max(128).optional().default('Default Gateway'),
    id: z.string().max(32).optional(),
    setDefault: z.boolean().optional().default(true),
});

export const openclawAnalyticsQuerySchema = z.object({
    days: z.coerce.number().int().min(1).max(365).optional().default(30),
});

// ─── RAG Analytics Schemas ────────────────────────────────────────────────────

export const ragAnalyticsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});
