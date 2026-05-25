/**
 * Onboarding routes — plan generation, AI recommendations, and execution.
 * Handlers split into onboarding-plan.ts, onboarding-ai.ts, onboarding-execute.ts.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { authMiddleware, tenantScopingMiddleware } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';
import { handleAiRecommendations } from './onboarding-ai';
import { handleExecute } from './onboarding-execute';
import { handlePlan } from './onboarding-plan';

const onboarding = new Hono<AppEnv>();

onboarding.use('*', authMiddleware);
onboarding.use('*', tenantScopingMiddleware);
onboarding.use('*', standardRateLimit);

onboarding.post('/plan', handlePlan);
onboarding.post('/ai-recommendations', handleAiRecommendations);
onboarding.post('/execute', handleExecute);

export default onboarding;
