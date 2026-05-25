/**
 * Validation schemas for AI explain routes.
 */
import { z } from 'zod';

export const explainEventSchema = z.object({
  eventId: z.string().min(1, 'eventId is required'),
  eventType: z.string().min(1, 'eventType is required'),
  details: z.string().min(1, 'details is required'),
  severity: z.string().optional(),
  source: z.string().optional(),
});

export const complianceNarrativeSchema = z.object({
  controlResults: z.array(
    z.object({
      controlId: z.string().min(1),
      status: z.enum(['pass', 'fail', 'partial']),
      evidence: z.string().min(1),
    }),
  ).min(1, 'At least one control result is required'),
});

export const classifyRiskSchema = z.object({
  description: z.string().min(1, 'Event description is required'),
});
