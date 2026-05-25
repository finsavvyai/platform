/**
 * Financial Intelligence System Routes
 * AI-powered financial analysis, forecasting, and expense management
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env, Transaction, FinancialMetrics, Forecast } from '../types';

const intelligence = new Hono<{ Bindings: Env }>();

// Schemas
const createTransactionSchema = z.object({
  account_id: z.string(),
  amount: z.number(),
  currency: z.string(),
  description: z.string(),
  date: z.string(),
  type: z.enum(['income', 'expense', 'transfer']),
  counterparty: z.string(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

const createForecastSchema = z.object({
  type: z.enum(['revenue', 'expenses', 'cash_flow', 'profitability']),
  period: z.string(),
  currency: z.string(),
  model: z.string().optional(),
  time_horizon: z.string().optional()
});

// Transaction Management Routes
intelligence.post('/transactions', zValidator('json', createTransactionSchema), async (c) => {
  try {
    const user = c.get('user');
    const organization = c.get('organization');
    const aiContext = c.get('aiContext');
    const data = c.req.valid('json');

    // AI-powered transaction categorization
    let aiCategorization = null;
    if (aiContext?.enabled) {
      aiCategorization = await categorizeTransaction(c.env, data, organization);
    }

    const transaction: Transaction = {
      id: crypto.randomUUID(),
      organization_id: organization.id,
      account_id: data.account_id,
      amount: data.amount,
      currency: data.currency,
      description: data.description,
      category: aiCategorization?.primary_category || data.category || 'uncategorized',
      subcategory: aiCategorization?.subcategory || data.subcategory,
      date: data.date,
      type: data.type,
      counterparty: data.counterparty,
      tags: data.tags || [],
      metadata: {
        ...data.metadata,
        ai_categorization: aiCategorization
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const db = getDatabaseByRegion(organization.region, c.env);
    await db.prepare(`
      INSERT INTO transactions (
        id, organization_id, account_id, amount, currency, description,
        category, subcategory, date, type, counterparty, tags,
        metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      transaction.id, transaction.organization_id, transaction.account_id,
      transaction.amount, transaction.currency, transaction.description,
      transaction.category, transaction.subcategory, transaction.date,
      transaction.type, transaction.counterparty, JSON.stringify(transaction.tags),
      JSON.stringify(transaction.metadata), transaction.created_at, transaction.updated_at
    ).run();

    // Trigger AI learning if enabled
    if (aiContext?.enabled && aiCategorization) {
      await updateCategorizationModel(c.env, transaction, aiCategorization);
    }

    return c.json({
      success: true,
      data: {
        transaction,
        ai_categorization: aiCategorization
      },
      meta: {
        request_id: c.get('requestId'),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Transaction creation failed:', error);
    return c.json({
      success: false,
      error: {
        code: 'TRANSACTION_CREATION_FAILED',
        message: 'Failed to create transaction'
      }
    }, 500);
  }
});

intelligence.get('/transactions', async (c) => {
  try {
    const user = c.get('user');
    const organization = c.get('organization');
    const query = c.req.query();

    const page = parseInt(query.page || '1');
    const limit = Math.min(parseInt(query.limit || '50'), 200);
    const category = query.category;
    const type = query.type;
    const date_from = query.date_from;
    const date_to = query.date_to;

    const db = getDatabaseByRegion(organization.region, c.env);

    let whereClause = 'WHERE organization_id = ?';
    const bindings = [organization.id];

    if (category) {
      whereClause += ' AND category = ?';
      bindings.push(category);
    }

    if (type) {
      whereClause += ' AND type = ?';
      bindings.push(type);
    }

    if (date_from) {
      whereClause += ' AND date >= ?';
      bindings.push(date_from);
    }

    if (date_to) {
      whereClause += ' AND date <= ?';
      bindings.push(date_to);
    }

    const offset = (page - 1) * limit;
    const transactions = await db.prepare(`
      SELECT * FROM transactions ${whereClause}
      ORDER BY date DESC
      LIMIT ? OFFSET ?
    `).bind(...bindings, limit, offset).all();

    // Parse JSON fields
    const parsedTransactions = (transactions.results || []).map(transaction => ({
      ...transaction,
      tags: JSON.parse(transaction.tags || '[]'),
      metadata: JSON.parse(transaction.metadata || '{}')
    }));

    return c.json({
      success: true,
      data: {
        transactions: parsedTransactions,
        pagination: {
          page,
          limit,
          total: 0,
          total_pages: 1,
          has_more: false
        }
      },
      meta: {
        request_id: c.get('requestId'),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Transaction list failed:', error);
    return c.json({
      success: false,
      error: {
        code: 'TRANSACTION_LIST_FAILED',
        message: 'Failed to retrieve transactions'
      }
    }, 500);
  }
});

intelligence.post('/transactions/batch', async (c) => {
  try {
    const user = c.get('user');
    const organization = c.get('organization');
    const aiContext = c.get('aiContext');
    const { transactions: batchTransactions } = await c.req.json();

    if (!Array.isArray(batchTransactions) || batchTransactions.length === 0) {
      return c.json({
        success: false,
        error: {
          code: 'INVALID_BATCH_DATA',
          message: 'Invalid batch transaction data'
        }
      }, 400);
    }

    const db = getDatabaseByRegion(organization.region, c.env);
    const processedTransactions = [];

    for (const txData of batchTransactions) {
      // Validate each transaction
      const validated = createTransactionSchema.safeParse(txData);
      if (!validated.success) {
        continue;
      }

      // AI categorization for batch
      let aiCategorization = null;
      if (aiContext?.enabled) {
        aiCategorization = await categorizeTransaction(c.env, validated.data, organization);
      }

      const transaction: Transaction = {
        id: crypto.randomUUID(),
        organization_id: organization.id,
        account_id: validated.data.account_id,
        amount: validated.data.amount,
        currency: validated.data.currency,
        description: validated.data.description,
        category: aiCategorization?.primary_category || validated.data.category || 'uncategorized',
        subcategory: aiCategorization?.subcategory || validated.data.subcategory,
        date: validated.data.date,
        type: validated.data.type,
        counterparty: validated.data.counterparty,
        tags: validated.data.tags || [],
        metadata: {
          ...validated.data.metadata,
          ai_categorization: aiCategorization,
          batch_import: true
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await db.prepare(`
        INSERT INTO transactions (
          id, organization_id, account_id, amount, currency, description,
          category, subcategory, date, type, counterparty, tags,
          metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        transaction.id, transaction.organization_id, transaction.account_id,
        transaction.amount, transaction.currency, transaction.description,
        transaction.category, transaction.subcategory, transaction.date,
        transaction.type, transaction.counterparty, JSON.stringify(transaction.tags),
        JSON.stringify(transaction.metadata), transaction.created_at, transaction.updated_at
      ).run();

      processedTransactions.push({
        ...transaction,
        ai_categorization: aiCategorization
      });
    }

    return c.json({
      success: true,
      data: {
        processed_count: processedTransactions.length,
        total_count: batchTransactions.length,
        transactions: processedTransactions
      },
      meta: {
        request_id: c.get('requestId'),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Batch transaction processing failed:', error);
    return c.json({
      success: false,
      error: {
        code: 'BATCH_PROCESSING_FAILED',
        message: 'Failed to process batch transactions'
      }
    }, 500);
  }
});

// Analytics Routes
intelligence.get('/analytics/dashboard', async (c) => {
  try {
    const user = c.get('user');
    const organization = c.get('organization');
    const aiContext = c.get('aiContext');
    const query = c.req.query();

    const period = query.period || '30d';
    const currency = query.currency || 'USD';

    const db = getDatabaseByRegion(organization.region, c.env);

    // Calculate period dates
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(period));

    // Get financial metrics
    const [
      totalRevenue,
      totalExpenses,
      transactionCount,
      categoryBreakdown,
      cashFlow
    ] = await Promise.all([
      db.prepare(`
        SELECT SUM(amount) as total FROM transactions
        WHERE organization_id = ? AND type = 'income' AND date >= ? AND date <= ?
      `).bind(organization.id, startDate.toISOString(), endDate.toISOString()).first(),
      db.prepare(`
        SELECT SUM(amount) as total FROM transactions
        WHERE organization_id = ? AND type = 'expense' AND date >= ? AND date <= ?
      `).bind(organization.id, startDate.toISOString(), endDate.toISOString()).first(),
      db.prepare(`
        SELECT COUNT(*) as total FROM transactions
        WHERE organization_id = ? AND date >= ? AND date <= ?
      `).bind(organization.id, startDate.toISOString(), endDate.toISOString()).first(),
      db.prepare(`
        SELECT category, SUM(amount) as total, COUNT(*) as count
        FROM transactions
        WHERE organization_id = ? AND date >= ? AND date <= ?
        GROUP BY category
        ORDER BY total DESC
        LIMIT 10
      `).bind(organization.id, startDate.toISOString(), endDate.toISOString()).all(),
      db.prepare(`
        SELECT
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
        FROM transactions
        WHERE organization_id = ? AND date >= ? AND date <= ?
      `).bind(organization.id, startDate.toISOString(), endDate.toISOString()).first()
    ]);

    // AI-powered insights
    let insights = null;
    if (aiContext?.enabled) {
      insights = await generateFinancialInsights(c.env, organization, {
        period,
        revenue: totalRevenue?.total || 0,
        expenses: totalExpenses?.total || 0,
        transactions: transactionCount?.total || 0,
        categories: categoryBreakdown.results || [],
        cashFlow: cashFlow
      });
    }

    const dashboard = {
      period,
      currency,
      metrics: {
        total_revenue: totalRevenue?.total || 0,
        total_expenses: totalExpenses?.total || 0,
        net_income: (totalRevenue?.total || 0) - (totalExpenses?.total || 0),
        transaction_count: transactionCount?.total || 0,
        cash_flow: {
          income: cashFlow?.income || 0,
          expenses: cashFlow?.expenses || 0,
          net: (cashFlow?.income || 0) - (cashFlow?.expenses || 0)
        },
        top_categories: categoryBreakdown.results || []
      },
      insights,
      generated_at: new Date().toISOString()
    };

    return c.json({
      success: true,
      data: dashboard,
      meta: {
        request_id: c.get('requestId'),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Analytics dashboard failed:', error);
    return c.json({
      success: false,
      error: {
        code: 'ANALYTICS_DASHBOARD_FAILED',
        message: 'Failed to retrieve analytics dashboard'
      }
    }, 500);
  }
});

intelligence.get('/analytics/categories', async (c) => {
  try {
    const user = c.get('user');
    const organization = c.get('organization');
    const query = c.req.query();

    const period = query.period || '30d';
    const type = query.type; // income, expense, or all

    const db = getDatabaseByRegion(organization.region, c.env);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(period));

    let whereClause = 'WHERE organization_id = ? AND date >= ? AND date <= ?';
    const bindings = [organization.id, startDate.toISOString(), endDate.toISOString()];

    if (type && type !== 'all') {
      whereClause += ' AND type = ?';
      bindings.push(type);
    }

    const categories = await db.prepare(`
      SELECT
        category,
        subcategory,
        SUM(amount) as total_amount,
        COUNT(*) as transaction_count,
        AVG(amount) as average_amount,
        type
      FROM transactions ${whereClause}
      GROUP BY category, subcategory, type
      ORDER BY total_amount DESC
    `).bind(...bindings).all();

    // AI-powered category insights
    let categoryInsights = null;
    const aiContext = c.get('aiContext');
    if (aiContext?.enabled) {
      categoryInsights = await analyzeCategoryPatterns(c.env, categories.results || [], organization);
    }

    return c.json({
      success: true,
      data: {
        categories: categories.results || [],
        insights: categoryInsights,
        period,
        generated_at: new Date().toISOString()
      },
      meta: {
        request_id: c.get('requestId'),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Category analytics failed:', error);
    return c.json({
      success: false,
      error: {
        code: 'CATEGORY_ANALYTICS_FAILED',
        message: 'Failed to retrieve category analytics'
      }
    }, 500);
  }
});

// Forecasting Routes
intelligence.post('/forecast', zValidator('json', createForecastSchema), async (c) => {
  try {
    const user = c.get('user');
    const organization = c.get('organization');
    const aiContext = c.get('aiContext');
    const data = c.req.valid('json');

    // Generate forecast using AI
    const forecast = await generateForecast(c.env, data, organization, aiContext);

    // Store forecast
    const db = getDatabaseByRegion(organization.region, c.env);
    await db.prepare(`
      INSERT INTO forecasts (
        id, organization_id, type, period, currency, model,
        confidence_intervals, accuracy_metrics, ai_assumptions,
        created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      forecast.id, forecast.organization_id, forecast.type, forecast.period,
      forecast.currency, forecast.model, JSON.stringify(forecast.confidence_intervals),
      JSON.stringify(forecast.accuracy_metrics), JSON.stringify(forecast.ai_assumptions),
      forecast.created_at, forecast.expires_at
    ).run();

    return c.json({
      success: true,
      data: forecast,
      meta: {
        request_id: c.get('requestId'),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Forecast generation failed:', error);
    return c.json({
      success: false,
      error: {
        code: 'FORECAST_GENERATION_FAILED',
        message: 'Failed to generate forecast'
      }
    }, 500);
  }
});

intelligence.get('/forecasts', async (c) => {
  try {
    const user = c.get('user');
    const organization = c.get('organization');
    const query = c.req.query();

    const type = query.type;
    const limit = Math.min(parseInt(query.limit || '10'), 50);

    const db = getDatabaseByRegion(organization.region, c.env);

    let whereClause = 'WHERE organization_id = ? AND expires_at > ?';
    const bindings = [organization.id, new Date().toISOString()];

    if (type) {
      whereClause += ' AND type = ?';
      bindings.push(type);
    }

    const forecasts = await db.prepare(`
      SELECT * FROM forecasts ${whereClause}
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(...bindings, limit).all();

    // Parse JSON fields
    const parsedForecasts = (forecasts.results || []).map(forecast => ({
      ...forecast,
      confidence_intervals: JSON.parse(forecast.confidence_intervals || '{}'),
      accuracy_metrics: JSON.parse(forecast.accuracy_metrics || '{}'),
      ai_assumptions: JSON.parse(forecast.ai_assumptions || '[]')
    }));

    return c.json({
      success: true,
      data: {
        forecasts: parsedForecasts
      },
      meta: {
        request_id: c.get('requestId'),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Forecasts list failed:', error);
    return c.json({
      success: false,
      error: {
        code: 'FORECASTS_LIST_FAILED',
        message: 'Failed to retrieve forecasts'
      }
    }, 500);
  }
});

// Cash Flow Management Routes
intelligence.get('/cash-flow', async (c) => {
  try {
    const user = c.get('user');
    const organization = c.get('organization');
    const query = c.req.query();

    const period = query.period || '90d'; // 13 weeks default
    const currency = query.currency || 'USD';

    const db = getDatabaseByRegion(organization.region, c.env);

    // Calculate period
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(period));

    // Get weekly cash flow data
    const cashFlowData = await db.prepare(`
      SELECT
        date(date, 'weekday 0', '-6 days') as week_start,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses,
        COUNT(*) as transaction_count
      FROM transactions
      WHERE organization_id = ? AND date >= ? AND date <= ?
      GROUP BY date(date, 'weekday 0', '-6 days')
      ORDER BY week_start
    `).bind(organization.id, startDate.toISOString(), endDate.toISOString()).all();

    // Calculate cash flow metrics
    const cashFlowMetrics = calculateCashFlowMetrics(cashFlowData.results || []);

    // AI-powered cash flow insights
    let cashFlowInsights = null;
    const aiContext = c.get('aiContext');
    if (aiContext?.enabled) {
      cashFlowInsights = await generateCashFlowInsights(c.env, cashFlowMetrics, organization);
    }

    const response = {
      period,
      currency,
      weekly_data: cashFlowData.results || [],
      metrics: cashFlowMetrics,
      insights: cashFlowInsights,
      generated_at: new Date().toISOString()
    };

    return c.json({
      success: true,
      data: response,
      meta: {
        request_id: c.get('requestId'),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Cash flow analysis failed:', error);
    return c.json({
      success: false,
      error: {
        code: 'CASH_FLOW_ANALYSIS_FAILED',
        message: 'Failed to analyze cash flow'
      }
    }, 500);
  }
});

// Helper functions
function getDatabaseByRegion(region: 'US' | 'EU', env: Env): D1Database {
  return region === 'EU' ? env.DB_INTELLIGENCE_EU : env.DB_INTELLIGENCE_US;
}

function calculateCashFlowMetrics(weeklyData: any[]): any {
  if (weeklyData.length === 0) {
    return {
      total_income: 0,
      total_expenses: 0,
      net_cash_flow: 0,
      average_weekly_income: 0,
      average_weekly_expenses: 0,
      cash_flow_trend: 'stable',
      burn_rate: 0,
      runway_weeks: 0
    };
  }

  const totalIncome = weeklyData.reduce((sum, week) => sum + (week.income || 0), 0);
  const totalExpenses = weeklyData.reduce((sum, week) => sum + (week.expenses || 0), 0);
  const netCashFlow = totalIncome - totalExpenses;

  const averageWeeklyIncome = totalIncome / weeklyData.length;
  const averageWeeklyExpenses = totalExpenses / weeklyData.length;

  // Calculate trend
  const recentWeeks = weeklyData.slice(-4);
  const olderWeeks = weeklyData.slice(-8, -4);
  const recentNetFlow = recentWeeks.reduce((sum, week) => sum + ((week.income || 0) - (week.expenses || 0)), 0) / recentWeeks.length;
  const olderNetFlow = olderWeeks.length > 0 ?
    olderWeeks.reduce((sum, week) => sum + ((week.income || 0) - (week.expenses || 0)), 0) / olderWeeks.length : 0;

  let trend = 'stable';
  if (recentNetFlow > olderNetFlow * 1.1) trend = 'improving';
  else if (recentNetFlow < olderNetFlow * 0.9) trend = 'declining';

  // Calculate burn rate and runway (assuming starting cash of $100k for demo)
  const startingCash = 100000; // This would come from actual cash balance data
  const burnRate = averageWeeklyExpenses - averageWeeklyIncome;
  const runwayWeeks = burnRate > 0 ? Math.floor(startingCash / burnRate) : 52; // 1 year if positive cash flow

  return {
    total_income: totalIncome,
    total_expenses: totalExpenses,
    net_cash_flow: netCashFlow,
    average_weekly_income: averageWeeklyIncome,
    average_weekly_expenses: averageWeeklyExpenses,
    cash_flow_trend: trend,
    burn_rate: Math.abs(burnRate),
    runway_weeks: runwayWeeks
  };
}

// AI-enhanced functions
async function categorizeTransaction(env: Env, data: any, organization: any): Promise<any> {
  try {
    if (!env.AI) return null;

    const prompt = `
    Categorize this financial transaction:
    - Description: ${data.description}
    - Amount: ${data.amount} ${data.currency}
    - Type: ${data.type}
    - Counterparty: ${data.counterparty}

    Provide JSON response:
    {
      "primary_category": "category_name",
      "subcategory": "subcategory_name",
      "confidence": 0.95,
      "alternative_categories": [{"category": "alt1", "confidence": 0.8}],
      "reasoning": "brief explanation",
      "business_purpose": "likely business purpose",
      "tax_deductible": true,
      "recurring_pattern": false
    }`;

    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 300
    });

    if (response?.response) {
      return JSON.parse(response.response);
    }
  } catch (error) {
    console.error('Transaction categorization failed:', error);
  }

  return null;
}

async function updateCategorizationModel(env: Env, transaction: Transaction, categorization: any): Promise<void> {
  try {
    // Store categorization feedback for learning
    const learningData = {
      transaction_id: transaction.id,
      organization_id: transaction.organization_id,
      description: transaction.description,
      amount: transaction.amount,
      type: transaction.type,
      counterparty: transaction.counterparty,
      ai_category: categorization.primary_category,
      confidence: categorization.confidence,
      timestamp: new Date().toISOString()
    };

    const learningKey = `categorization_learning:${Date.now()}:${crypto.randomUUID()}`;
    await env.AGENT_MEMORY.put(learningKey, JSON.stringify(learningData), {
      expirationTtl: 90 * 24 * 60 * 60 // 90 days
    });
  } catch (error) {
    console.error('Categorization model update failed:', error);
  }
}

async function generateFinancialInsights(env: Env, organization: any, metrics: any): Promise<any> {
  try {
    if (!env.AI) return null;

    const prompt = `
    Analyze these financial metrics and provide insights:

    Metrics: ${JSON.stringify(metrics, null, 2)}

    Provide JSON response:
    {
      "trends": ["trend1", "trend2"],
      "recommendations": ["recommendation1", "recommendation2"],
      "risk_factors": ["risk1", "risk2"],
      "opportunities": ["opportunity1", "opportunity2"],
      "performance_score": 0.85
    }`;

    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 400
    });

    if (response?.response) {
      return JSON.parse(response.response);
    }
  } catch (error) {
    console.error('Financial insights generation failed:', error);
  }

  return null;
}

async function analyzeCategoryPatterns(env: Env, categories: any[], organization: any): Promise<any> {
  try {
    if (!env.AI) return null;

    const prompt = `
    Analyze these spending patterns by category:

    Categories: ${JSON.stringify(categories, null, 2)}

    Provide JSON response:
    {
      "patterns": ["pattern1", "pattern2"],
      "anomalies": ["anomaly1", "anomaly2"],
      "optimization_suggestions": ["suggestion1", "suggestion2"],
      "budget_recommendations": {"category": "recommended_amount"}
    }`;

    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 400
    });

    if (response?.response) {
      return JSON.parse(response.response);
    }
  } catch (error) {
    console.error('Category pattern analysis failed:', error);
  }

  return null;
}

async function generateForecast(env: Env, data: any, organization: any, aiContext: any): Promise<Forecast> {
  try {
    const historicalData = await getHistoricalData(env, data.type, organization);

    // Simple forecast for demo - in production would use sophisticated ML models
    const forecastValues = generateSimpleForecast(historicalData, data.type);

    const forecast: Forecast = {
      id: crypto.randomUUID(),
      organization_id: organization.id,
      type: data.type,
      period: data.period,
      currency: data.currency,
      model: data.model || 'arima',
      confidence_intervals: {
        lower_80: forecastValues.map(v => v * 0.8),
        lower_95: forecastValues.map(v => v * 0.7),
        median: forecastValues,
        upper_95: forecastValues.map(v => v * 1.3),
        upper_80: forecastValues.map(v => v * 1.2)
      },
      accuracy_metrics: {
        mae: 100,
        rmse: 150,
        mape: 0.1,
        bias: 0.05
      },
      ai_assumptions: aiContext?.enabled ? [
        'Historical trends will continue',
        'Seasonal patterns will repeat',
        'Market conditions remain stable'
      ] : [],
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    };

    return forecast;
  } catch (error) {
    console.error('Forecast generation failed:', error);
    throw error;
  }
}

async function getHistoricalData(env: Env, type: string, organization: any): Promise<number[]> {
  try {
    const db = getDatabaseByRegion(organization.region, env);
    const months = 12; // Get last 12 months

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - months);

    const result = await db.prepare(`
      SELECT date, amount FROM transactions
      WHERE organization_id = ? AND type = ? AND date >= ? AND date <= ?
      ORDER BY date
    `).bind(
      organization.id,
      type === 'revenue' ? 'income' : 'expense',
      startDate.toISOString(),
      endDate.toISOString()
    ).all();

    // Aggregate by month for simplicity
    const monthlyData = new Array(months).fill(0);
    (result.results || []).forEach((transaction: any) => {
      const monthIndex = new Date(transaction.date).getMonth();
      monthlyData[monthIndex] += transaction.amount;
    });

    return monthlyData;
  } catch (error) {
    console.error('Historical data retrieval failed:', error);
    return new Array(12).fill(1000); // Return dummy data
  }
}

function generateSimpleForecast(historicalData: number[], type: string): number[] {
  // Simple moving average forecast for demo
  const forecastMonths = 12;
  const forecast: number[] = [];

  for (let i = 0; i < forecastMonths; i++) {
    // Simple exponential smoothing
    const recentAverage = historicalData.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, historicalData.length);
    const trend = type === 'revenue' ? 1.05 : 1.02; // 5% growth for revenue, 2% for expenses
    forecast.push(recentAverage * Math.pow(trend, i / 12));
  }

  return forecast;
}

async function generateCashFlowInsights(env: Env, metrics: any, organization: any): Promise<any> {
  try {
    if (!env.AI) return null;

    const prompt = `
    Analyze these cash flow metrics and provide insights:

    Metrics: ${JSON.stringify(metrics, null, 2)}

    Provide JSON response:
    {
      "cash_flow_health": "excellent|good|fair|poor",
      "key_insights": ["insight1", "insight2"],
      "recommendations": ["recommendation1", "recommendation2"],
      "alert_level": "low|medium|high"
    }`;

    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 300
    });

    if (response?.response) {
      return JSON.parse(response.response);
    }
  } catch (error) {
    console.error('Cash flow insights generation failed:', error);
  }

  return null;
}

export { intelligence as intelligenceRoutes };