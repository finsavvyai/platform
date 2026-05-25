#!/usr/bin/env node

/**
 * QuantumBeam MCP Server
 * Provides Model Context Protocol integration for fraud detection API
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

const QUANTUMBEAM_API_URL = process.env.QUANTUMBEAM_API_URL || "https://quantumbeam.io";
const API_KEY = process.env.QUANTUMBEAM_API_KEY || "";

class QuantumBeamMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "quantumbeam-fraud-detection",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "detect_fraud",
          description: "Analyze transaction for fraudulent activity using quantum-enhanced detection",
          inputSchema: {
            type: "object",
            properties: {
              transaction_id: {
                type: "string",
                description: "Unique transaction identifier",
              },
              amount: {
                type: "number",
                description: "Transaction amount",
              },
              currency: {
                type: "string",
                description: "Currency code (USD, EUR, etc.)",
              },
              merchant_id: {
                type: "string",
                description: "Merchant identifier",
              },
              card_number: {
                type: "string",
                description: "Card number (last 4 digits or masked)",
              },
              timestamp: {
                type: "string",
                description: "Transaction timestamp (ISO 8601)",
              },
              ip_address: {
                type: "string",
                description: "Customer IP address",
              },
              device_id: {
                type: "string",
                description: "Customer device fingerprint",
              },
              billing_address: {
                type: "object",
                description: "Billing address information",
              },
              shipping_address: {
                type: "object",
                description: "Shipping address information",
              },
            },
            required: ["transaction_id", "amount", "currency", "merchant_id"],
          },
        },
        {
          name: "analyze_pattern",
          description: "Analyze transaction patterns for suspicious behavior",
          inputSchema: {
            type: "object",
            properties: {
              customer_id: {
                type: "string",
                description: "Customer identifier",
              },
              time_window: {
                type: "string",
                description: "Time window for analysis (1h, 24h, 7d)",
              },
              pattern_type: {
                type: "string",
                description: "Pattern type: velocity, location, amount, timing",
                enum: ["velocity", "location", "amount", "timing"],
              },
            },
            required: ["customer_id", "time_window", "pattern_type"],
          },
        },
        {
          name: "get_risk_score",
          description: "Get comprehensive risk score for entity",
          inputSchema: {
            type: "object",
            properties: {
              entity_id: {
                type: "string",
                description: "Entity ID (customer, merchant, or device)",
              },
              entity_type: {
                type: "string",
                description: "Entity type",
                enum: ["customer", "merchant", "device", "ip_address"],
              },
              include_history: {
                type: "boolean",
                description: "Include historical risk factors",
              },
            },
            required: ["entity_id", "entity_type"],
          },
        },
        {
          name: "check_sanctions",
          description: "Check entity against sanctions and watchlists",
          inputSchema: {
            type: "object",
            properties: {
              entity_name: {
                type: "string",
                description: "Entity name to check",
              },
              entity_type: {
                type: "string",
                description: "Entity type",
                enum: ["individual", "business", "organization"],
              },
              country: {
                type: "string",
                description: "Country code",
              },
              date_of_birth: {
                type: "string",
                description: "Date of birth (YYYY-MM-DD) for individuals",
              },
            },
            required: ["entity_name", "entity_type"],
          },
        },
        {
          name: "get_transaction_status",
          description: "Get status and processing details of a transaction",
          inputSchema: {
            type: "object",
            properties: {
              transaction_id: {
                type: "string",
                description: "Transaction identifier",
              },
              include_details: {
                type: "boolean",
                description: "Include detailed analysis results",
              },
            },
            required: ["transaction_id"],
          },
        },
        {
          name: "update_rules",
          description: "Update fraud detection rules and thresholds",
          inputSchema: {
            type: "object",
            properties: {
              rule_type: {
                type: "string",
                description: "Rule type to update",
                enum: ["amount_threshold", "velocity_limit", "risk_threshold", "geographic"],
              },
              parameters: {
                type: "object",
                description: "Rule parameters",
              },
              merchant_id: {
                type: "string",
                description: "Merchant ID for specific rules (optional)",
              },
            },
            required: ["rule_type", "parameters"],
          },
        },
        {
          name: "get_analytics",
          description: "Get fraud detection analytics and metrics",
          inputSchema: {
            type: "object",
            properties: {
              time_period: {
                type: "string",
                description: "Time period for analytics",
                enum: ["1h", "24h", "7d", "30d"],
              },
              metric_type: {
                type: "string",
                description: "Type of metrics to retrieve",
                enum: ["detection_rate", "false_positives", "risk_distribution", "top_patterns"],
              },
              merchant_filter: {
                type: "string",
                description: "Filter by specific merchant (optional)",
              },
            },
            required: ["time_period", "metric_type"],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "detect_fraud":
            return await this.detectFraud(args);
          case "analyze_pattern":
            return await this.analyzePattern(args);
          case "get_risk_score":
            return await this.getRiskScore(args);
          case "check_sanctions":
            return await this.checkSanctions(args);
          case "get_transaction_status":
            return await this.getTransactionStatus(args);
          case "update_rules":
            return await this.updateRules(args);
          case "get_analytics":
            return await this.getAnalytics(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error.message}`
        );
      }
    });
  }

  async detectFraud(args) {
    const response = await fetch(`${QUANTUMBEAM_API_URL}/api/fraud/detect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(`Fraud detection failed: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      content: [
        {
          type: "text",
          text: `Fraud Detection Results for Transaction ${args.transaction_id}:

Risk Score: ${result.risk_score}/100
Status: ${result.is_fraudulent ? "FRAUDULENT" : "LEGITIMATE"}
Confidence: ${result.confidence}%
Processing Time: ${result.processing_time_ms}ms

Key Risk Factors:
${result.risk_factors.map(factor => `- ${factor.type}: ${factor.severity} (${factor.description})`).join('\n')}

Recommendation: ${result.recommendation}
${result.action_required ? "⚠️  Action Required: " + result.action_required : ""}`,
        },
      ],
    };
  }

  async analyzePattern(args) {
    const response = await fetch(`${QUANTUMBEAM_API_URL}/api/patterns/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(`Pattern analysis failed: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      content: [
        {
          type: "text",
          text: `Pattern Analysis for Customer ${args.customer_id}:

Time Window: ${args.time_window}
Pattern Type: ${args.pattern_type}

Analysis Results:
- Pattern Detected: ${result.pattern_detected ? "Yes" : "No"}
- Risk Level: ${result.risk_level}
- Transactions Analyzed: ${result.transaction_count}
- Anomaly Score: ${result.anomaly_score}/100

${result.pattern_detected ? `Pattern Details:
${result.pattern_details.map(detail => `- ${detail}`).join('\n')}` : "No suspicious patterns detected."}

Recommendations:
${result.recommendations.map(rec => `- ${rec}`).join('\n')}`,
        },
      ],
    };
  }

  async getRiskScore(args) {
    const params = new URLSearchParams({
      entity_id: args.entity_id,
      entity_type: args.entity_type,
      include_history: args.include_history || false,
    });

    const response = await fetch(`${QUANTUMBEAM_API_URL}/api/risk/score?${params}`, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Risk score retrieval failed: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      content: [
        {
          type: "text",
          text: `Risk Score for ${args.entity_type} ${args.entity_id}:

Overall Risk Score: ${result.overall_score}/100
Risk Category: ${result.risk_category}
Confidence: ${result.confidence}%

Risk Factors Breakdown:
${result.risk_factors.map(factor => `- ${factor.name}: ${factor.score}/100 (${factor.weight}% weight)`).join('\n')}

${args.include_history && result.historical_analysis ? `
Historical Analysis:
- 30-day Trend: ${result.historical_analysis.trend_30d}
- Risk Evolution: ${result.historical_analysis.evolution}
- Notable Events: ${result.historical_analysis.events.length}
` : ""}

Recommendations:
${result.recommendations.map(rec => `- ${rec}`).join('\n')}`,
        },
      ],
    };
  }

  async checkSanctions(args) {
    const response = await fetch(`${QUANTUMBEAM_API_URL}/api/compliance/sanctions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(`Sanctions check failed: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      content: [
        {
          type: "text",
          text: `Sanctions Check for ${args.entity_name}:

Status: ${result.is_match ? "⚠️  MATCH FOUND" : "✅ No Match"}
Checked Databases: ${result.databases_checked.join(", ")}

${result.is_match ? `
⚠️  POTENTIAL SANCTIONS MATCH:
- Match Type: ${result.match_type}
- List: ${result.match_list}
- Confidence: ${result.confidence}%
- Details: ${result.match_details}

❌ ACTION REQUIRED: Manual review recommended before proceeding with this transaction.
` : "No sanctions list matches found. Transaction may proceed.")}

Last Updated: ${result.timestamp}
`,
        },
      ],
    };
  }

  async getTransactionStatus(args) {
    const params = new URLSearchParams({
      transaction_id: args.transaction_id,
      include_details: args.include_details || false,
    });

    const response = await fetch(`${QUANTUMBEAM_API_URL}/api/transactions/status?${params}`, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Transaction status retrieval failed: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      content: [
        {
          type: "text",
          text: `Transaction Status: ${args.transaction_id}

Current Status: ${result.status}
Processed: ${result.processed ? "Yes" : "No"}
Risk Score: ${result.risk_score}/100
Decision: ${result.decision}

${result.processed ? `
Processing Details:
- Processing Time: ${result.processing_time_ms}ms
- Timestamp: ${result.timestamp}
- Models Used: ${result.models_used.join(", ")}

${args.include_details && result.analysis_details ? `
Detailed Analysis:
${result.analysis_details.map(detail => `- ${detail.aspect}: ${detail.result}`).join('\n')}
` : ""}
` : "Transaction is still being processed..."}

Next Steps: ${result.next_steps}`,
        },
      ],
    };
  }

  async updateRules(args) {
    const response = await fetch(`${QUANTUMBEAM_API_URL}/api/rules/update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(`Rule update failed: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      content: [
        {
          type: "text",
          text: `Rule Update Completed:

Rule Type: ${args.rule_type}
Status: ${result.success ? "✅ Updated" : "❌ Failed"}
${args.merchant_id ? `Scope: Merchant ${args.merchant_id}` : "Scope: Global"}

${result.success ? `
Updated Parameters:
${Object.entries(result.updated_parameters).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

Changes Applied: ${result.changes_applied}
Effective Immediately: ${result.effective_immediately ? "Yes" : "No"}
` : `Error: ${result.error}`}

${result.rollback_available ? "ℹ️  Rollback available if issues occur" : ""}`,
        },
      ],
    };
  }

  async getAnalytics(args) {
    const params = new URLSearchParams({
      time_period: args.time_period,
      metric_type: args.metric_type,
      ...(args.merchant_filter && { merchant_filter: args.merchant_filter }),
    });

    const response = await fetch(`${QUANTUMBEAM_API_URL}/api/analytics?${params}`, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Analytics retrieval failed: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      content: [
        {
          type: "text",
          text: `QuantumBeam Analytics - ${args.metric_type} (${args.time_period})

${args.merchant_filter ? `Merchant Filter: ${args.merchant_filter}` : "Global Analytics"}

${result.data ? Object.entries(result.data).map(([key, value]) => `${key}: ${value}`).join('\n') : "No data available for this period."}

${result.insights ? `
Key Insights:
${result.insights.map(insight => `- ${insight}`).join('\n')}
` : ""}

Generated: ${result.timestamp}
Period: ${result.period}`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("QuantumBeam MCP server running on stdio");
  }
}

const server = new QuantumBeamMCPServer();
server.run().catch(console.error);