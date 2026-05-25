/**
 * Validation Schemas
 * Zod schemas for request validation
 */

import { z } from 'zod';

// Common ID schema
export const idSchema = z.object({
    id: z.string().uuid(),
});

// Pagination schema
export const paginationSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// User schemas
export const createUserSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
});

export const updateUserSchema = z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    avatar: z.string().url().optional(),
});

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

export const registerSchema = createUserSchema;

// Project schemas
export const createProjectSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    teamId: z.string().uuid().optional(),
});

export const updateProjectSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    status: z.enum(['active', 'archived', 'deleted']).optional(),
});

// Test case schemas
export const createTestCaseSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    projectId: z.string().uuid(),
    type: z.enum(['manual', 'automated', 'visual', 'api']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    steps: z.array(z.any()).optional(),
});

export const updateTestCaseSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    type: z.enum(['manual', 'automated', 'visual', 'api']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    status: z.enum(['draft', 'active', 'deprecated']).optional(),
    steps: z.array(z.any()).optional(),
});

// Team schemas
export const createTeamSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
});

export const updateTeamSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
});

export const addTeamMemberSchema = z.object({
    userId: z.string().uuid(),
    role: z.enum(['owner', 'admin', 'member', 'viewer']).optional().default('member'),
});

// Subscription schemas
export const createSubscriptionSchema = z.object({
    planId: z.string(),
    paymentMethodId: z.string().optional(),
});

export const updateSubscriptionSchema = z.object({
    planId: z.string().optional(),
    cancelAtPeriodEnd: z.boolean().optional(),
});

// Analytics schemas
export const analyticsQuerySchema = z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    granularity: z.enum(['hour', 'day', 'week', 'month']).optional().default('day'),
    metrics: z.array(z.string()).optional(),
});

// Recording schemas
export const createRecordingSchema = z.object({
    name: z.string().min(1).max(255),
    projectId: z.string().uuid(),
    url: z.string().url().optional(),
});

// Export all schemas
export const schemas = {
    id: idSchema,
    pagination: paginationSchema,
    createUser: createUserSchema,
    updateUser: updateUserSchema,
    login: loginSchema,
    register: registerSchema,
    createProject: createProjectSchema,
    updateProject: updateProjectSchema,
    createTestCase: createTestCaseSchema,
    updateTestCase: updateTestCaseSchema,
    createTeam: createTeamSchema,
    updateTeam: updateTeamSchema,
    addTeamMember: addTeamMemberSchema,
    createSubscription: createSubscriptionSchema,
    updateSubscription: updateSubscriptionSchema,
    analyticsQuery: analyticsQuerySchema,
    createRecording: createRecordingSchema,
};
