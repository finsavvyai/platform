/**
 * Feedback Analysis Helpers
 * Prompt building, AI response parsing, impact estimation
 */

import type {
  FeedbackAnalysisResult, LLMServiceClient, VectorSearchClient,
  VectorSearchResult, MonitoringClient, BetaFeedbackWithUserRow,
} from "../types";

export class AnalysisHelpers {
  constructor(
    private db: D1Database, private llm: LLMServiceClient,
    private vectorSearch: VectorSearchClient, private monitoring: MonitoringClient,
  ) {}

  buildAnalysisPrompt(feedback: BetaFeedbackWithUserRow): string {
    return `You are analyzing beta testing feedback for SDLC.ai, a secure AI platform.

FEEDBACK DETAILS:
- Title: ${feedback.title}
- Description: ${feedback.description}
- Type: ${feedback.type}
- User Experience: ${feedback.experience}
- User Company: ${feedback.company}
- Context: ${JSON.stringify(feedback.context)}

Analyze and respond in JSON: {"category":"critical|high|medium|low","priority":"urgent|high|normal|low","sentiment":"positive|negative|neutral","tags":[],"estimatedImpact":"high|medium|low","suggestedAction":"fix-immediately|investigate|schedule|monitor","reasoning":"..."}`;
  }

  parseAIResponse(response: string): FeedbackAnalysisResult {
    try {
      const p = JSON.parse(response);
      return {
        category: p.category || "medium", priority: p.priority || "normal",
        sentiment: p.sentiment || "neutral", tags: p.tags || [],
        estimatedImpact: p.estimatedImpact || "medium",
        suggestedAction: p.suggestedAction || "investigate",
        similarIssues: 0, affectedUsers: 0, potentialRevenue: 0,
      };
    } catch {
      return {
        category: "medium", priority: "normal", sentiment: "neutral", tags: [],
        estimatedImpact: "medium", suggestedAction: "investigate",
        similarIssues: 0, affectedUsers: 0, potentialRevenue: 0,
      };
    }
  }

  async findSimilarFeedback(text: string, type: string): Promise<VectorSearchResult[]> {
    return (await this.vectorSearch.search({ query: text, topK: 10, filter: { type }, threshold: 0.7 })) || [];
  }

  async estimateAffectedUsers(
    feedback: BetaFeedbackWithUserRow, similarIssues: VectorSearchResult[],
  ): Promise<number> {
    let affected = similarIssues.length;
    if (feedback.type === "bug" && feedback.category === "critical") affected *= 5;
    const core = ["authentication", "document-upload", "api-access", "data-security"];
    const affectsCore = core.some((f) =>
      feedback.description.toLowerCase().includes(f) || feedback.title.toLowerCase().includes(f));
    if (affectsCore) affected *= 3;
    return Math.min(affected, 100);
  }

  calculateRevenueImpact(analysis: FeedbackAnalysisResult, affectedUsers: number): number {
    const base = { critical: 1000, high: 500, medium: 100, low: 25 };
    return (base[analysis.category] || 100) * affectedUsers;
  }

  async updateFeedbackAnalysis(feedbackId: string, analysis: Partial<FeedbackAnalysisResult>): Promise<void> {
    await this.db.prepare(
      `UPDATE beta_feedback SET category = ?, priority = ?, context = JSON_PATCH(
        COALESCE(context, '{}'), JSON_OBJECT('analysis', ?)) WHERE id = ?`,
    ).bind(analysis.category, analysis.priority, JSON.stringify(analysis), feedbackId).run();
  }

  async sendPriorityAlert(feedbackId: string, analysis: FeedbackAnalysisResult): Promise<void> {
    const fb = await this.db.prepare(
      `SELECT f.*, u.name, u.email FROM beta_feedback f
       JOIN beta_users u ON f.user_id = u.user_id WHERE f.id = ?`,
    ).bind(feedbackId).first();
    if (fb && (analysis.category === "critical" || analysis.priority === "urgent")) {
      await this.monitoring.sendAlert({
        level: "critical",
        message: `Urgent/Critical feedback from ${fb.name}: ${fb.title}`,
        details: { feedbackId, category: analysis.category, priority: analysis.priority,
          user: fb.email, description: fb.description },
        channels: ["slack", "email"],
        recipients: ["beta-team@sdlc.cc", "eng-leads@sdlc.cc"],
      });
    }
  }
}
