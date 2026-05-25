/**
 * Feedback Service - Handles beta user feedback submission
 */

import { Context } from 'hono';
import { z } from '@sdlc/mcp-sdk';
import type {
  FeedbackForCategorization,
  AICategorizationResult,
} from './types';
import {
  BETA_CONFIG,
  feedbackSchema,
  type BetaUser,
  type Feedback,
  type BetaServiceDeps,
} from './beta-config';

export class FeedbackService {
  private db: D1Database;
  private email: BetaServiceDeps['email'];
  private monitoring: BetaServiceDeps['monitoring'];

  constructor(deps: BetaServiceDeps) {
    this.db = deps.db;
    this.email = deps.email;
    this.monitoring = deps.monitoring;
  }

  async submitFeedback(
    c: Context,
    feedbackData: z.infer<typeof feedbackSchema>,
  ) {
    const userId = c.get('userId');
    const userAgent = c.req.header('User-Agent');

    const betaUser = await this.db
      .prepare(
        'SELECT * FROM beta_users WHERE user_id = ? AND application_status = "active"',
      )
      .bind(userId)
      .first<BetaUser>();

    if (!betaUser) {
      throw new Error('Not an active beta user');
    }

    const feedbackId = crypto.randomUUID();
    const feedback: Omit<
      Feedback,
      'id' | 'createdAt' | 'updatedAt' | 'status'
    > = {
      userId,
      type: feedbackData.type,
      category: feedbackData.type === 'bug' ? 'high' : 'medium',
      title: feedbackData.title,
      description: feedbackData.description,
      context: {
        ...feedbackData.context,
        userAgent,
        timestamp: new Date().toISOString(),
      },
      attachments: feedbackData.attachments || [],
      priority: feedbackData.type === 'bug' ? 'high' : 'normal',
    };

    await this.db
      .prepare(
        `INSERT INTO beta_feedback (
          id, user_id, type, category, title, description, context,
          attachments, status, priority, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      )
      .bind(
        feedbackId,
        feedback.userId,
        feedback.type,
        feedback.category,
        feedback.title,
        feedback.description,
        JSON.stringify(feedback.context),
        JSON.stringify(feedback.attachments),
        'new',
        feedback.priority,
      )
      .run();

    await this.db
      .prepare(
        `UPDATE beta_users
        SET feedback_count = feedback_count + 1,
            last_active_date = CURRENT_TIMESTAMP
        WHERE user_id = ?`,
      )
      .bind(userId)
      .run();

    await this.categorizeFeedback(feedbackId, feedback);

    const rewardCredits =
      feedback.type === 'bug' && feedback.category === 'critical'
        ? BETA_CONFIG.criticalBugRewardCredits
        : BETA_CONFIG.feedbackRewardCredits;

    await this.db
      .prepare(
        'UPDATE beta_users SET reward_credits = reward_credits + ? WHERE user_id = ?',
      )
      .bind(rewardCredits, userId)
      .run();

    await this.email.send({
      to: betaUser.email,
      template: 'beta-feedback-received',
      data: {
        name: betaUser.name,
        feedbackId,
        feedbackType: feedback.type,
        creditsEarned: rewardCredits,
        expectedResponseTime: '24-48 hours',
      },
    });

    await this.monitoring.trackEvent('beta_feedback_submitted', {
      feedbackId,
      userId,
      type: feedback.type,
      category: feedback.category,
      hasAttachments: feedback.attachments!.length > 0,
    });

    return {
      success: true,
      message: 'Feedback submitted successfully',
      feedbackId,
      creditsEarned: rewardCredits,
      totalCredits: betaUser.rewardCredits + rewardCredits,
      nextSteps: [
        "We'll review your feedback within 24-48 hours",
        "You'll receive updates on our progress",
        'Keep testing and submitting feedback',
      ],
    };
  }

  private async categorizeFeedback(
    feedbackId: string,
    feedback: FeedbackForCategorization,
  ) {
    const category = await this.analyzeFeedbackWithAI(feedback);
    await this.db
      .prepare(
        'UPDATE beta_feedback SET category = ?, priority = ? WHERE id = ?',
      )
      .bind(category.category, category.priority, feedbackId)
      .run();
  }

  private async analyzeFeedbackWithAI(
    feedback: FeedbackForCategorization,
  ): Promise<AICategorizationResult> {
    const text = feedback.title + ' ' + feedback.description;
    if (
      text.includes('crash') ||
      text.includes('broken') ||
      text.includes('not working')
    ) {
      return { category: 'critical', priority: 'urgent' };
    } else if (
      text.includes('bug') ||
      text.includes('error')
    ) {
      return { category: 'high', priority: 'high' };
    } else if (
      text.includes('feature') ||
      text.includes('add')
    ) {
      return { category: 'feature', priority: 'normal' };
    }
    return { category: 'improvement', priority: 'normal' };
  }
}
