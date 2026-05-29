/**
 * Feedback Analysis Service
 * Uses AI to automatically categorize, prioritize, and analyze beta feedback
 */

import { Context } from "hono";
import { createMcpClient } from "@sdlc/mcp-sdk";

interface FeedbackAnalysis {
  category: "critical" | "high" | "medium" | "low";
  priority: "urgent" | "high" | "normal" | "low";
  sentiment: "positive" | "negative" | "neutral";
  tags: string[];
  estimatedImpact: "high" | "medium" | "low";
  suggestedAction: "fix-immediately" | "investigate" | "schedule" | "monitor";
  similarIssues: number;
  affectedUsers: number;
  potentialRevenue: number;
}

interface FeedbackTrend {
  topic: string;
  count: number;
  trend: "increasing" | "decreasing" | "stable";
  sentiment: number;
  urgency: number;
  relatedFeatures: string[];
  suggestedPriority: string;
}

interface InsightReport {
  summary: string;
  keyFindings: string[];
  topIssues: Array<{
    issue: string;
    count: number;
    impact: string;
    recommendation: string;
  }>;
  userSentiment: {
    overall: number;
    byPhase: Record<string, number>;
    byFeature: Record<string, number>;
  };
  recommendations: Array<{
    priority: string;
    action: string;
    impact: string;
    effort: string;
  }>;
  emergingTrends: FeedbackTrend[];
  userSegments: Array<{
    segment: string;
    satisfaction: number;
    engagement: number;
    primaryConcerns: string[];
  }>;
}

class FeedbackAnalysisService {
  private llm: any; // LLM service client
  private vectorSearch: any; // Vector search service
  private db: D1Database;
  private kv: KVNamespace;
  private monitoring: any;

  constructor(
    db: D1Database,
    kv: KVNamespace,
    llm: any,
    vectorSearch: any,
    monitoring: any,
  ) {
    this.db = db;
    this.kv = kv;
    this.llm = llm;
    this.vectorSearch = vectorSearch;
    this.monitoring = monitoring;
  }

  /**
   * Analyze new feedback using AI
   */
  async analyzeFeedback(feedbackId: string): Promise<FeedbackAnalysis> {
    // Fetch feedback details
    const feedback = await this.db
      .prepare(
        `
        SELECT f.*, u.name, u.email, u.company, u.experience
        FROM beta_feedback f
        JOIN beta_users u ON f.user_id = u.user_id
        WHERE f.id = ?
      `,
      )
      .bind(feedbackId)
      .first();

    if (!feedback) {
      throw new Error("Feedback not found");
    }

    // Prepare analysis prompt
    const analysisPrompt = this.buildAnalysisPrompt(feedback);

    // Get AI analysis
    const aiResponse = await this.llm.analyze({
      model: "claude-3-sonnet",
      prompt: analysisPrompt,
      maxTokens: 1000,
      temperature: 0.1,
    });

    // Parse AI response
    const analysis = this.parseAIResponse(aiResponse);

    // Find similar issues using vector search
    const similarIssues = await this.findSimilarFeedback(
      feedback.description,
      feedback.type,
    );

    // Estimate impact based on affected users
    const affectedUsers = await this.estimateAffectedUsers(
      feedback,
      similarIssues,
    );

    // Calculate potential revenue impact
    const potentialRevenue = this.calculateRevenueImpact(
      analysis,
      affectedUsers,
    );

    // Update feedback with analysis
    await this.updateFeedbackAnalysis(feedbackId, {
      ...analysis,
      similarIssues: similarIssues.length,
      affectedUsers,
      potentialRevenue,
    });

    // Track analysis event
    await this.monitoring.trackEvent("feedback_analyzed", {
      feedbackId,
      category: analysis.category,
      priority: analysis.priority,
      sentiment: analysis.sentiment,
      impact: analysis.estimatedImpact,
    });

    return {
      ...analysis,
      similarIssues: similarIssues.length,
      affectedUsers,
      potentialRevenue,
    };
  }

