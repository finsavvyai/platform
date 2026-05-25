/**
 * Scenario Service - Manages testing scenarios and completion
 */

import { Context } from 'hono';
import type { ScenarioCompletionData } from './types';
import type { BetaUser, TestingScenario, BetaServiceDeps } from './beta-config';
import { PhaseHelpers } from './phase.helpers';

export class ScenarioService {
  private db: D1Database;
  private monitoring: BetaServiceDeps['monitoring'];
  private phaseHelpers: PhaseHelpers;

  constructor(deps: BetaServiceDeps) {
    this.db = deps.db;
    this.monitoring = deps.monitoring;
    this.phaseHelpers = new PhaseHelpers(deps);
  }

  async getTestingScenarios(phase?: BetaUser['testingPhase']) {
    const userId = 'current';
    const betaUser = await this.db
      .prepare('SELECT testing_phase FROM beta_users WHERE user_id = ?')
      .bind(userId).first<{ testing_phase: BetaUser['testingPhase'] }>();

    const currentPhase = phase || betaUser?.testing_phase || 'onboarding';
    const scenarios = await this.db
      .prepare(`SELECT * FROM beta_testing_scenarios WHERE phase = ? AND active = true
        ORDER BY completion_points DESC, estimated_time ASC`)
      .bind(currentPhase).all<TestingScenario>();

    const completed = await this.db
      .prepare('SELECT scenario_id FROM beta_scenario_completions WHERE user_id = ? AND completed_at IS NOT NULL')
      .bind(userId).all<{ scenario_id: string }>();
    const completedIds = new Set(completed.map((c) => c.scenario_id));

    return {
      phase: currentPhase,
      scenarios: scenarios.map((s) => ({
        ...s,
        completed: completedIds.has(s.id),
        progress: this.getScenarioProgress(userId, s.id),
      })),
      phaseProgress: await this.phaseHelpers.getPhaseProgress(userId, currentPhase),
      nextPhase: this.phaseHelpers.getNextPhase(currentPhase),
    };
  }

  async completeScenario(c: Context, scenarioId: string, completionData: ScenarioCompletionData) {
    const userId = c.get('userId');

    const betaUser = await this.db
      .prepare('SELECT * FROM beta_users WHERE user_id = ? AND application_status = "active"')
      .bind(userId).first<BetaUser>();
    if (!betaUser) throw new Error('Not an active beta user');

    const scenario = await this.db
      .prepare('SELECT * FROM beta_testing_scenarios WHERE id = ?')
      .bind(scenarioId).first<TestingScenario>();
    if (!scenario) throw new Error('Scenario not found');

    const existing = await this.db
      .prepare('SELECT * FROM beta_scenario_completions WHERE user_id = ? AND scenario_id = ?')
      .bind(userId, scenarioId).first();
    if (existing && existing.completed_at) throw new Error('Scenario already completed');

    await this.db.prepare(`INSERT OR REPLACE INTO beta_scenario_completions
      (user_id, scenario_id, completion_data, completed_at, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, COALESCE(
        (SELECT created_at FROM beta_scenario_completions WHERE user_id = ? AND scenario_id = ?),
        CURRENT_TIMESTAMP))`)
      .bind(userId, scenarioId, JSON.stringify(completionData), userId, scenarioId).run();

    await this.phaseHelpers.updateEngagementScore(userId, scenario.completionPoints);

    const phaseProgress = await this.phaseHelpers.getPhaseProgress(userId, betaUser.testingPhase);
    if (phaseProgress.completed >= phaseProgress.total) {
      await this.phaseHelpers.advanceToNextPhase(userId, (p) => this.getTestingScenarios(p));
    }

    await this.db.prepare('UPDATE beta_users SET reward_credits = reward_credits + ? WHERE user_id = ?')
      .bind(Math.floor(scenario.completionPoints / 10), userId).run();

    await this.monitoring.trackEvent('beta_scenario_completed', {
      userId, scenarioId, phase: scenario.phase, points: scenario.completionPoints,
    });

    return {
      success: true, message: 'Scenario completed successfully',
      pointsEarned: scenario.completionPoints,
      engagementScore: await this.phaseHelpers.getEngagementScore(userId),
      phaseProgress,
      nextScenario: await this.phaseHelpers.getNextRecommendedScenario(userId),
    };
  }

  private async getScenarioProgress(userId: string, scenarioId: string) {
    const completion = await this.db
      .prepare('SELECT completion_data, completed_at FROM beta_scenario_completions WHERE user_id = ? AND scenario_id = ?')
      .bind(userId, scenarioId).first();
    return completion || { started: false, progress: 0 };
  }
}
