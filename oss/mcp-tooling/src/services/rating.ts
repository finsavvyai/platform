export interface Rating {
  userId: string;
  serverId: string;
  score: number;
  review: string;
  createdAt: number;
}

export interface RatingStats {
  serverId: string;
  averageScore: number;
  totalReviews: number;
  distribution: Record<number, number>;
}

export class RatingSystem {
  private ratings: Map<string, Rating[]> = new Map();

  public addRating(
    serverId: string,
    userId: string,
    score: number,
    review: string
  ): Rating {
    if (score < 1 || score > 5) {
      throw new Error('Rating score must be between 1 and 5');
    }
    if (!serverId || !userId) {
      throw new Error('serverId and userId are required');
    }

    const rating: Rating = {
      userId,
      serverId,
      score,
      review,
      createdAt: Date.now(),
    };

    if (!this.ratings.has(serverId)) {
      this.ratings.set(serverId, []);
    }
    this.ratings.get(serverId)!.push(rating);
    return rating;
  }

  public getStats(serverId: string): RatingStats {
    const serverRatings = this.ratings.get(serverId) || [];
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    let sum = 0;
    serverRatings.forEach((r) => {
      sum += r.score;
      distribution[r.score]++;
    });

    const average =
      serverRatings.length > 0 ? sum / serverRatings.length : 0;

    return {
      serverId,
      averageScore: Math.round(average * 100) / 100,
      totalReviews: serverRatings.length,
      distribution,
    };
  }

  public getUserRating(serverId: string, userId: string): Rating | undefined {
    const serverRatings = this.ratings.get(serverId) || [];
    return serverRatings.find((r) => r.userId === userId);
  }

  public getRatings(serverId: string): Rating[] {
    return this.ratings.get(serverId) || [];
  }

  public updateRating(
    serverId: string,
    userId: string,
    score: number,
    review: string
  ): Rating | undefined {
    const serverRatings = this.ratings.get(serverId);
    if (!serverRatings) return undefined;

    const idx = serverRatings.findIndex((r) => r.userId === userId);
    if (idx === -1) return undefined;

    serverRatings[idx] = { userId, serverId, score, review, createdAt: Date.now() };
    return serverRatings[idx];
  }

  public deleteRating(serverId: string, userId: string): boolean {
    const serverRatings = this.ratings.get(serverId);
    if (!serverRatings) return false;

    const filtered = serverRatings.filter((r) => r.userId !== userId);
    if (filtered.length === serverRatings.length) return false;

    this.ratings.set(serverId, filtered);
    return true;
  }
}