  /**
   * Generate weekly insights report
   */
  async generateWeeklyInsights(): Promise<InsightReport> {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Fetch feedback from last week
    const feedbackData = await this.db
      .prepare(
        `
        SELECT f.*, u.experience, u.testing_phase
        FROM beta_feedback f
        JOIN beta_users u ON f.user_id = u.user_id
        WHERE f.created_at > ?
        ORDER BY f.created_at DESC
      `,
      )
      .bind(weekAgo.toISOString())
      .all();

    // Generate summary statistics
    const summary = await this.generateSummary(feedbackData.results || []);

    // Analyze sentiment trends
    const sentimentAnalysis = await this.analyzeSentimentTrends(
      feedbackData.results || [],
    );

    // Identify top issues
    const topIssues = await this.identifyTopIssues(feedbackData.results || []);

    // Generate recommendations
    const recommendations = await this.generateRecommendations(
      summary,
      topIssues,
    );

    // Identify emerging trends
    const emergingTrends = await this.identifyEmergingTrends(
      feedbackData.results || [],
    );

    // Analyze user segments
    const userSegments = await this.analyzeUserSegments(
      feedbackData.results || [],
    );

    const report: InsightReport = {
      summary: summary.overview,
      keyFindings: summary.keyFindings,
      topIssues,
      userSentiment: sentimentAnalysis,
      recommendations,
      emergingTrends,
      userSegments,
    };

    // Cache the report
    await this.kv.put(
      `beta-insights:${new Date().toISOString().split("T")[0]}`,
      JSON.stringify(report),
      { expirationTtl: 30 * 24 * 60 * 60 }, // 30 days
    );

    return report;
  }

  /**
   * Predict feedback volume and trends
   */
  async predictFeedbackTrends(daysAhead: number = 7): Promise<{
    predictedVolume: number;
    confidence: number;
    predictedCategories: Record<string, number>;
    recommendations: string[];
  }> {
    // Get historical data
    const historicalData = await this.getHistoricalFeedbackData(30); // Last 30 days

    // Prepare data for ML model
    const trainingData = this.prepareTimeSeriesData(historicalData);

    // Use time series forecasting
    const prediction = await this.llm.predict({
      model: "time-series-forecast",
      data: trainingData,
      horizon: daysAhead,
      features: ["day_of_week", "is_weekend", "beta_phase_distribution"],
    });

    // Predict category breakdown
    const categoryPredictions = await this.predictCategoryBreakdown(
      prediction.total,
    );

    // Generate proactive recommendations
    const recommendations = await this.generateProactiveRecommendations(
      prediction,
      categoryPredictions,
    );

    return {
      predictedVolume: Math.round(prediction.total),
      confidence: prediction.confidence,
      predictedCategories: categoryPredictions,
      recommendations,
    };
  }

  /**
   * Find related feedback for better context
   */
  async findRelatedFeedback(
    feedbackId: string,
    limit: number = 5,
  ): Promise<any[]> {
    const feedback = await this.db
      .prepare("SELECT * FROM beta_feedback WHERE id = ?")
      .bind(feedbackId)
      .first();

    if (!feedback) return [];

    // Use vector similarity search
    const similarVectorIds = await this.vectorSearch.search({
      query: feedback.description + " " + feedback.title,
      topK: limit + 1, // +1 to exclude self
      filter: {
        type: feedback.type,
        status: ["new", "triaged", "in-progress"],
      },
    });

    // Fetch full feedback details
    const relatedFeedback = await this.db
      .prepare(
        `
        SELECT f.*, u.name, u.company
        FROM beta_feedback f
        JOIN beta_users u ON f.user_id = u.user_id
        WHERE f.id IN (${similarVectorIds.map((_, i) => "?").join(",")})
        AND f.id != ?
        ORDER BY f.created_at DESC
      `,
      )
      .bind(...similarVectorIds.map((v) => v.id), feedbackId)
      .all();

    return relatedFeedback.results || [];
  }

