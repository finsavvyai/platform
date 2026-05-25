import { describe, it, expect, beforeEach } from 'vitest';
import { RatingSystem } from '../src/services/rating';

describe('RatingSystem', () => {
  let system: RatingSystem;

  beforeEach(() => {
    system = new RatingSystem();
  });

  it('should add a rating', () => {
    const rating = system.addRating('server1', 'user1', 5, 'Excellent!');
    expect(rating.score).toBe(5);
    expect(rating.review).toBe('Excellent!');
  });

  it('should reject invalid score', () => {
    expect(() => {
      system.addRating('server1', 'user1', 6, 'Invalid');
    }).toThrow('Rating score must be between 1 and 5');
  });

  it('should require serverId and userId', () => {
    expect(() => {
      system.addRating('', 'user1', 5, 'Review');
    }).toThrow();
  });

  it('should calculate average score', () => {
    system.addRating('server1', 'user1', 5, 'Great');
    system.addRating('server1', 'user2', 3, 'Good');
    const stats = system.getStats('server1');
    expect(stats.averageScore).toBe(4);
  });

  it('should track rating distribution', () => {
    system.addRating('server1', 'user1', 5, 'Five');
    system.addRating('server1', 'user2', 4, 'Four');
    system.addRating('server1', 'user3', 5, 'Five');
    const stats = system.getStats('server1');
    expect(stats.distribution[5]).toBe(2);
    expect(stats.distribution[4]).toBe(1);
  });

  it('should return empty stats for unknown server', () => {
    const stats = system.getStats('unknown');
    expect(stats.totalReviews).toBe(0);
    expect(stats.averageScore).toBe(0);
  });

  it('should get user rating', () => {
    system.addRating('server1', 'user1', 4, 'Good');
    const rating = system.getUserRating('server1', 'user1');
    expect(rating?.score).toBe(4);
  });

  it('should return undefined for unknown user rating', () => {
    const rating = system.getUserRating('server1', 'unknown');
    expect(rating).toBeUndefined();
  });

  it('should list all ratings for server', () => {
    system.addRating('server1', 'user1', 5, 'Great');
    system.addRating('server1', 'user2', 4, 'Good');
    const ratings = system.getRatings('server1');
    expect(ratings).toHaveLength(2);
  });

  it('should update a rating', () => {
    system.addRating('server1', 'user1', 3, 'OK');
    const updated = system.updateRating('server1', 'user1', 5, 'Changed mind!');
    expect(updated?.score).toBe(5);
    expect(updated?.review).toBe('Changed mind!');
  });

  it('should delete a rating', () => {
    system.addRating('server1', 'user1', 5, 'Great');
    const deleted = system.deleteRating('server1', 'user1');
    expect(deleted).toBe(true);
    expect(system.getUserRating('server1', 'user1')).toBeUndefined();
  });
});
