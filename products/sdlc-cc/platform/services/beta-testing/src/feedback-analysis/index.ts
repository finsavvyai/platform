/**
 * Feedback Analysis Service
 * Orchestrates AI-powered feedback categorization, insights, and predictions
 */

import type {
  FeedbackAnalysisResult, InsightReport, LLMServiceClient,
  VectorSearchClient, VectorSearchResult, MonitoringClient,
  BetaFeedbackWithUserRow,
} from "../types";
import { AnalysisHelpers } from "./analysis-helpers";
import { InsightsGenerator } from "./insights-generator";
import { TrendPredictor } from "./trend-predictor";

class FeedbackAnalysisService {
  private db: D1Database;
  private kv: KVNamespace;
  private llm: LLMServiceClient;
  private helpers: AnalysisHelpers;
  private insights: InsightsGenerator;
  private trends: TrendPredictor;
  private vectorSearch: VectorSearchClient;
  private monitoring: MonitoringClient;

  constructor(db: D1Database, kv: KVNamespace, llm: LLMServiceClient,
    vectorSearch: VectorSearchClient, monitoring: MonitoringClient) {
    this.db = db; this.kv = kv; this.llm = llm;
    this.vectorSearch = vectorSearch; this.monitoring = monitoring;
    this.helpers = new AnalysisHelpers(db, llm, vectorSearch, monitoring);
    this.insights = new InsightsGenerator();
    this.trends = new TrendPredictor(db, llm);
  }

  async analyzeFeedback(feedbackId: string): Promise<FeedbackAnalysisResult> {
    const feedback = await this.db.prepare(
      `SELECT f.*, u.name, u.email, u.company, u.experience
       FROM beta_feedback f JOIN beta_users u ON f.user_id = u.user_id WHERE f.id = ?`,
    ).bind(feedbackId).first();
    if (!feedback) throw new Error("Feedback not found");

    const aiResponse = await this.llm.analyze({
      model: "claude-3-sonnet", prompt: this.helpers.buildAnalysisPrompt(feedback),
      maxTokens: 1000, temperature: 0.1,
    });
    const analysis = this.helpers.parseAIResponse(aiResponse);
    const similar = await this.helpers.findSimilarFeedback(feedback.description, feedback.type);
    const affected = await this.helpers.estimateAffectedUsers(feedback, similar);
    const revenue = this.helpers.calculateRevenueImpact(analysis, affected);

    await this.helpers.updateFeedbackAnalysis(feedbackId, {
      ...analysis, similarIssues: similar.length, affectedUsers: affected, potentialRevenue: revenue,
    });
    await this.monitoring.trackEvent("feedback_analyzed", {
      feedbackId, category: analysis.category, priority: analysis.priority,
      sentiment: analysis.sentiment, impact: analysis.estimatedImpact,
    });
    return { ...analysis, similarIssues: similar.length, affectedUsers: affected, potentialRevenue: revenue };
  }

  async generateWeeklyInsights(): Promise<InsightReport> {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const { results } = await this.db.prepare(
      `SELECT f.*, u.experience, u.testing_phase FROM beta_feedback f
       JOIN beta_users u ON f.user_id = u.user_id WHERE f.created_at > ? ORDER BY f.created_at DESC`,
    ).bind(weekAgo.toISOString()).all();
    const data = results || [];
    const summary = await this.insights.generateSummary(data);
    const topIssues = await this.insights.identifyTopIssues(data);
    const report: InsightReport = {
      summary: summary.overview, keyFindings: summary.keyFindings, topIssues,
      userSentiment: await this.insights.analyzeSentimentTrends(data),
      recommendations: await this.insights.generateRecommendations(summary, topIssues),
      emergingTrends: await this.trends.identifyEmergingTrends(data),
      userSegments: await this.insights.analyzeUserSegments(data),
    };
    await this.kv.put(`beta-insights:${new Date().toISOString().split("T")[0]}`,
      JSON.stringify(report), { expirationTtl: 30 * 24 * 60 * 60 });
    return report;
  }

  async predictFeedbackTrends(daysAhead = 7): Promise<{
    predictedVolume: number; confidence: number;
    predictedCategories: Record<string, number>; recommendations: string[];
  }> {
    const hist = await this.trends.getHistoricalFeedbackData(30);
    const training = this.trends.prepareTimeSeriesData(hist);
    const pred = await this.llm.predict({
      model: "time-series-forecast", data: training, horizon: daysAhead,
      features: ["day_of_week", "is_weekend", "beta_phase_distribution"],
    });
    const cats = await this.trends.predictCategoryBreakdown(pred.total);
    const recs = await this.trends.generateProactiveRecommendations(pred, cats);
    return { predictedVolume: Math.round(pred.total), confidence: pred.confidence,
      predictedCategories: cats, recommendations: recs };
  }

  async findRelatedFeedback(feedbackId: string, limit = 5): Promise<BetaFeedbackWithUserRow[]> {
    const fb = await this.db.prepare("SELECT * FROM beta_feedback WHERE id = ?").bind(feedbackId).first();
    if (!fb) return [];
    const vecs = await this.vectorSearch.search({
      query: fb.description + " " + fb.title, topK: limit + 1,
      filter: { type: fb.type, status: ["new", "triaged", "in-progress"] },
    });
    const { results } = await this.db.prepare(
      `SELECT f.*, u.name, u.company FROM beta_feedback f JOIN beta_users u ON f.user_id = u.user_id
       WHERE f.id IN (${vecs.map((_: VectorSearchResult) => "?").join(",")}) AND f.id != ? ORDER BY f.created_at DESC`,
    ).bind(...vecs.map((v: VectorSearchResult) => v.id), feedbackId).all();
    return results || [];
  }

  async processFeedbackBatch(feedbackIds: string[]): Promise<{
    processed: number; updated: number; errors: string[];
  }> {
    const r = { processed: 0, updated: 0, errors: [] as string[] };
    for (const id of feedbackIds) {
      try {
        r.processed++;
        const analysis = await this.analyzeFeedback(id);
        const cur = await this.db.prepare(
          "SELECT category, priority FROM beta_feedback WHERE id = ?").bind(id).first();
        if (cur?.category !== analysis.category || cur?.priority !== analysis.priority) {
          r.updated++;
          if (analysis.priority === "urgent" || analysis.category === "critical")
            await this.helpers.sendPriorityAlert(id, analysis);
        }
      } catch (error: unknown) {
        r.errors.push(`Failed to process ${id}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }
    return r;
  }
}

export default FeedbackAnalysisService;
