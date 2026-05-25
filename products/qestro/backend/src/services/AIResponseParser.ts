import type { BugAnalysisRequest } from "../types/ai.types.js";

export function calculateConfidence(content: string): number {
  if (content.length < 100) return 0.3;
  if (content.includes("TODO") || content.includes("...")) return 0.6;
  if (content.includes("function") || content.includes("test")) return 0.8;
  return 0.9;
}

export function extractSuggestions(content: string): string[] {
  const lines = content.split("\n");
  return lines
    .filter(
      (line) =>
        line.includes("suggest") ||
        line.includes("recommend") ||
        line.includes("consider"),
    )
    .slice(0, 3);
}

export function parseBugAnalysis(content: string): Record<string, unknown> {
  try {
    return JSON.parse(content);
  } catch {
    return {
      severity: extractValue(content, "severity") || "medium",
      category: extractValue(content, "category") || "general",
      suggestedFix:
        extractValue(content, "fix") || content.substring(0, 500),
      confidence: 0.7,
    };
  }
}

export function parsePerformanceAnalysis(
  content: string,
): Record<string, unknown> {
  try {
    return JSON.parse(content);
  } catch {
    return {
      bottlenecks: ["Analysis completed"],
      optimizations: ["Review performance metrics"],
      trends: ["Stable performance"],
      confidence: 0.6,
    };
  }
}

export function extractValue(text: string, key: string): string | null {
  const regex = new RegExp(`${key}[:\\s]+([^\\n]+)`, "i");
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

export function extractImprovements(content: string): string[] {
  return content
    .split("\n")
    .filter(
      (line) =>
        line.includes("improve") ||
        line.includes("optimize") ||
        line.includes("enhance"),
    )
    .slice(0, 5);
}

export function estimatePerformanceGain(
  original: string,
  optimized: string,
): number {
  const originalLines = original.split("\n").length;
  const optimizedLines = optimized.split("\n").length;
  if (optimizedLines < originalLines) return 0.2;
  return 0.1;
}

export function estimateSeverity(request: BugAnalysisRequest): string {
  if (request.stackTrace && request.stackTrace.includes("Error"))
    return "high";
  if (request.description.toLowerCase().includes("crash")) return "critical";
  if (request.description.toLowerCase().includes("slow")) return "medium";
  return "low";
}
