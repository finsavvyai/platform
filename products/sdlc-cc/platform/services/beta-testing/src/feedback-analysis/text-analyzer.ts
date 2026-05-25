/**
 * Text Analyzer
 * Keyword extraction, issue summarization, concern identification
 */

import type { BetaFeedbackWithUserRow } from "../types";

export class TextAnalyzer {
  extractKeywords(text: string): string[] {
    const stopWords = [
      "would", "could", "should", "there", "their",
      "about", "which", "being",
    ];
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(" ")
      .filter((word) => word.length > 4)
      .filter((word) => !stopWords.includes(word));

    const frequency: Record<string, number> = {};
    words.forEach((word) => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  getTopConcern(feedbackData: BetaFeedbackWithUserRow[]): string {
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
      Object.entries(keywords)
        .sort(([, a], [, b]) => b - a)[0]?.[0] ||
      "No clear pattern"
    );
  }

  summarizeIssue(issues: BetaFeedbackWithUserRow[]): string {
    const titles = issues.map((i) => i.title.toLowerCase());
    const commonWords = this.findCommonWords(titles);
    return commonWords.slice(0, 3).join(" ") || "User-reported issue";
  }

  calculateImpact(issues: BetaFeedbackWithUserRow[]): string {
    const criticalCount = issues.filter(
      (i) => i.category === "critical",
    ).length;
    const highCount = issues.filter(
      (i) => i.category === "high",
    ).length;

    if (criticalCount > 0) return "high";
    if (highCount > issues.length / 2) return "medium";
    return "low";
  }

  generateRecommendation(
    issues: BetaFeedbackWithUserRow[],
  ): string {
    const types = new Set(issues.map((i) => i.type));
    if (types.has("bug")) return "Fix bugs before next release";
    if (types.has("feature")) return "Consider for roadmap planning";
    return "Monitor for patterns";
  }

  identifyPrimaryConcerns(
    feedback: BetaFeedbackWithUserRow[],
  ): string[] {
    const concerns = new Map<string, number>();
    feedback.forEach((f) => {
      const keywords = this.extractKeywords(
        f.title + " " + f.description,
      );
      keywords.slice(0, 3).forEach((keyword) => {
        concerns.set(keyword, (concerns.get(keyword) || 0) + 1);
      });
    });

    return Array.from(concerns.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([concern]) => concern);
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
      .filter(([_, count]) => count > 1)
      .sort(([, a], [, b]) => b - a)
      .map(([word]) => word);
  }
}
