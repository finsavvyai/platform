/**
 * Real-Time Learning System Types and Interfaces
 */

export interface LearningRequest {
  id: string;
  type: LearningRequestType;
  userId: string;
  data: any;
  timestamp?: string;
}

export type LearningRequestType =
  | "track_behavior"
  | "process_feedback"
  | "detect_patterns"
  | "update_personalization"
  | "identify_anomalies"
  | "generate_insights"
  | "update_models";

export interface LearningResult {
  requestId: string;
  type: LearningRequestType;
  success: boolean;
  processingTime: number;
  data?: any;
  error?: string;
}

export interface UserBehavior {
  type: string;
  content: string;
  timestamp: string;
  metadata: {
    [key: string]: any;
    queryType?: string;
    resultsReturned?: number;
    clickThroughRate?: number;
    duration?: number;
    interactions?: string[];
    documentType?: string;
  };
}

export interface FeedbackData {
  type: string;
  targetId: string;
  rating: number;
  feedback: string;
  timestamp: string;
  metadata?: {
    [key: string]: any;
    category?: string;
    context?: string;
  };
}

export interface PatternData {
  type: string;
  description: string;
  confidence: number;
  data: any;
  metadata?: {
    [key: string]: any;
    frequency?: number;
    timeframe?: string;
  };
}

export interface PersonalizationProfile {
  userId: string;
  preferences: {
    [key: string]: any;
    queryTypes?: string[];
    documentTypes?: string[];
    resultPreferences?: any;
    uiPreferences?: any;
  };
  behaviorPatterns: {
    [key: string]: any;
    queryPatterns?: any[];
    temporalPatterns?: any[];
    contentPreferences?: any[];
  };
  feedbackHistory: any[];
  createdAt: string;
  updatedAt: string;
}

export interface LearningConfig {
  learning: {
    enableRealTimeLearning: boolean;
    feedbackWeight: number;
    behaviorWeight: number;
    minFeedbackSamples: number;
    modelUpdateThreshold: number;
    learningRate: number;
    memoryDecayRate: number;
  };
  personalization: {
    enablePersonalization: boolean;
    maxProfileSize: number;
    personalizationFactors: string[];
    updateFrequency: string;
    privacySettings: {
      anonymizeData: boolean;
      retentionPeriod: number;
      shareAcrossOrganizations: boolean;
    };
  };
  patterns: {
    enablePatternDetection: boolean;
    minPatternOccurrences: number;
    patternTypes: string[];
    anomalyThreshold: number;
    detectionWindow: number;
  };
  storage: {
    kvPrefix: string;
    d1Table: string;
    cacheTTL: number;
    batchSize: number;
  };
}
