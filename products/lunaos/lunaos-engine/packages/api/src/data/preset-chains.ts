/**
 * Preset Chains — built-in agent chain workflows
 *
 * These are ready-to-run chain definitions that combine agents
 * into multi-step workflows for common development scenarios.
 */

import type { ChainDefinition } from '../services/chain-schema';

// ─── Full Review Chain ───────────────────────────────────────────────────────
// code-review → testing-validation → documentation
// Reviews code, then validates tests, then generates / updates docs

export const FULL_REVIEW_CHAIN: ChainDefinition = {
    name: 'Full Review',
    description: 'Comprehensive code review pipeline: review → test validation → documentation. Ensures code quality, test coverage, and up-to-date docs.',
    nodes: [
        {
            id: 'review',
            agent: 'code-review',
            label: 'Code Review',
            promptTemplate: '{{context}}',
        },
        {
            id: 'test',
            agent: 'testing-validation',
            label: 'Test Validation',
            promptTemplate: 'Based on the following code review analysis, validate the test coverage and suggest additional tests:\n\n## Code Review Results\n{{prev}}\n\n## Original Context\n{{context}}',
        },
        {
            id: 'docs',
            agent: 'documentation',
            label: 'Documentation',
            promptTemplate: 'Based on the code review and test analysis, generate or update documentation for the following:\n\n## Review & Test Summary\n{{prev}}\n\n## Original Context\n{{context}}',
        },
    ],
    edges: [
        { from: 'review', to: 'test' },
        { from: 'test', to: 'docs' },
    ],
};

// ─── New Feature Chain ───────────────────────────────────────────────────────
// requirements-analyzer → design-architect → task-planner → task-executor
// Full lifecycle from requirements to implementation plan

export const NEW_FEATURE_CHAIN: ChainDefinition = {
    name: 'New Feature',
    description: 'Complete feature development pipeline: requirements analysis → architecture design → task planning → implementation guidance.',
    nodes: [
        {
            id: 'requirements',
            agent: 'requirements-analyzer',
            label: 'Requirements Analysis',
            promptTemplate: '{{context}}',
        },
        {
            id: 'design',
            agent: 'design-architect',
            label: 'Architecture Design',
            promptTemplate: 'Design the technical architecture for the following feature based on these requirements:\n\n## Requirements Analysis\n{{prev}}\n\n## Feature Description\n{{context}}',
        },
        {
            id: 'plan',
            agent: 'task-planner',
            label: 'Task Planning',
            promptTemplate: 'Create a detailed implementation plan based on the architecture design:\n\n## Architecture Design\n{{prev}}\n\n## Feature Description\n{{context}}',
        },
        {
            id: 'execute',
            agent: 'task-executor',
            label: 'Implementation Guide',
            promptTemplate: 'Provide implementation guidance for the first task based on this plan:\n\n## Implementation Plan\n{{prev}}\n\n## Feature Description\n{{context}}',
        },
    ],
    edges: [
        { from: 'requirements', to: 'design' },
        { from: 'design', to: 'plan' },
        { from: 'plan', to: 'execute' },
    ],
};

// ─── Deploy Chain ────────────────────────────────────────────────────────────
// code-review → testing-validation → deployment
// Pre-deploy validation: review → test → deploy checklist

export const DEPLOY_CHAIN: ChainDefinition = {
    name: 'Deploy',
    description: 'Pre-deployment validation pipeline: code review → test validation → deployment checklist and strategy.',
    nodes: [
        {
            id: 'review',
            agent: 'code-review',
            label: 'Pre-Deploy Review',
            promptTemplate: 'Perform a pre-deployment code review focusing on production readiness, security, and performance:\n\n{{context}}',
        },
        {
            id: 'test',
            agent: 'testing-validation',
            label: 'Pre-Deploy Testing',
            promptTemplate: 'Validate that the following code is test-ready for production deployment:\n\n## Code Review Results\n{{prev}}\n\n## Context\n{{context}}',
        },
        {
            id: 'deploy',
            agent: 'deployment',
            label: 'Deployment Plan',
            promptTemplate: 'Create a deployment plan and checklist based on the review and test results:\n\n## Review & Test Results\n{{prev}}\n\n## Context\n{{context}}',
        },
    ],
    edges: [
        { from: 'review', to: 'test' },
        { from: 'test', to: 'deploy' },
    ],
};

// ─── Security Audit Chain ────────────────────────────────────────────────────
// 365-security → code-review (security focus)
// Security-focused review: security hardening → code security audit

export const SECURITY_AUDIT_CHAIN: ChainDefinition = {
    name: 'Security Audit',
    description: 'Security-focused audit pipeline: security hardening analysis → code review with security focus.',
    nodes: [
        {
            id: 'security',
            agent: '365-security',
            label: 'Security Analysis',
            promptTemplate: 'Analyze the following for security vulnerabilities, authentication weaknesses, and hardening opportunities:\n\n{{context}}',
        },
        {
            id: 'review',
            agent: 'code-review',
            label: 'Security Code Review',
            promptTemplate: 'Perform a security-focused code review based on the security analysis findings:\n\n## Security Analysis\n{{prev}}\n\n## Original Code\n{{context}}',
        },
    ],
    edges: [
        { from: 'security', to: 'review' },
    ],
};

// ─── API Design Chain ────────────────────────────────────────────────────────
// api-generator → database → documentation
// Design API → database schema → auto-docs

export const API_DESIGN_CHAIN: ChainDefinition = {
    name: 'API Design',
    description: 'API design pipeline: REST API design → database schema → API documentation.',
    nodes: [
        {
            id: 'api',
            agent: 'api-generator',
            label: 'API Design',
            promptTemplate: '{{context}}',
        },
        {
            id: 'database',
            agent: 'database',
            label: 'Database Schema',
            promptTemplate: 'Design the database schema to support the following API:\n\n## API Design\n{{prev}}\n\n## Requirements\n{{context}}',
        },
        {
            id: 'docs',
            agent: 'documentation',
            label: 'API Documentation',
            promptTemplate: 'Generate comprehensive API documentation for:\n\n## API & Database Design\n{{prev}}\n\n## Original Requirements\n{{context}}',
        },
    ],
    edges: [
        { from: 'api', to: 'database' },
        { from: 'database', to: 'docs' },
    ],
};

// ─── Registry ────────────────────────────────────────────────────────────────

export const PRESET_CHAINS: Record<string, ChainDefinition> = {
    'full-review': FULL_REVIEW_CHAIN,
    'new-feature': NEW_FEATURE_CHAIN,
    'deploy': DEPLOY_CHAIN,
    'security-audit': SECURITY_AUDIT_CHAIN,
    'api-design': API_DESIGN_CHAIN,
};

export function getPresetChain(slug: string): ChainDefinition | undefined {
    return PRESET_CHAINS[slug];
}

export function listPresetChains() {
    return Object.entries(PRESET_CHAINS).map(([slug, chain]) => ({
        slug,
        name: chain.name,
        description: chain.description,
        nodeCount: chain.nodes.length,
        agents: chain.nodes.map(n => n.agent),
    }));
}
