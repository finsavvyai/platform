import { z } from 'zod';

const CATEGORIES = ['security', 'compliance', 'performance', 'cost', 'risk'] as const;
const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;
const STATUSES = ['new', 'acknowledged', 'resolved', 'dismissed'] as const;

export const createInsightSchema = z.object({
  category: z.enum(CATEGORIES),
  severity: z.enum(SEVERITIES),
  title: z.string().min(1).max(500),
  description: z.string().min(1).max(5000),
  sourceType: z.string().min(1).max(100),
  sourceId: z.string().max(256).nullish(),
});

export const updateInsightSchema = z.object({
  status: z.enum(STATUSES),
});

export const complianceNarrativeSchema = z.object({
  controls: z.array(z.unknown()).min(1),
});