  /**
   * Auto-categorize and prioritize feedback batch
   */
  async processFeedbackBatch(feedbackIds: string[]): Promise<{
    processed: number;
    updated: number;
    errors: string[];
  }> {
    const results = {
      processed: 0,
      updated: 0,
      errors: [] as string[],
    };

    for (const id of feedbackIds) {
      try {
        results.processed++;
        const analysis = await this.analyzeFeedback(id);

        // Check if analysis suggests different categorization
        const currentFeedback = await this.db
          .prepare("SELECT category, priority FROM beta_feedback WHERE id = ?")
          .bind(id)
          .first();

        if (
          currentFeedback?.category !== analysis.category ||
          currentFeedback?.priority !== analysis.priority
        ) {
          results.updated++;

          // Trigger notification for priority changes
          if (
            analysis.priority === "urgent" ||
            analysis.category === "critical"
          ) {
            await this.sendPriorityAlert(id, analysis);
          }
        }
      } catch (error: any) {
        results.errors.push(`Failed to process ${id}: ${error.message}`);
      }
    }

    return results;
  }

  // Private helper methods

  private buildAnalysisPrompt(feedback: any): string {
    return `
You are analyzing beta testing feedback for SDLC.ai, a secure AI platform.

FEEDBACK DETAILS:
- Title: ${feedback.title}
- Description: ${feedback.description}
- Type: ${feedback.type}
- User Experience: ${feedback.experience}
- User Company: ${feedback.company}
- Context: ${JSON.stringify(feedback.context)}

Please analyze this feedback and provide:
1. Category (critical/high/medium/low)
2. Priority (urgent/high/normal/low)
3. Sentiment (positive/negative/neutral)
4. Tags (relevant keywords)
5. Estimated Impact (high/medium/low)
6. Suggested Action (fix-immediately/investigate/schedule/monitor)

Consider these factors:
- Is it blocking core functionality?
- Does it affect security or compliance?
- Is it a widespread issue?
- Does it impact user trust?
- Is it easily reproducible?

Respond in JSON format:
{
  "category": "critical|high|medium|low",
  "priority": "urgent|high|normal|low",
  "sentiment": "positive|negative|neutral",
  "tags": ["tag1", "tag2", ...],
  "estimatedImpact": "high|medium|low",
  "suggestedAction": "fix-immediately|investigate|schedule|monitor",
  "reasoning": "Brief explanation of your analysis"
}
    `;
  }

  private parseAIResponse(response: string): FeedbackAnalysis {
    try {
      const parsed = JSON.parse(response);
      return {
        category: parsed.category || "medium",
        priority: parsed.priority || "normal",
        sentiment: parsed.sentiment || "neutral",
        tags: parsed.tags || [],
        estimatedImpact: parsed.estimatedImpact || "medium",
        suggestedAction: parsed.suggestedAction || "investigate",
        similarIssues: 0,
        affectedUsers: 0,
        potentialRevenue: 0,
      };
    } catch {
      // Fallback to basic categorization
      return {
        category: "medium",
        priority: "normal",
        sentiment: "neutral",
        tags: [],
        estimatedImpact: "medium",
        suggestedAction: "investigate",
        similarIssues: 0,
        affectedUsers: 0,
        potentialRevenue: 0,
      };
    }
  }

  private async findSimilarFeedback(
    text: string,
    type: string,
  ): Promise<any[]> {
    // Use vector search to find similar feedback
    const similar = await this.vectorSearch.search({
      query: text,
      topK: 10,
      filter: { type },
      threshold: 0.7,
    });

    return similar || [];
  }

  private async estimateAffectedUsers(
    feedback: any,
    similarIssues: any[],
  ): Promise<number> {
    // Base count from similar issues
    let affectedUsers = similarIssues.length;

    // Factor in the type of issue
    if (feedback.type === "bug" && feedback.category === "critical") {
      affectedUsers *= 5; // Critical bugs likely affect more users
    }

    // Check if issue affects core features
    const coreFeatures = [
      "authentication",
      "document-upload",
      "api-access",
      "data-security",
    ];
    const affectsCore = coreFeatures.some(
      (feature) =>
        feedback.description.toLowerCase().includes(feature) ||
        feedback.title.toLowerCase().includes(feature),
    );

    if (affectsCore) {
      affectedUsers *= 3;
    }

    return Math.min(affectedUsers, 100); // Cap at 100 for beta program
  }

