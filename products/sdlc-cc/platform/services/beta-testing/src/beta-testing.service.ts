/**
 * Beta Testing Service - Facade that delegates to domain sub-services
 */

import { Context } from 'hono';
import { z } from '@sdlc/mcp-sdk';
import type { OnboardingData, ScenarioCompletionData } from './types';
import type {
  BetaMetrics, BetaUser, BetaServiceDeps,
  EmailSendingService, MonitoringService,
} from './beta-config';
import {
  betaApplicationSchema, feedbackSchema, surveyResponseSchema,
} from './beta-schemas';
import { ApplicationService } from './application.service';
import { OnboardingService } from './onboarding.service';
import { FeedbackService } from './feedback.service';
import { ScenarioService } from './scenario.service';
import { SurveyService } from './survey.service';
import { MetricsService } from './metrics.service';
import { ReportService } from './report.service';

class BetaTestingService {
  private applicationService: ApplicationService;
  private onboardingService: OnboardingService;
  private feedbackService: FeedbackService;
  private scenarioService: ScenarioService;
  private surveyService: SurveyService;
  private metricsService: MetricsService;
  private reportService: ReportService;

  constructor(
    db: D1Database, kv: KVNamespace,
    email: EmailSendingService, monitoring: MonitoringService,
  ) {
    const deps: BetaServiceDeps = { db, kv, email, monitoring };
    this.applicationService = new ApplicationService(deps);
    this.scenarioService = new ScenarioService(deps);
    this.onboardingService = new OnboardingService(deps, this.scenarioService);
    this.feedbackService = new FeedbackService(deps);
    this.surveyService = new SurveyService(deps);
    this.metricsService = new MetricsService(deps, this.applicationService);
    this.reportService = new ReportService(deps, this.applicationService, this.metricsService);
  }

  async applyForBeta(c: Context, application: z.infer<typeof betaApplicationSchema>) {
    return this.applicationService.applyForBeta(c, application);
  }

  async reviewApplication(
    c: Context, applicationId: string,
    decision: 'approved' | 'rejected', notes?: string,
  ) {
    return this.applicationService.reviewApplication(c, applicationId, decision, notes);
  }

  async completeOnboarding(c: Context, onboardingData: OnboardingData) {
    return this.onboardingService.completeOnboarding(c, onboardingData);
  }

  async submitFeedback(c: Context, feedbackData: z.infer<typeof feedbackSchema>) {
    return this.feedbackService.submitFeedback(c, feedbackData);
  }

  async getTestingScenarios(phase?: BetaUser['testingPhase']) {
    return this.scenarioService.getTestingScenarios(phase);
  }

  async completeScenario(c: Context, scenarioId: string, completionData: ScenarioCompletionData) {
    return this.scenarioService.completeScenario(c, scenarioId, completionData);
  }

  async submitSurveyResponse(c: Context, surveyData: z.infer<typeof surveyResponseSchema>) {
    return this.surveyService.submitSurveyResponse(c, surveyData);
  }

  async getBetaMetrics(c: Context): Promise<BetaMetrics> {
    return this.metricsService.getBetaMetrics(c);
  }

  async generateBetaReport(c: Context, reportType: 'weekly' | 'summary' | 'detailed') {
    return this.reportService.generateBetaReport(c, reportType);
  }
}

export default BetaTestingService;
