/**
 * Plugin Review Service - Manages reviews, ratings, moderation
 */

import { PluginReview } from './types.js';

interface StoredReview {
  id: string;
  pluginId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  helpful: number;
  flagged: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class PluginReviewService {
  private reviews: Map<string, StoredReview[]> = new Map();
  private userReviews: Map<string, string> = new Map();

  async addReview(pluginId: string, userId: string, rating: number, comment: string, userName: string): Promise<PluginReview> {
    if (rating < 1 || rating > 5) throw new Error('Rating must be 1-5');
    if (!comment?.trim()) throw new Error('Comment required');
    if (comment.length > 1000) throw new Error('Comment too long');

    const key = `${userId}:${pluginId}`;
    if (this.userReviews.has(key)) throw new Error('Already reviewed');

    const review: StoredReview = {
      id: `rev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      pluginId,
      userId,
      userName,
      rating,
      comment: comment.trim(),
      helpful: 0,
      flagged: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const reviews = this.reviews.get(pluginId) || [];
    reviews.push(review);
    this.reviews.set(pluginId, reviews);
    this.userReviews.set(key, review.id);

    return this.format(review);
  }

  async getReviews(pluginId: string): Promise<PluginReview[]> {
    const reviews = this.reviews.get(pluginId) || [];
    return reviews
      .filter((r) => !r.flagged)
      .sort((a, b) => (b.helpful !== a.helpful ? b.helpful - a.helpful : b.createdAt.getTime() - a.createdAt.getTime()))
      .map((r) => this.format(r));
  }

  async getAverageRating(pluginId: string): Promise<number> {
    const reviews = this.reviews.get(pluginId) || [];
    const valid = reviews.filter((r) => !r.flagged);
    if (!valid.length) return 0;
    const sum = valid.reduce((a, r) => a + r.rating, 0);
    return Math.round((sum / valid.length) * 10) / 10;
  }

  async markHelpful(pluginId: string, reviewId: string): Promise<void> {
    const review = (this.reviews.get(pluginId) || []).find((r) => r.id === reviewId);
    if (!review) throw new Error('Review not found');
    review.helpful += 1;
    review.updatedAt = new Date();
  }

  async reportReview(pluginId: string, reviewId: string, reason: string): Promise<void> {
    if (!reason?.trim()) throw new Error('Reason required');
    const review = (this.reviews.get(pluginId) || []).find((r) => r.id === reviewId);
    if (!review) throw new Error('Review not found');
    review.flagged = true;
    review.updatedAt = new Date();
  }

  async reportPlugin(pluginId: string, reason: string): Promise<void> {
    if (!reason?.trim()) throw new Error('Reason required');
    if (reason.length > 500) throw new Error('Reason too long');
  }

  async getReviewStats(pluginId: string): Promise<Record<string, number>> {
    const reviews = (this.reviews.get(pluginId) || []).filter((r) => !r.flagged);
    const stats: Record<string, number> = { total: reviews.length, average: await this.getAverageRating(pluginId), '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
    for (const r of reviews) stats[r.rating.toString()]++;
    return stats;
  }

  private format(review: StoredReview): PluginReview {
    return { id: review.id, pluginId: review.pluginId, userId: review.userId, userName: review.userName, rating: review.rating, comment: review.comment, helpful: review.helpful, createdAt: review.createdAt, updatedAt: review.updatedAt };
  }
}
