import { z } from 'zod';

export const addIncidentEventSchema = z.object({
  eventType: z.enum(['status_change', 'comment', 'evidence', 'assignment']),
  content: z.string().min(1).max(10000),
});

export const linkSecurityEventsSchema = z.object({
  securityEventIds: z.array(z.string().min(1)).min(1),
});