  private calculateRevenueImpact(
    analysis: FeedbackAnalysis,
    affectedUsers: number,
  ): number {
    // Simple revenue impact calculation for beta
    const baseImpact = {
      critical: 1000,
      high: 500,
      medium: 100,
      low: 25,
    };

    const baseValue = baseImpact[analysis.category] || 100;
    return baseValue * affectedUsers;
  }

  private async updateFeedbackAnalysis(
    feedbackId: string,
    analysis: Partial<FeedbackAnalysis>,
  ): Promise<void> {
    await this.db
      .prepare(
        `
        UPDATE beta_feedback
        SET category = ?, priority = ?, context = JSON_PATCH(
          COALESCE(context, '{}'),
          JSON_OBJECT('analysis', ?)
        )
        WHERE id = ?
      `,
      )
      .bind(
        analysis.category,
        analysis.priority,
        JSON.stringify(analysis),
        feedbackId,
      )
      .run();
  }

  private async generateSummary(feedbackData: any[]): Promise<{
    overview: string;
    keyFindings: string[];
  }> {
    const total = feedbackData.length;
    const bugs = feedbackData.filter((f) => f.type === "bug").length;
    const features = feedbackData.filter((f) => f.type === "feature").length;
    const critical = feedbackData.filter(
      (f) => f.category === "critical",
    ).length;

    return {
      overview: `Received ${total} feedback items this week: ${bugs} bug reports, ${features} feature requests, with ${critical} critical issues.`,
      keyFindings: [
        critical > 0
          ? `${critical} critical issues need immediate attention`
          : null,
        features > bugs
          ? "More feature requests than bugs - good engagement!"
          : "More bugs than features - focus on stability",
        `Top concern: ${this.getTopConcern(feedbackData)}`,
      ].filter(Boolean) as string[],
    };
  }

  private getTopConcern(feedbackData: any[]): string {
    // Simple keyword frequency analysis
    const keywords: Record<string, number> = {};

    feedbackData.forEach((f) => {
      const text = (f.title + " " + f.description).toLowerCase();
      const words = text.split(" ");
      words.forEach((word) => {
        if (word.length > 5) {
          keywords[word] = (keywords[word] || 0) + 1;
        }
      });
    });

    return (
      Object.entries(keywords).sort(([, a], [, b]) => b - a)[0]?.[0] ||
      "No clear pattern"
    );
  }

  private async analyzeSentimentTrends(
    feedbackData: any[],
  ): Promise<InsightReport["userSentiment"]> {
    // Analyze sentiment by phase and feature
    const sentimentByPhase: Record<string, number> = {};
    const sentimentByFeature: Record<string, number> = {};

    feedbackData.forEach((f) => {
      const phase = f.testing_phase || "unknown";
      const feature = f.context?.feature || "general";

      // Simple sentiment based on category
      const sentiment =
        f.category === "critical" ? -1 : f.type === "feature" ? 1 : 0;

      sentimentByPhase[phase] = (sentimentByPhase[phase] || 0) + sentiment;
      sentimentByFeature[feature] =
        (sentimentByFeature[feature] || 0) + sentiment;
    });

    // Calculate averages
    Object.keys(sentimentByPhase).forEach((phase) => {
      const count = feedbackData.filter(
        (f) => f.testing_phase === phase,
      ).length;
      sentimentByPhase[phase] = sentimentByPhase[phase] / count;
    });

    Object.keys(sentimentByFeature).forEach((feature) => {
      const count = feedbackData.filter(
        (f) => f.context?.feature === feature,
      ).length;
      sentimentByFeature[feature] = sentimentByFeature[feature] / count;
    });

    const overall =
      Object.values(sentimentByPhase).reduce((a, b) => a + b, 0) /
      Object.keys(sentimentByPhase).length;

    return {
      overall,
      byPhase: sentimentByPhase,
      byFeature: sentimentByFeature,
    };
  }

