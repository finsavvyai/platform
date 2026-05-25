/**
 * Trend Predictor
 * Emerging trends, feedback volume prediction, category breakdown
 */

import type {
  FeedbackTrend, LLMServiceClient, LLMPrediction,
  BetaFeedbackWithUserRow, HistoricalFeedbackRow, TimeSeriesDataPoint,
} from "../types";

export class TrendPredictor {
  constructor(private db: D1Database, private llm: LLMServiceClient) {}

  async identifyEmergingTrends(data: BetaFeedbackWithUserRow[]): Promise<FeedbackTrend[]> {
    const topics: Record<string, BetaFeedbackWithUserRow[]> = {};
    data.forEach((f) => {
      const t = this.identifyTopic(f);
      if (!topics[t]) topics[t] = [];
      topics[t].push(f);
    });
    return Object.entries(topics)
      .filter(([_, issues]) => issues.length >= 3)
      .map(([topic, issues]) => ({
        topic, count: issues.length,
        trend: this.calculateTrend(issues), sentiment: this.calcSentiment(issues),
        urgency: this.calcUrgency(issues),
        relatedFeatures: this.extractFeatures(issues),
        suggestedPriority: this.suggestPriority(issues),
      }))
      .sort((a, b) => b.urgency - a.urgency)
      .slice(0, 5);
  }

  async getHistoricalFeedbackData(days: number): Promise<HistoricalFeedbackRow[]> {
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return await this.db.prepare(
      `SELECT DATE(created_at) as date, COUNT(*) as count,
       SUM(CASE WHEN type = 'bug' THEN 1 ELSE 0 END) as bugs,
       SUM(CASE WHEN type = 'feature' THEN 1 ELSE 0 END) as features,
       SUM(CASE WHEN category = 'critical' THEN 1 ELSE 0 END) as critical
       FROM beta_feedback WHERE created_at > ? GROUP BY DATE(created_at) ORDER BY date ASC`,
    ).bind(start.toISOString()).all();
  }

  prepareTimeSeriesData(data: HistoricalFeedbackRow[]): TimeSeriesDataPoint[] {
    return data.map((d) => ({
      date: d.date, volume: d.count,
      features: {
        dayOfWeek: new Date(d.date).getDay(),
        isWeekend: new Date(d.date).getDay() === 0 || new Date(d.date).getDay() === 6,
        bugRatio: d.bugs / d.count, criticalRatio: d.critical / d.count,
      },
    }));
  }

  async predictCategoryBreakdown(totalVolume: number): Promise<Record<string, number>> {
    const { results } = await this.db.prepare(
      `SELECT type, COUNT(*) as total,
       (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM beta_feedback)) as percentage
       FROM beta_feedback WHERE created_at > DATE('now', '-30 days') GROUP BY type`,
    ).all();
    const breakdown: Record<string, number> = {};
    results?.forEach((avg) => { breakdown[avg.type] = Math.round(totalVolume * (avg.percentage / 100)); });
    return breakdown;
  }

  async generateProactiveRecommendations(
    prediction: LLMPrediction, categories: Record<string, number>,
  ): Promise<string[]> {
    const r = [];
    if (prediction.total > 50) r.push("Prepare for increased feedback volume - ensure adequate support resources");
    if (categories.bug > categories.feature) r.push("Focus on stability and bug fixes for next release");
    if (categories.critical > 0) r.push("Proactively monitor for critical issues - consider hotfix preparation");
    return r;
  }

  private identifyTopic(f: BetaFeedbackWithUserRow): string {
    const t = (f.title + " " + f.description).toLowerCase();
    if (t.includes("slow") || t.includes("performance")) return "Performance";
    if (t.includes("bug") || t.includes("error") || t.includes("broken")) return "Bugs";
    if (t.includes("feature") || t.includes("add") || t.includes("request")) return "Feature Requests";
    if (t.includes("ui") || t.includes("interface") || t.includes("design")) return "UI/UX";
    if (t.includes("document") || t.includes("upload") || t.includes("file")) return "Document Processing";
    if (t.includes("api") || t.includes("sdk") || t.includes("integration")) return "API/SDK";
    return "Other";
  }

  private calculateTrend(issues: BetaFeedbackWithUserRow[]): "increasing" | "decreasing" | "stable" {
    const sorted = issues.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const half = Math.floor(sorted.length / 2);
    const first = sorted.slice(0, half).length;
    const second = sorted.slice(half).length;
    if (second > first * 1.5) return "increasing";
    if (second < first * 0.5) return "decreasing";
    return "stable";
  }

  private calcSentiment(issues: BetaFeedbackWithUserRow[]): number {
    const pos = issues.filter((i) => i.type === "feature").length;
    const neg = issues.filter((i) => i.category === "critical").length;
    return (pos - neg) / issues.length;
  }

  private calcUrgency(issues: BetaFeedbackWithUserRow[]): number {
    const u = issues.filter((i) => i.priority === "urgent" || i.category === "critical").length;
    return (u / issues.length) * 100;
  }

  private extractFeatures(issues: BetaFeedbackWithUserRow[]): string[] {
    const f = new Set<string>();
    issues.forEach((i) => { if (i.context?.feature) f.add(i.context.feature); });
    return Array.from(f);
  }

  private suggestPriority(issues: BetaFeedbackWithUserRow[]): string {
    if (issues.some((i) => i.category === "critical" || i.priority === "urgent")) return "high";
    if (issues.length > 5) return "medium";
    return "low";
  }
}
