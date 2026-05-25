/**
 * Beta Testing Configuration and Interfaces
 */

import type { SurveyResponseValue } from './types';

export const BETA_CONFIG = {
  maxBetaUsers: 100,
  betaDuration: 8 * 7 * 24 * 60 * 60 * 1000, // 8 weeks in ms
  feedbackRewardCredits: 100,
  criticalBugRewardCredits: 500,
  features: {
    advancedSearch: true,
    multiModalProcessing: true,
    customIntegrations: true,
    prioritySupport: true,
  },
  limits: {
    documentsPerUser: 1000,
    apiCallsPerDay: 10000,
    storagePerUser: 10 * 1024 * 1024 * 1024, // 10GB
  },
};

export interface BetaUser {
  id: string;
  email: string;
  name: string;
  company?: string;
  role?: string;
  experience: 'beginner' | 'intermediate' | 'expert';
  useCase: string;
  applicationStatus: 'pending' | 'approved' | 'rejected' | 'active' | 'completed';
  joinDate: Date;
  endDate?: Date;
  feedbackCount: number;
  bugsReported: number;
  rewardCredits: number;
  engagementScore: number;
  lastActiveDate?: Date;
  testingPhase: 'onboarding' | 'core' | 'advanced' | 'load' | 'integration';
  surveyResponses: Record<string, SurveyResponseSummary>;
  notes: string;
}

export interface SurveyResponseSummary {
  rating: number;
  wouldRecommend: boolean;
  submittedAt: string;
}

export interface Feedback {
  id: string;
  userId: string;
  type: 'bug' | 'feature' | 'usability' | 'performance' | 'general';
  category: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  context?: {
    feature?: string;
    endpoint?: string;
    sdk?: string;
    environment?: string;
    userAgent?: string;
    timestamp?: string;
    reproductionSteps?: string[];
  };
  attachments?: string[];
  status: 'new' | 'triaged' | 'in-progress' | 'resolved' | 'closed' | 'deferred';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  assignedTo?: string;
  response?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  userIdResponse?: string;
  helpful?: boolean;
}

export interface TestingScenario {
  id: string;
  name: string;
  description: string;
  phase: BetaUser['testingPhase'];
  steps: string[];
  expectedOutcome: string;
  completionPoints: number;
  category: 'integration' | 'security' | 'performance' | 'usability' | 'feature';
  estimatedTime: number;
  prerequisites?: string[];
}

export interface BetaMetrics {
  totalUsers: number;
  activeUsers: number;
  completionRate: number;
  averageEngagementScore: number;
  feedbackCount: number;
  bugsReported: number;
  featureRequests: number;
  npsScore: number;
  satisfactionScore: number;
  phaseDistribution: Record<BetaUser['testingPhase'], number>;
  weeklyActivity: Array<{
    week: number;
    activeUsers: number;
    feedbackSubmitted: number;
    scenariosCompleted: number;
  }>;
}

export interface EmailSendingService {
  send(params: {
    to: string;
    template: string;
    data: Record<string, unknown>;
  }): Promise<void>;
}

export interface MonitoringService {
  trackEvent(event: string, data: Record<string, unknown>): Promise<void>;
}

export interface BetaServiceDeps {
  db: D1Database;
  kv: KVNamespace;
  email: EmailSendingService;
  monitoring: MonitoringService;
}

// Re-export schemas for convenience
export {
  betaApplicationSchema,
  feedbackSchema,
  surveyResponseSchema,
  surveyResponseValueSchema,
} from './beta-schemas';
