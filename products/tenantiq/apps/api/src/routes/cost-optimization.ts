import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { authMiddleware, tenantScopingMiddleware } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';
import aiRecommendations from './cost-optimization/ai-recommendations';
import analyze from './cost-optimization/analyze';
import summary from './cost-optimization/summary';

const costOptimization = new Hono<AppEnv>();

costOptimization.use('*', authMiddleware);
costOptimization.use('*', tenantScopingMiddleware);
costOptimization.use('*', standardRateLimit);

costOptimization.route('/', analyze);
costOptimization.route('/ai-recommendations', aiRecommendations);
costOptimization.route('/summary', summary);

export default costOptimization;
