/**
 * Team Schemas — validation for team management endpoints
 */

import { z } from 'zod';

export const createTeamSchema = z.object({
    name: z.string()
        .min(2, 'Team name must be at least 2 characters')
        .max(50, 'Team name must be at most 50 characters'),
});

export const inviteMemberSchema = z.object({
    email: z.string().email('Invalid email address').max(255),
    role: z.enum(['admin', 'member'], {
        errorMap: () => ({ message: "Role must be 'admin' or 'member'" }),
    }).default('member'),
});

export const shareAgentSchema = z.object({
    agentId: z.string().min(1, 'Agent ID is required').max(64),
});

export const teamExecutionsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    offset: z.coerce.number().int().min(0).optional().default(0),
    agent: z.string().max(64).optional(),
});
