import { logger } from "../utils/logger.js";
import { aiProviderClient } from "./AIProviderClient.js";

export class AIInsightsService {
  async generateAlertMessage(context: {
    testName: string;
    testType: string;
    alertSeverity: string;
    alertMessage: string;
    timestamp: string;
    metrics?: Record<string, unknown>;
  }): Promise<string | null> {
    try {
      const prompt = `Generate a concise, professional alert message for a test monitoring system.

Test Details:
- Name: ${context.testName}
- Type: ${context.testType}
- Alert Severity: ${context.alertSeverity}
- Original Message: ${context.alertMessage}
- Timestamp: ${context.timestamp}

Current Metrics:
${Object.entries(context.metrics || {})
          .map(([key, value]) => `- ${key}: ${value}`)
          .join("\n")}

Generate a clear, actionable alert message that explains what happened and what might need attention. Keep it under 200 characters.`;

      const response = await aiProviderClient.openAI.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are an expert in test monitoring and alerting. Generate clear, actionable alert messages for technical teams.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 100,
        temperature: 0.3,
      });

      return response.choices[0]?.message?.content?.trim() || null;
    } catch (error) {
      logger.error("AI alert message generation failed:", error);
      return null;
    }
  }

  async generateTestInsights(context: {
    test?: { name: string; testType: string };
    currentResult?: { success: boolean; duration: number; metrics?: Record<string, unknown> };
    historicalResults?: Array<{ success: boolean; duration: number }>;
  }): Promise<Record<string, unknown> | null> {
    try {
      const prompt = `Analyze the following test performance data and provide insights.

Test Information:
- Name: ${context.test?.name}
- Type: ${context.test?.testType}

Current Results:
- Success: ${context.currentResult?.success}
- Duration: ${context.currentResult?.duration}ms
- Metrics: ${JSON.stringify(context.currentResult?.metrics || {}, null, 2)}

Historical Performance (last ${context.historicalResults?.length || 0} runs):
${(context.historicalResults || [])
          .map(
            (result, index) =>
              `Run ${index + 1}: Success: ${result.success}, Duration: ${result.duration}ms`,
          )
          .join("\n")}

Provide insights about:
1. Performance trends
2. Potential issues or anomalies
3. Recommendations for improvement
4. Alert threshold suggestions

Format as JSON with fields: trends, issues, recommendations, suggestedThresholds`;

      const response = await aiProviderClient.openAI.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are an expert in test performance analysis. Provide data-driven insights and recommendations.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) return null;

      try {
        return JSON.parse(content);
      } catch {
        return { insights: content };
      }
    } catch (error) {
      logger.error("AI test insights generation failed:", error);
      return null;
    }
  }

  async generateText(prompt: string): Promise<string> {
    try {
      const response = await aiProviderClient.openAI.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.7,
      });
      return response.choices[0]?.message?.content?.trim() || "";
    } catch (error) {
      logger.error("AI generateText failed:", error);
      return "";
    }
  }

  async generateContent(prompt: string): Promise<string> {
    return this.generateText(prompt);
  }
}

export const aiInsightsService = new AIInsightsService();
