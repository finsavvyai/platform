/**
 * Phase Helpers - Phase progression, engagement scoring, and recommendations
 */

import type { BetaUser, TestingScenario, BetaServiceDeps } from './beta-config';

export class PhaseHelpers {
  private db: D1Database;
  private email: BetaServiceDeps['email'];

  constructor(deps: BetaServiceDeps) {
    this.db = deps.db;
    this.email = deps.email;
  }

  async getPhaseProgress(userId: string, phase: BetaUser['testingPhase']) {
    const total = await this.db
      .prepare('SELECT COUNT(*) as count FROM beta_testing_scenarios WHERE phase = ? AND active = true')
      .bind(phase).first<{ count: number }>();
    const completed = await this.db
      .prepare(`SELECT COUNT(*) as count FROM beta_scenario_completions sc
        JOIN beta_testing_scenarios s ON sc.scenario_id = s.id
        WHERE sc.user_id = ? AND s.phase = ? AND sc.completed_at IS NOT NULL`)
      .bind(userId, phase).first<{ count: number }>();
    return {
      total: total?.count || 0,
      completed: completed?.count || 0,
      percentage: total?.count ? ((completed?.count || 0) / total.count) * 100 : 0,
    };
  }

  getNextPhase(currentPhase: BetaUser['testingPhase']): BetaUser['testingPhase'] | null {
    const phases: BetaUser['testingPhase'][] = ['onboarding', 'core', 'advanced', 'load', 'integration'];
    const idx = phases.indexOf(currentPhase);
    return idx < phases.length - 1 ? phases[idx + 1] : null;
  }

  async advanceToNextPhase(userId: string, getTestingScenarios: (phase: BetaUser['testingPhase']) => Promise<unknown>) {
    const betaUser = await this.db
      .prepare('SELECT testing_phase FROM beta_users WHERE user_id = ?')
      .bind(userId).first<{ testing_phase: BetaUser['testingPhase'] }>();
    if (!betaUser) return;

    const nextPhase = this.getNextPhase(betaUser.testing_phase);
    if (!nextPhase) return;

    await this.db.prepare('UPDATE beta_users SET testing_phase = ? WHERE user_id = ?')
      .bind(nextPhase, userId).run();
    await this.sendPhaseTransitionEmail(userId, nextPhase, getTestingScenarios);
  }

  async updateEngagementScore(userId: string, points: number) {
    await this.db.prepare(`UPDATE beta_users SET engagement_score = engagement_score + ?,
      last_active_date = CURRENT_TIMESTAMP WHERE user_id = ?`)
      .bind(points, userId).run();
  }

  async getEngagementScore(userId: string): Promise<number> {
    const result = await this.db
      .prepare('SELECT engagement_score FROM beta_users WHERE user_id = ?')
      .bind(userId).first<{ engagement_score: number }>();
    return result?.engagement_score || 0;
  }

  async getNextRecommendedScenario(userId: string) {
    const betaUser = await this.db
      .prepare('SELECT testing_phase FROM beta_users WHERE user_id = ?')
      .bind(userId).first<{ testing_phase: BetaUser['testingPhase'] }>();
    if (!betaUser) return null;

    return await this.db.prepare(`SELECT s.* FROM beta_testing_scenarios s
      LEFT JOIN beta_scenario_completions sc ON s.id = sc.scenario_id AND sc.user_id = ?
      WHERE s.phase = ? AND sc.completed_at IS NULL AND s.active = true
      ORDER BY s.completion_points DESC LIMIT 1`)
      .bind(userId, betaUser.testing_phase).first<TestingScenario>();
  }

  private async sendPhaseTransitionEmail(
    userId: string, phase: BetaUser['testingPhase'],
    getTestingScenarios: (phase: BetaUser['testingPhase']) => Promise<unknown>,
  ) {
    const betaUser = await this.db
      .prepare('SELECT email, name FROM beta_users WHERE user_id = ?')
      .bind(userId).first<BetaUser>();
    if (!betaUser) return;

    await this.email.send({
      to: betaUser.email, template: 'beta-phase-transition',
      data: {
        name: betaUser.name, newPhase: phase,
        phaseUrl: `https://app.sdlc.cc/beta/phase/${phase}`,
        scenarios: await getTestingScenarios(phase),
      },
    });
  }
}
