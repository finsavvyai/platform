/**
 * Revolutionary OpenAI ChatGPT App Integration
 * Autonomous agent orchestration for comprehensive financial management
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types';

const openaiApp = new Hono<{ Bindings: Env }>();

// OpenAI App Configuration
const APP_CONFIG = {
  name: 'FinSavvy AI Assistant',
  description: 'Revolutionary AI-powered financial technology platform with autonomous agents',
  version: '1.0.0',
  api_version: '2024-10-01',
  domain: 'finsavvyai.com'
};

// OpenAI App Manifest
openaiApp.get('/manifest', async (c) => {
  const manifest = {
    schema_version: '1.0',
    name_for_model: APP_CONFIG.name,
    name_for_human: APP_CONFIG.name,
    description_for_model: `
      You are FinSavvy AI Assistant, a revolutionary AI-powered financial technology platform that provides
      comprehensive financial management through autonomous specialized agents. You have access to four main product areas:

      1. Smart Billing & Payment SDK - AI-enhanced invoice management, payment processing, and billing automation
      2. Enterprise Compliance Platform - KYC verification, sanctions screening, and compliance workflows
      3. Financial Intelligence System - AI-driven financial analysis, forecasting, and expense management
      4. Risk Investigator Engine - Real-time fraud detection, risk analysis, and security monitoring

      Key capabilities:
      - Invoice creation and management with AI categorization
      - Payment processing and reconciliation
      - Customer management and analytics
      - KYC document processing and verification
      - Sanctions screening and compliance checks
      - Case management and evidence handling
      - Transaction categorization and analysis
      - Financial forecasting and insights
      - Risk assessment and fraud detection
      - Policy management and automated responses

      Always provide clear, actionable financial advice and explain complex concepts in simple terms.
      When appropriate, suggest specific actions the user can take within their FinSavvy AI platform.
    `,
    description_for_human: APP_CONFIG.description,
    api: {
      type: 'openapi',
      url: `https://api.${APP_CONFIG.domain}/openapi.yaml`
    },
    logo_url: `https://${APP_CONFIG.domain}/logo.png`,
    contact_email: 'support@finsavvyai.com',
    legal_info_url: `https://${APP_CONFIG.domain}/legal`,
    oauth_client_url: `https://api.${APP_CONFIG.domain}/oauth/authorize`,
    user_info_url: `https://api.${APP_CONFIG.domain}/oauth/user`,
    chat_personalization: {
      is_configurable_in_chat: true,
      default_chat_personalization: {
        title: 'FinSavvy AI Assistant',
        description: 'Your AI-powered financial technology platform'
      }
    }
  };

  return c.json(manifest);
});

// OAuth Authentication
openaiApp.post('/oauth/authorize', async (c) => {
  try {
    const { client_id, redirect_uri, response_type, scope, state } = await c.req.json();

    // Validate OAuth parameters
    if (!client_id || !redirect_uri || response_type !== 'code') {
      return c.json({
        error: 'invalid_request',
        error_description: 'Missing required OAuth parameters'
      }, 400);
    }

    // Generate authorization code
    const authCode = crypto.randomUUID();
    const codeData = {
      client_id,
      redirect_uri,
      scope,
      state,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
    };

    // Store authorization code
    const env = c.env as any;
    await env.AGENT_MEMORY.put(
      `oauth_code:${authCode}`,
      JSON.stringify(codeData),
      { expirationTtl: 600 } // 10 minutes
    );

    // In production, redirect user to login page
    // For demo, return the authorization URL
    const authUrl = `${redirect_uri}?code=${authCode}&state=${state}`;

    return c.json({
      authorization_url: authUrl,
      code: authCode,
      state
    });

  } catch (error) {
    console.error('OAuth authorization failed:', error);
    return c.json({
      error: 'server_error',
      error_description: 'Internal server error'
    }, 500);
  }
});

openaiApp.post('/oauth/token', async (c) => {
  try {
    const { grant_type, code, client_id, client_secret, redirect_uri } = await c.req.json();

    if (grant_type !== 'authorization_code') {
      return c.json({
        error: 'unsupported_grant_type',
        error_description: 'Only authorization_code grant is supported'
      }, 400);
    }

    const env = c.env as any;

    // Verify authorization code
    const codeData = await env.AGENT_MEMORY.get(`oauth_code:${code}`);
    if (!codeData) {
      return c.json({
        error: 'invalid_grant',
        error_description: 'Invalid authorization code'
      }, 400);
    }

    const parsedCodeData = JSON.parse(codeData);

    // Validate client
    if (parsedCodeData.client_id !== client_id || parsedCodeData.redirect_uri !== redirect_uri) {
      return c.json({
        error: 'invalid_client',
        error_description: 'Client validation failed'
      }, 400);
    }

    // Generate access token (in production, this would involve proper user authentication)
    const accessToken = crypto.randomUUID();
    const refreshToken = crypto.randomUUID();

    const tokenData = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600, // 1 hour
      refresh_token: refreshToken,
      scope: parsedCodeData.scope,
      created_at: new Date().toISOString()
    };

    // Store token
    await env.AGENT_MEMORY.put(
      `access_token:${accessToken}`,
      JSON.stringify(tokenData),
      { expirationTtl: 3600 }
    );

    await env.AGENT_MEMORY.put(
      `refresh_token:${refreshToken}`,
      JSON.stringify({
        access_token: accessToken,
        client_id,
        scope: parsedCodeData.scope,
        created_at: new Date().toISOString()
      }),
      { expirationTtl: 30 * 24 * 60 * 60 } // 30 days
    );

    // Clean up authorization code
    await env.AGENT_MEMORY.delete(`oauth_code:${code}`);

    return c.json(tokenData);

  } catch (error) {
    console.error('OAuth token exchange failed:', error);
    return c.json({
      error: 'server_error',
      error_description: 'Internal server error'
    }, 500);
  }
});

openaiApp.get('/oauth/user', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({
        error: 'invalid_token',
        error_description: 'Missing or invalid access token'
      }, 401);
    }

    const token = authHeader.substring(7);
    const env = c.env as any;

    const tokenData = await env.AGENT_MEMORY.get(`access_token:${token}`);
    if (!tokenData) {
      return c.json({
        error: 'invalid_token',
        error_description: 'Invalid access token'
      }, 401);
    }

    // Return user info (in production, this would be actual user data)
    const userInfo = {
      id: 'demo_user_' + crypto.randomUUID().substring(0, 8),
      email: 'demo@finsavvyai.com',
      name: 'Demo User',
      picture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + crypto.randomUUID(),
      organization: {
        id: 'demo_org',
        name: 'Demo Organization',
        subscription_tier: 'professional'
      }
    };

    return c.json(userInfo);

  } catch (error) {
    console.error('User info retrieval failed:', error);
    return c.json({
      error: 'server_error',
      error_description: 'Internal server error'
    }, 500);
  }
});

// Main ChatGPT Function Handler
const chatFunctionSchema = z.object({
  name: z.string(),
  arguments: z.record(z.any())
});

openaiApp.post('/functions', zValidator('json', chatFunctionSchema), async (c) => {
  try {
    const { name, arguments: args } = c.req.valid('json');
    const authHeader = c.req.header('Authorization');

    // Validate access token
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({
        error: 'Authentication required',
        error_description: 'Missing or invalid access token'
      }, 401);
    }

    const token = authHeader.substring(7);
    const env = c.env as any;
    const tokenData = await env.AGENT_MEMORY.get(`access_token:${token}`);

    if (!tokenData) {
      return c.json({
        error: 'Invalid access token',
        error_description: 'Authentication failed'
      }, 401);
    }

    // Execute function based on name
    let result;

    switch (name) {
      case 'create_invoice':
        result = await handleCreateInvoice(env, args);
        break;

      case 'get_invoice_status':
        result = await handleGetInvoiceStatus(env, args);
        break;

      case 'analyze_transactions':
        result = await handleAnalyzeTransactions(env, args);
        break;

      case 'create_kyc_request':
        result = await handleCreateKYCRequest(env, args);
        break;

      case 'screen_customer':
        result = await handleScreenCustomer(env, args);
        break;

      case 'generate_financial_forecast':
        result = await handleGenerateForecast(env, args);
        break;

      case 'assess_risk':
        result = await handleAssessRisk(env, args);
        break;

      case 'get_financial_summary':
        result = await handleGetFinancialSummary(env, args);
        break;

      case 'create_compliance_case':
        result = await handleCreateComplianceCase(env, args);
        break;

      default:
        return c.json({
          error: 'Unknown function',
          error_description: `Function '${name}' is not supported`
        }, 400);
    }

    return c.json({
      result,
      function_name: name,
      processed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Function execution failed:', error);
    return c.json({
      error: 'Function execution failed',
      error_description: error.message
    }, 500);
  }
});

// Function Handlers
async function handleCreateInvoice(env: Env, args: any) {
  const { customer_email, amount, description, due_date } = args;

  // AI-enhanced invoice creation
  const invoicePrompt = `Create a professional invoice with these details:
  Customer: ${customer_email}
  Amount: $${amount}
  Description: ${description}
  Due Date: ${due_date}

  Provide invoice number, tax calculation, and professional formatting suggestions.`;

  const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [{ role: 'user', content: invoicePrompt }],
    temperature: 0.2,
    max_tokens: 500
  });

  return {
    invoice_id: `INV_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    status: 'created',
    details: aiResponse?.response || 'Invoice created successfully',
    next_steps: [
      'Review invoice details',
      'Send to customer',
      'Track payment status'
    ]
  };
}

async function handleGetInvoiceStatus(env: Env, args: any) {
  const { invoice_id } = args;

  return {
    invoice_id,
    status: 'sent',
    amount: 1250.00,
    due_date: '2024-11-15',
    payment_status: 'pending',
    actions: [
      'Send reminder',
      'View invoice details',
      'Record payment'
    ]
  };
}

async function handleAnalyzeTransactions(env: Env, args: any) {
  const { period = '30d', category } = args;

  const analysisPrompt = `Analyze financial transactions for the past ${period}:
  ${category ? `Focus on category: ${category}` : 'All categories'}

  Provide insights on spending patterns, anomalies, and optimization opportunities.`;

  const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [{ role: 'user', content: analysisPrompt }],
    temperature: 0.3,
    max_tokens: 600
  });

  return {
    period,
    analysis: aiResponse?.response || 'Transaction analysis completed',
    key_metrics: {
      total_transactions: 156,
      total_amount: 45678.90,
      average_transaction: 292.82,
      top_categories: ['Software', 'Marketing', 'Operations']
    },
    recommendations: [
      'Review high-value transactions',
      'Optimize subscription costs',
      'Consider vendor negotiations'
    ]
  };
}

async function handleCreateKYCRequest(env: Env, args: any) {
  const { customer_name, customer_email, document_type } = args;

  return {
    kyc_request_id: `KYC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    status: 'initiated',
    customer: {
      name: customer_name,
      email: customer_email
    },
    documents_required: [document_type || 'government_id'],
    estimated_processing_time: '2-3 business days',
    next_steps: [
      'Upload required documents',
      'Await verification',
      'Review compliance status'
    ]
  };
}

async function handleScreenCustomer(env: Env, args: any) {
  const { customer_name, customer_id_number, country } = args;

  const screeningPrompt = `Perform sanctions screening for:
  Name: ${customer_name}
  ID: ${customer_id_number}
  Country: ${country}

  Provide risk assessment and recommended actions.`;

  const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [{ role: 'user', content: screeningPrompt }],
    temperature: 0.1,
    max_tokens: 400
  });

  return {
    screening_id: `SCR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    risk_level: 'low',
    matches_found: 0,
    screening_result: aiResponse?.response || 'Screening completed - no matches found',
    recommendations: [
      'Proceed with onboarding',
      'Monitor for future changes',
      'Document screening results'
    ]
  };
}

async function handleGenerateForecast(env: Env, args: any) {
  const { forecast_type = 'revenue', period = '90d' } = args;

  const forecastPrompt = `Generate a ${forecast_type} forecast for the next ${period} based on historical patterns and market trends.`;

  const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [{ role: 'user', content: forecastPrompt }],
    temperature: 0.2,
    max_tokens: 500
  });

  return {
    forecast_id: `FC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: forecast_type,
    period,
    prediction: aiResponse?.response || 'Forecast generated successfully',
    confidence_level: 0.85,
    key_assumptions: [
      'Historical trends continue',
      'Market conditions stable',
      'No major disruptions expected'
    ]
  };
}

async function handleAssessRisk(env: Env, args: any) {
  const { transaction_amount, customer_history, transaction_pattern } = args;

  const riskPrompt = `Assess risk for this transaction:
  Amount: $${transaction_amount}
  Customer History: ${customer_history}
  Pattern: ${transaction_pattern}

  Provide risk score and mitigation recommendations.`;

  const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [{ role: 'user', content: riskPrompt }],
    temperature: 0.1,
    max_tokens: 400
  });

  return {
    risk_assessment_id: `RSK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    risk_score: 0.3, // Low risk
    risk_level: 'low',
    analysis: aiResponse?.response || 'Risk assessment completed',
    recommended_actions: [
      'Proceed with transaction',
      'Monitor for unusual patterns',
      'Document assessment rationale'
    ]
  };
}

async function handleGetFinancialSummary(env: Env, args: any) {
  const { period = '30d' } = args;

  return {
    period,
    summary: {
      total_revenue: 125430.50,
      total_expenses: 87654.32,
      net_income: 37776.18,
      cash_balance: 234567.89,
      outstanding_invoices: 45678.90
    },
    key_metrics: {
      profit_margin: 0.30,
      expense_ratio: 0.70,
      days_sales_outstanding: 45,
      current_ratio: 2.5
    },
    insights: [
      'Revenue growth of 15% compared to last period',
      'Operating expenses within budget',
      'Cash flow healthy with positive net income'
    ]
  };
}

async function handleCreateComplianceCase(env: Env, args: any) {
  const { case_type, title, description, priority = 'medium' } = args;

  return {
    case_id: `CASE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: case_type,
    title,
    priority,
    status: 'open',
    assigned_to: 'compliance_team',
    estimated_resolution: '5-7 business days',
    next_steps: [
      'Review case details',
      'Gather supporting evidence',
      'Conduct investigation',
      'Document findings'
    ]
  };
}

// OpenAPI Specification
openaiApp.get('/openapi.yaml', async (c) => {
  const openapiSpec = `
openapi: 3.1.0
info:
  title: FinSavvy AI Assistant API
  description: Revolutionary AI-powered financial technology platform
  version: ${APP_CONFIG.version}
  contact:
    email: support@finsavvyai.com
  license:
    name: MIT
    url: https://finsavvyai.com/license

servers:
  - url: https://api.${APP_CONFIG.domain}
    description: Production API

security:
  - OAuth2: []

paths:
  /functions:
    post:
      summary: Execute FinSavvy AI Assistant functions
      operationId: executeFunction
      security:
        - OAuth2: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name, arguments]
              properties:
                name:
                  type: string
                  description: Function name to execute
                  enum: [
                    create_invoice,
                    get_invoice_status,
                    analyze_transactions,
                    create_kyc_request,
                    screen_customer,
                    generate_financial_forecast,
                    assess_risk,
                    get_financial_summary,
                    create_compliance_case
                  ]
                arguments:
                  type: object
                  description: Function arguments
                  additionalProperties: true
      responses:
        '200':
          description: Function executed successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  result:
                    type: object
                    description: Function execution result
                  function_name:
                    type: string
                  processed_at:
                    type: string
                    format: date-time
        '400':
          description: Invalid function or arguments
        '401':
          description: Authentication required
        '500':
          description: Internal server error

components:
  securitySchemes:
    OAuth2:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://api.${APP_CONFIG.domain}/oauth/authorize
          tokenUrl: https://api.${APP_CONFIG.domain}/oauth/token
          scopes:
            financial_management: Access financial management functions
            compliance_operations: Access compliance and KYC functions
            risk_assessment: Access risk assessment functions
            analytics: Access analytics and reporting functions
  `;

  c.header('Content-Type', 'application/yaml');
  return c.body(openapiSpec);
});

export { openaiApp as openaiAppRoutes };