  private async identifyTopIssues(
    feedbackData: any[],
  ): Promise<InsightReport["topIssues"]> {
    // Group similar issues and identify patterns
    const issueGroups: Record<string, any[]> = {};

    feedbackData.forEach((f) => {
      // Simple grouping by keywords
      const keywords = this.extractKeywords(f.title + " " + f.description);
      const key = keywords.slice(0, 2).join("-");

      if (!issueGroups[key]) {
        issueGroups[key] = [];
      }
      issueGroups[key].push(f);
    });

    // Sort by frequency and impact
    const sortedIssues = Object.entries(issueGroups)
      .map(([key, issues]) => ({
        issue: this.summarizeIssue(issues),
        count: issues.length,
        impact: this.calculateImpact(issues),
        recommendation: this.generateRecommendation(issues),
      }))
      .sort((a, b) => b.count * b.impact - a.count * a.impact)
      .slice(0, 5);

    return sortedIssues;
  }

  private extractKeywords(text: string): string[] {
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(" ")
      .filter((word) => word.length > 4)
      .filter(
        (word) =>
          ![
            "would",
            "could",
            "should",
            "there",
            "their",
            "about",
            "which",
            "being",
          ].includes(word),
      );

    // Count frequency
    const frequency: Record<string, number> = {};
    words.forEach((word) => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    // Return top keywords
    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  private summarizeIssue(issues: any[]): string {
    // Find common words in titles
    const titles = issues.map((i) => i.title.toLowerCase());
    const commonWords = this.findCommonWords(titles);
    return commonWords.slice(0, 3).join(" ") || "User-reported issue";
  }

  private findCommonWords(strings: string[]): string[] {
    const wordCount: Record<string, number> = {};

    strings.forEach((str) => {
      const words = str.split(" ");
      words.forEach((word) => {
        if (word.length > 3) {
          wordCount[word] = (wordCount[word] || 0) + 1;
        }
      });
    });

    return Object.entries(wordCount)
      .filter(([word, count]) => count > 1)
      .sort(([, a], [, b]) => b - a)
      .map(([word]) => word);
  }

  private calculateImpact(issues: any[]): string {
    const criticalCount = issues.filter(
      (i) => i.category === "critical",
    ).length;
    const highCount = issues.filter((i) => i.category === "high").length;

    if (criticalCount > 0) return "high";
    if (highCount > issues.length / 2) return "medium";
    return "low";
  }

  private generateRecommendation(issues: any[]): string {
    const types = new Set(issues.map((i) => i.type));

    if (types.has("bug")) {
      return "Fix bugs before next release";
    } else if (types.has("feature")) {
      return "Consider for roadmap planning";
    } else {
      return "Monitor for patterns";
    }
  }

  private async generateRecommendations(
    summary: any,
    topIssues: any[],
  ): Promise<InsightReport["recommendations"]> {
    const recommendations = [];

    // Based on critical issues
    if (summary.keyFindings.some((f: string) => f.includes("critical"))) {
      recommendations.push({
        priority: "high",
        action: "Address all critical bugs immediately",
        impact: "Prevent user churn",
        effort: "High",
      });
    }

    // Based on feature requests
    const featureRequests = topIssues.filter(
      (i) => i.issue.includes("feature") || i.issue.includes("add"),
    );
    if (featureRequests.length > 0) {
      recommendations.push({
        priority: "medium",
        action: "Review top feature requests for next sprint",
        impact: "Improve user satisfaction",
        effort: "Medium",
      });
    }

    // Based on patterns
    recommendations.push({
      priority: "normal",
      action: "Set up automated monitoring for recurring issues",
      impact: "Faster issue detection",
      effort: "Low",
    });

    return recommendations;
  }

  private async identifyEmergingTrends(
    feedbackData: any[],
  ): Promise<FeedbackTrend[]> {
    // Look for increasing frequency of topics
    const trends: FeedbackTrend[] = [];
    const topics: Record<string, any[]> = {};

    // Group by topic
    feedbackData.forEach((f) => {
      const topic = this.identifyTopic(f);
      if (!topics[topic]) {
        topics[topic] = [];
      }
      topics[topic].push(f);
    });

    // Analyze each topic
    Object.entries(topics).forEach(([topic, issues]) => {
      if (issues.length >= 3) {
        // Only consider topics with 3+ mentions
        trends.push({
          topic,
          count: issues.length,
          trend: this.calculateTrend(issues),
          sentiment: this.calculateSentiment(issues),
          urgency: this.calculateUrgency(issues),
          relatedFeatures: this.extractRelatedFeatures(issues),
          suggestedPriority: this.suggestPriority(issues),
        });
      }
    });

    return trends.sort((a, b) => b.urgency - a.urgency).slice(0, 5);
  }

  private identifyTopic(feedback: any): string {
    const text = (feedback.title + " " + feedback.description).toLowerCase();

    if (text.includes("slow") || text.includes("performance"))
      return "Performance";
    if (
      text.includes("bug") ||
      text.includes("error") ||
      text.includes("broken")
    )
      return "Bugs";
    if (
      text.includes("feature") ||
      text.includes("add") ||
      text.includes("request")
    )
      return "Feature Requests";
    if (
      text.includes("ui") ||
      text.includes("interface") ||
      text.includes("design")
    )
      return "UI/UX";
    if (
      text.includes("document") ||
      text.includes("upload") ||
      text.includes("file")
    )
      return "Document Processing";
    if (
      text.includes("api") ||
      text.includes("sdk") ||
      text.includes("integration")
    )
      return "API/SDK";

    return "Other";
  }

  private calculateTrend(
    issues: any[],
  ): "increasing" | "decreasing" | "stable" {
    // Check if issues are increasing over time
    const sorted = issues.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    const half = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, half).length;
    const secondHalf = sorted.slice(half).length;

    if (secondHalf > firstHalf * 1.5) return "increasing";
    if (secondHalf < firstHalf * 0.5) return "decreasing";
    return "stable";
  }

  private calculateSentiment(issues: any[]): number {
    const positive = issues.filter((i) => i.type === "feature").length;
    const negative = issues.filter((i) => i.category === "critical").length;

    return (positive - negative) / issues.length;
  }

  private calculateUrgency(issues: any[]): number {
    const urgent = issues.filter(
      (i) => i.priority === "urgent" || i.category === "critical",
    ).length;
    return (urgent / issues.length) * 100;
  }

  private extractRelatedFeatures(issues: any[]): string[] {
    const features = new Set<string>();

    issues.forEach((issue) => {
      if (issue.context?.feature) {
        features.add(issue.context.feature);
      }
    });

    return Array.from(features);
  }

  private suggestPriority(issues: any[]): string {
    const critical = issues.filter((i) => i.category === "critical").length;
    const urgent = issues.filter((i) => i.priority === "urgent").length;

    if (critical > 0 || urgent > 0) return "high";
    if (issues.length > 5) return "medium";
    return "low";
  }

  private async analyzeUserSegments(
    feedbackData: any[],
  ): Promise<InsightReport["userSegments"]> {
    const segments: Record<string, any> = {};

    // Group by experience level
    feedbackData.forEach((f) => {
      const segment = f.experience || "unknown";
      if (!segments[segment]) {
        segments[segment] = {
          feedback: [],
          satisfaction: 0,
          engagement: 0,
        };
      }
      segments[segment].feedback.push(f);
    });

    // Calculate metrics for each segment
    Object.entries(segments).forEach(([segment, data]) => {
      const feedback = data.feedback;

      // Satisfaction based on feedback type
      const positive = feedback.filter((f) => f.type === "feature").length;
      const negative = feedback.filter((f) => f.category === "critical").length;
      segments[segment].satisfaction =
        ((positive - negative) / feedback.length) * 100;

      // Engagement based on volume
      segments[segment].engagement = feedback.length;

      // Primary concerns
      segments[segment].primaryConcerns =
        this.identifyPrimaryConcerns(feedback);
    });

    return Object.entries(segments).map(([segment, data]) => ({
      segment,
      satisfaction: data.satisfaction,
      engagement: data.engagement,
      primaryConcerns: data.primaryConcerns,
    }));
  }

  private identifyPrimaryConcerns(feedback: any[]): string[] {
    const concerns = new Map<string, number>();

    feedback.forEach((f) => {
      const keywords = this.extractKeywords(f.title + " " + f.description);
      keywords.slice(0, 3).forEach((keyword) => {
        concerns.set(keyword, (concerns.get(keyword) || 0) + 1);
      });
    });

    return Array.from(concerns.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([concern]) => concern);
  }

  private async getHistoricalFeedbackData(days: number): Promise<any[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return await this.db
      .prepare(
        `
        SELECT DATE(created_at) as date,
               COUNT(*) as count,
               SUM(CASE WHEN type = 'bug' THEN 1 ELSE 0 END) as bugs,
               SUM(CASE WHEN type = 'feature' THEN 1 ELSE 0 END) as features,
               SUM(CASE WHEN category = 'critical' THEN 1 ELSE 0 END) as critical
        FROM beta_feedback
        WHERE created_at > ?
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,
      )
      .bind(startDate.toISOString())
      .all();
  }

  private prepareTimeSeriesData(historicalData: any[]): any[] {
    return historicalData.map((d) => ({
      date: d.date,
      volume: d.count,
      features: {
        dayOfWeek: new Date(d.date).getDay(),
        isWeekend:
          new Date(d.date).getDay() === 0 || new Date(d.date).getDay() === 6,
        bugRatio: d.bugs / d.count,
        criticalRatio: d.critical / d.count,
      },
    }));
  }

  private async predictCategoryBreakdown(
    totalVolume: number,
  ): Promise<Record<string, number>> {
    // Get historical averages
    const averages = await this.db
      .prepare(
        `
        SELECT
          type,
          COUNT(*) as total,
          (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM beta_feedback)) as percentage
        FROM beta_feedback
        WHERE created_at > DATE('now', '-30 days')
        GROUP BY type
      `,
      )
      .all();

    const breakdown: Record<string, number> = {};
    averages.results?.forEach((avg) => {
      breakdown[avg.type] = Math.round(totalVolume * (avg.percentage / 100));
    });

    return breakdown;
  }

  private async generateProactiveRecommendations(
    prediction: any,
    categories: Record<string, number>,
  ): Promise<string[]> {
    const recommendations = [];

    if (prediction.total > 50) {
      recommendations.push(
        "Prepare for increased feedback volume - ensure adequate support resources",
      );
    }

    if (categories.bug > categories.feature) {
      recommendations.push("Focus on stability and bug fixes for next release");
    }

    if (categories.critical > 0) {
      recommendations.push(
        "Proactively monitor for critical issues - consider hotfix preparation",
      );
    }

    return recommendations;
  }

  private async sendPriorityAlert(
    feedbackId: string,
    analysis: FeedbackAnalysis,
  ): Promise<void> {
    // Fetch feedback details
    const feedback = await this.db
      .prepare(
        `
        SELECT f.*, u.name, u.email
        FROM beta_feedback f
        JOIN beta_users u ON f.user_id = u.user_id
        WHERE f.id = ?
      `,
      )
      .bind(feedbackId)
      .first();

    if (
      feedback &&
      (analysis.category === "critical" || analysis.priority === "urgent")
    ) {
      // Send alert to admin team
      await this.monitoring.sendAlert({
        level: "critical",
        message: `Urgent/Critical feedback from ${feedback.name}: ${feedback.title}`,
        details: {
          feedbackId,
          category: analysis.category,
          priority: analysis.priority,
          user: feedback.email,
          description: feedback.description,
        },
        channels: ["slack", "email"],
        recipients: ["beta-team@sdlc.ai", "eng-leads@sdlc.ai"],
      });
    }
  }
}

export default FeedbackAnalysisService;
