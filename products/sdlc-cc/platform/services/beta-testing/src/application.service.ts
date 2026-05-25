/**
 * Application Service - Handles beta program applications and reviews
 */

import { Context } from 'hono';
import { z } from '@sdlc/mcp-sdk';
import { BETA_CONFIG, type BetaUser, type BetaServiceDeps } from './beta-config';
import { betaApplicationSchema } from './beta-schemas';

export class ApplicationService {
  private db: D1Database;
  private email: BetaServiceDeps['email'];
  private monitoring: BetaServiceDeps['monitoring'];

  constructor(deps: BetaServiceDeps) {
    this.db = deps.db;
    this.email = deps.email;
    this.monitoring = deps.monitoring;
  }

  async applyForBeta(c: Context, application: z.infer<typeof betaApplicationSchema>) {
    const userId = c.get('userId');
    const userIp = c.req.header('CF-Connecting-IP');

    const existing = await this.db
      .prepare('SELECT * FROM beta_users WHERE email = ? OR user_id = ?')
      .bind(application.email, userId)
      .first();
    if (existing) {
      return { success: false, error: 'ALREADY_APPLIED', message: 'You have already applied for the beta program' };
    }

    const activeCount = await this.db
      .prepare('SELECT COUNT(*) as count FROM beta_users WHERE application_status = "active"')
      .first<{ count: number }>();
    if (activeCount?.count >= BETA_CONFIG.maxBetaUsers) {
      return { success: false, error: 'BETA_FULL', message: 'Beta testing program is currently full' };
    }

    const result = await this.db
      .prepare(`INSERT INTO beta_users (user_id, email, name, company, role, experience, use_case,
        application_status, testing_phase, notes, join_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(userId, application.email, application.name, application.company, application.role,
        application.experience, application.useCase, 'pending', 'onboarding',
        application.motivation + '\n\n' + application.technicalBackground, new Date().toISOString())
      .run();

    await this.monitoring.trackEvent('beta_application_submitted', {
      userId, email: application.email, experience: application.experience,
      company: application.company, ip: userIp,
    });
    await this.email.send({
      to: application.email, template: 'beta-application-received',
      data: { name: application.name, experience: application.experience, expectedResponseTime: '3-5 business days' },
    });
    await this.email.send({
      to: 'beta-team@sdlc.cc', template: 'new-beta-application',
      data: {
        applicantName: application.name, email: application.email, company: application.company,
        experience: application.experience, useCase: application.useCase,
        reviewUrl: `https://admin.sdlc.cc/beta/applications/${result.meta.last_row_id}`,
      },
    });

    return {
      success: true, message: 'Application submitted successfully',
      applicationId: result.meta.last_row_id,
      nextSteps: ['Review your email for confirmation', 'Wait for application review (3-5 business days)', 'Complete onboarding if approved'],
    };
  }

  async reviewApplication(c: Context, applicationId: string, decision: 'approved' | 'rejected', notes?: string) {
    const adminId = c.get('userId');
    if (!(await this.checkAdminRole(adminId))) {
      throw new Error('Unauthorized: Admin access required');
    }

    const betaUser = await this.db.prepare('SELECT * FROM beta_users WHERE id = ?')
      .bind(applicationId).first<BetaUser>();
    if (!betaUser) throw new Error('Application not found');
    if (betaUser.applicationStatus !== 'pending') throw new Error('Application already reviewed');

    const status = decision === 'approved' ? 'approved' : 'rejected';
    const endDate = decision === 'approved'
      ? new Date(Date.now() + BETA_CONFIG.betaDuration).toISOString() : null;

    await this.db.prepare(`UPDATE beta_users SET application_status = ?, end_date = ?,
        notes = COALESCE(notes, '') || ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(status, endDate, notes ? `\n\nAdmin review: ${notes}` : '', applicationId).run();

    if (decision === 'approved') {
      await this.email.send({
        to: betaUser.email, template: 'beta-approved',
        data: {
          name: betaUser.name, endDate: new Date(endDate!).toLocaleDateString(),
          onboardingUrl: `https://app.sdlc.cc/beta/onboarding?token=${this.generateOnboardingToken(applicationId)}`,
          welcomeKitUrl: 'https://docs.sdlc.cc/beta/welcome-kit',
        },
      });
      await this.grantBetaFeatures(betaUser.id);
    } else {
      await this.email.send({
        to: betaUser.email, template: 'beta-rejected',
        data: { name: betaUser.name, reason: notes || 'Program capacity reached', alternativeOptions: 'Join our waitlist for future availability' },
      });
    }

    await this.monitoring.trackEvent('beta_application_reviewed', {
      applicationId, decision, reviewerId: adminId, experience: betaUser.experience,
    });

    return {
      success: true, message: `Application ${decision}`,
      betaUser: { id: betaUser.id, email: betaUser.email, name: betaUser.name, status, endDate },
    };
  }

  async checkAdminRole(userId: string): Promise<boolean> {
    const user = await this.db.prepare('SELECT role FROM users WHERE id = ?').bind(userId).first<{ role: string }>();
    return user?.role === 'admin';
  }

  generateOnboardingToken(applicationId: string): string {
    return Buffer.from(JSON.stringify({ applicationId, timestamp: Date.now(), type: 'beta-onboarding' })).toString('base64');
  }

  private async grantBetaFeatures(userId: string) {
    await this.db.prepare(`INSERT OR REPLACE INTO user_features (user_id, features, limits, granted_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`)
      .bind(userId, JSON.stringify(BETA_CONFIG.features), JSON.stringify(BETA_CONFIG.limits)).run();
  }
}
