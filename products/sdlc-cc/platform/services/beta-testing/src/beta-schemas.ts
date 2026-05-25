/**
 * Beta Testing Validation Schemas
 */

import { z } from '@sdlc/mcp-sdk';

export const betaApplicationSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  company: z.string().optional(),
  role: z.string().optional(),
  experience: z.enum(['beginner', 'intermediate', 'expert']),
  useCase: z.string().min(10),
  motivation: z.string().min(20),
  technicalBackground: z.string().min(20),
  agreeToTerms: z
    .boolean()
    .refine((v) => v === true, 'Must agree to terms'),
});

export const feedbackSchema = z.object({
  type: z.enum([
    'bug', 'feature', 'usability', 'performance', 'general',
  ]),
  title: z.string().min(5),
  description: z.string().min(10),
  context: z
    .object({
      feature: z.string().optional(),
      endpoint: z.string().optional(),
      sdk: z.string().optional(),
      environment: z.string().optional(),
      userAgent: z.string().optional(),
      reproductionSteps: z.array(z.string()).optional(),
    })
    .optional(),
  attachments: z.array(z.string()).optional(),
});

export const surveyResponseValueSchema = z.object({
  answer: z.union([
    z.string(), z.number(), z.boolean(), z.array(z.string()),
  ]),
});

export const surveyResponseSchema = z.object({
  surveyId: z.string(),
  responses: z.record(surveyResponseValueSchema),
  rating: z.number().min(1).max(5),
  wouldRecommend: z.boolean(),
  comments: z.string().optional(),
});
