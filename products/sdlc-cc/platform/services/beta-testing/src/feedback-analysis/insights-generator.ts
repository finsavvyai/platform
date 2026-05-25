/**
 * Insights Generator
 * Weekly summary, sentiment trends, top issues, recommendations
 */

import type {
  InsightReport,
  TopIssue,
  BetaFeedbackWithUserRow,
  SegmentAccumulator,
} from "../types";
import { TextAnalyzer } from "./text-analyzer";

export class InsightsGenerator {
  private textAnalyzer: TextAnalyzer;

  constructor() {
    this.textAnalyzer = new TextAnalyzer();
  }

  async generateSummary(
    feedbackData: BetaFeedbackWithUserRow[],
  ): Promise<{ overview: string; keyFindings: string[] }> {
    const total = feedbackData.length;
    const bugs = feedbackData.filter((f) => f.type === "bug").length;
    const features = feedbackData.filter(
      (f) => f.type === "feature",
    ).length;
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
        `Top concern: ${this.textAnalyzer.getTopConcern(feedbackData)}`,
      ].filter(Boolean) as string[],
    };
  }

  async analyzeSentimentTrends(
    feedbackData: BetaFeedbackWithUserRow[],
  ): Promise<InsightReport["userSentiment"]> {
    const sentimentByPhase: Record<string, number> = {};
    const sentimentByFeature: Record<string, number> = {};

    feedbackData.forEach((f) => {
      const phase = f.testing_phase || "unknown";
      const feature = f.context?.feature || "general";
      const sentiment =
        f.category === "critical" ? -1 : f.type === "feature" ? 1 : 0;
      sentimentByPhase[phase] =
        (sentimentByPhase[phase] || 0) + sentiment;
      sentimentByFeature[feature] =
        (sentimentByFeature[feature] || 0) + sentiment;
    });

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
      sentimentByFeature[feature] =
        sentimentByFeature[feature] / count;
    });

    const overall =
      Object.values(sentimentByPhase).reduce((a, b) => a + b, 0) /
      Object.keys(sentimentByPhase).length;

    return { overall, byPhase: sentimentByPhase, byFeature: sentimentByFeature };
  }

  async identifyTopIssues(
    feedbackData: BetaFeedbackWithUserRow[],
  ): Promise<InsightReport["topIssues"]> {
    const issueGroups: Record<string, BetaFeedbackWithUserRow[]> = {};

    feedbackData.forEach((f) => {
      const keywords = this.textAnalyzer.extractKeywords(
        f.title + " " + f.description,
      );
      const key = keywords.slice(0, 2).join("-");
      if (!issueGroups[key]) issueGroups[key] = [];
      issueGroups[key].push(f);
    });

    return Object.entries(issueGroups)
      .map(([_, issues]) => ({
        issue: this.textAnalyzer.summarizeIssue(issues),
        count: issues.length,
        impact: this.textAnalyzer.calculateImpact(issues),
        recommendation: this.textAnalyzer.generateRecommendation(issues),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  async generateRecommendations(
    summary: { overview: string; keyFindings: string[] },
    topIssues: TopIssue[],
  ): Promise<InsightReport["recommendations"]> {
    const recommendations = [];

    if (summary.keyFindings.some((f: string) => f.includes("critical"))) {
      recommendations.push({
        priority: "high",
        action: "Address all critical bugs immediately",
        impact: "Prevent user churn",
        effort: "High",
      });
    }

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

    recommendations.push({
      priority: "normal",
      action: "Set up automated monitoring for recurring issues",
      impact: "Faster issue detection",
      effort: "Low",
    });

    return recommendations;
  }

  async analyzeUserSegments(
    feedbackData: BetaFeedbackWithUserRow[],
  ): Promise<InsightReport["userSegments"]> {
    const segments: Record<string, SegmentAccumulator> = {};

    feedbackData.forEach((f) => {
      const segment = f.experience || "unknown";
      if (!segments[segment]) {
        segments[segment] = {
          feedback: [], satisfaction: 0, engagement: 0,
        };
      }
      segments[segment].feedback.push(f);
    });

    Object.entries(segments).forEach(([segment, data]) => {
      const feedback = data.feedback;
      const positive = feedback.filter(
        (f) => f.type === "feature",
      ).length;
      const negative = feedback.filter(
        (f) => f.category === "critical",
      ).length;
      segments[segment].satisfaction =
        ((positive - negative) / feedback.length) * 100;
      segments[segment].engagement = feedback.length;
      segments[segment].primaryConcerns =
        this.textAnalyzer.identifyPrimaryConcerns(feedback);
    });

    return Object.entries(segments).map(([segment, data]) => ({
      segment,
      satisfaction: data.satisfaction,
      engagement: data.engagement,
      primaryConcerns: data.primaryConcerns,
    }));
  }
}
