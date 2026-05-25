/**
 * Shared type definitions for Beta Testing Service
 */

// ── Service client interfaces ──

export interface LLMServiceClient {
  analyze(params: LLMAnalyzeParams): Promise<string>;
  predict(params: LLMPredictParams): Promise<LLMPrediction>;
}

export interface LLMAnalyzeParams {
  model: string;
  prompt: string;
  maxTokens: number;
  temperature: number;
}

export interface LLMPrediction {
  total: number;
  confidence: number;
}

export interface LLMPredictParams {
  model: string;
  data: TimeSeriesDataPoint[];
  horizon: number;
  features: string[];
}

export interface VectorSearchClient {
  search(params: VectorSearchParams): Promise<VectorSearchResult[]>;
}

export interface VectorSearchParams {
  query: string;
  topK: number;
  filter?: Record<string, string | string[]>;
  threshold?: number;
}

export interface VectorSearchResult {
  id: string;
  score: number;
}

export interface MonitoringClient {
  trackEvent(event: string, data: Record<string, unknown>): Promise<void>;
  trackError(error: Error): void;
  sendAlert(alert: MonitoringAlert): Promise<void>;
}

export interface MonitoringAlert {
  level: 'critical' | 'warning' | 'info';
  message: string;
  details: Record<string, unknown>;
  channels: string[];
  recipients: string[];
}

export interface EmailSendingClient {
  send(params: EmailSendParams): Promise<void>;
}

export interface EmailSendParams {
  to: string;
  template: string;
  data: Record<string, unknown>;
}

// ── Database row types ──

export interface BetaFeedbackRow {
  id: string;
  user_id: string;
  type: FeedbackType;
  category: FeedbackCategory;
  title: string;
  description: string;
  context: string | null;
  attachments: string | null;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  assigned_to: string | null;
  response: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface BetaFeedbackWithUserRow extends BetaFeedbackRow {
  name: string;
  email: string;
  company: string | null;
  experience: ExperienceLevel;
  testing_phase: TestingPhase;
}

export interface BetaUserRow {
  id: string;
  user_id: string;
  email: string;
  name: string;
  company: string | null;
  role: string | null;
  experience: ExperienceLevel;
  use_case: string;
  application_status: ApplicationStatus;
  join_date: string;
  end_date: string | null;
  feedback_count: number;
  bugs_reported: number;
  reward_credits: number;
  engagement_score: number;
  last_active_date: string | null;
  testing_phase: TestingPhase;
  survey_responses: string;
  notes: string;
}

export interface UnanalyzedFeedbackRow {
  id: string;
}

// ── Domain enums / unions ──

export type FeedbackType = 'bug' | 'feature' | 'usability' | 'performance' | 'general';
export type FeedbackCategory = 'critical' | 'high' | 'medium' | 'low';
export type FeedbackStatus = 'new' | 'triaged' | 'in-progress' | 'resolved' | 'closed' | 'deferred';
export type FeedbackPriority = 'urgent' | 'high' | 'normal' | 'low';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'expert';
export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'active' | 'completed';
export type TestingPhase = 'onboarding' | 'core' | 'advanced' | 'load' | 'integration';
export type SuggestedAction = 'fix-immediately' | 'investigate' | 'schedule' | 'monitor';
export type EstimatedImpact = 'high' | 'medium' | 'low';
export type SentimentLabel = 'positive' | 'negative' | 'neutral';
export type TrendDirection = 'increasing' | 'decreasing' | 'stable';

// ── Health check ──

export interface ServiceHealthStatus {
  status: 'healthy' | 'unhealthy';
  latency?: number;
  error?: string;
}

// ── Webhook payload ──

export interface WebhookPayload {
  type: string;
  feedbackId: string;
}

// ── Feedback analysis types ──

export interface FeedbackAnalysisResult {
  category: FeedbackCategory;
  priority: FeedbackPriority;
  sentiment: SentimentLabel;
  tags: string[];
  estimatedImpact: EstimatedImpact;
  suggestedAction: SuggestedAction;
  similarIssues: number;
  affectedUsers: number;
  potentialRevenue: number;
}

export interface FeedbackTrend {
  topic: string;
  count: number;
  trend: TrendDirection;
  sentiment: number;
  urgency: number;
  relatedFeatures: string[];
  suggestedPriority: string;
}

export interface InsightReport {
  summary: string;
  keyFindings: string[];
  topIssues: TopIssue[];
  userSentiment: UserSentiment;
  recommendations: Recommendation[];
  emergingTrends: FeedbackTrend[];
  userSegments: UserSegment[];
}

export interface TopIssue {
  issue: string;
  count: number;
  impact: string;
  recommendation: string;
}

export interface UserSentiment {
  overall: number;
  byPhase: Record<string, number>;
  byFeature: Record<string, number>;
}

export interface Recommendation {
  priority: string;
  action: string;
  impact: string;
  effort: string;
}

export interface UserSegment {
  segment: string;
  satisfaction: number;
  engagement: number;
  primaryConcerns: string[];
}

// ── Onboarding data ──

export interface OnboardingData {
  sdkUsed: 'python' | 'typescript' | 'go';
  firstApiCall: {
    endpoint: string;
    success: boolean;
    responseTime: number;
  };
  setupExperience: {
    ease: number;
    issues?: string;
    comments?: string;
  };
}

// ── Scenario completion ──

export interface ScenarioCompletionData {
  success: boolean;
  timeSpent: number;
  issues?: string[];
  feedback?: string;
  attachments?: string[];
}

// ── Survey types ──

export interface SurveyResponseValue {
  answer: string | number | boolean | string[];
}

export interface SurveySubmission {
  surveyId: string;
  responses: Record<string, SurveyResponseValue>;
  rating: number;
  wouldRecommend: boolean;
  comments?: string;
}

// ── Activity tracking ──

export interface ActivityTrackingData {
  activity: string;
  data?: Record<string, string | number | boolean>;
  metadata?: Record<string, string | number | boolean>;
}

// ── Historical / time-series data ──

export interface HistoricalFeedbackRow {
  date: string;
  count: number;
  bugs: number;
  features: number;
  critical: number;
}

export interface TimeSeriesDataPoint {
  date: string;
  volume: number;
  features: {
    dayOfWeek: number;
    isWeekend: boolean;
    bugRatio: number;
    criticalRatio: number;
  };
}

// ── Internal segment accumulator ──

export interface SegmentAccumulator {
  feedback: BetaFeedbackWithUserRow[];
  satisfaction: number;
  engagement: number;
  primaryConcerns: string[];
}

// ── Query param types ──

export type QueryParam = string | number;

// ── AI categorization result ──

export interface AICategorizationResult {
  category: string;
  priority: string;
}

// ── Partial feedback for categorization ──

export interface FeedbackForCategorization {
  title: string;
  description: string;
  type: FeedbackType;
  context?: {
    feature?: string;
    endpoint?: string;
    sdk?: string;
    environment?: string;
    userAgent?: string;
    timestamp?: string;
    reproductionSteps?: string[];
  };
}
