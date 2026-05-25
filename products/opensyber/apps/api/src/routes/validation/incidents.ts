import { z } from 'zod';

const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
const VALID_STATUSES = ['open', 'investigating', 'contained', 'resolved', 'closed'] as const;

export const createIncidentSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  severity: z.enum(VALID_SEVERITIES),
});

export const updateIncidentSchema = z.object({
  status: z.enum(VALID_STATUSES).optional(),
  rootCause: z.string().max(5000).optional(),
  remediation: z.string().max(5000).optional(),
  assignee: z.string().max(256).optional(),
});
