/**
 * Risk Investigator Engine Routes
 * AI-powered fraud detection, risk analysis, and security monitoring
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env, RiskEvent, RiskAssessment, RiskPolicy } from '../types';

const risk = new Hono<{ Bindings: Env }>();

// Schemas
const createRiskEventSchema = z.object({
  event_type: z.enum(['transaction', 'user_behavior', 'pattern_anomaly', 'external_threat']),
  transaction_id: z.string().optional(),
  user_id: z.string().optional(),
  type: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  data: z.record(z.any())
});

const createRiskPolicySchema = z.object({
  name: z.string(),
  description: z.string(),
  version: z.string(),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['equals', 'not_equals', 'greater_than', 'less_than', 'contains']),
    value: z.any(),
    logical_operator: z.enum(['and', 'or'])
  })),
  actions: z.array(z.object({
    type: z.enum(['approve', 'decline', 'manual_review', 'enhanced_monitoring']),
    parameters: z.record(z.any()).optional()
  }))
});

// Risk Event Processing Routes
risk.post('/events', zValidator('json', createRiskEventSchema), async (c) => {
  try {
    const user = c.get('user');
    const organization = c.get('organization');
    const aiContext = c.get('aiContext');
    const data = c.req.valid('json');

    // AI-enhanced risk analysis
    let riskAnalysis = null;
    if (aiContext?.enabled) {
      riskAnalysis = await analyzeRiskEvent(c.env, data, organization);
    }

    const riskEvent: RiskEvent = {
      id: crypto.randomUUID(),
      organization_id: organization.id,
      transaction_id: data.transaction_id,
      user_id: data.user_id,
      type: data.event_type,
      severity: data.severity,
      risk_score: riskAnalysis?.risk_score || 0.5,
      features: riskAnalysis?.features || {},
      decision: riskAnalysis?.decision || {
        action: 'review',
        reason: 'Pending analysis',
        confidence: 0.5
      },
      created_at: new Date().toISOString()
    };

    const db = getDatabaseByRegion(organization.region, c.env);
    await db.prepare(`
      INSERT INTO risk_events (
        id, organization_id, transaction_id, user_id, type, severity,
        risk_score, features, decision, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      riskEvent.id, riskEvent.organization_id, riskEvent.transaction_id,
      riskEvent.user_id, riskEvent.type, riskEvent.severity,
      riskEvent.risk_score, JSON.stringify(riskEvent.features),
      JSON.stringify(riskEvent.decision), riskEvent.created_at
    ).run();

    // Trigger automated actions based on risk score
    if (riskEvent.risk_score > 0.8) {
      await triggerRiskResponse(c.env, riskEvent, organization);
    }

    return c.json({
      success: true,
      data: {
        risk_event: riskEvent,
        risk_analysis: riskAnalysis
      },
      meta: {
        request_id: c.get('requestId'),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Risk event creation failed:', error);
    return c.json({
      success: false,
      error: {
        code: 'RISK_EVENT_CREATION_FAILED',
        message: 'Failed to create risk event'
      }
    }, 500);
  }
});

risk.get('/events', async (c) => {
  try {
    const user = c.get('user');
    const organization = c.get('organization');
    const query = c.req.query();

    const page = parseInt(query.page || '1');
    const limit = Math.min(parseInt(query.limit || '20'), 100);
    const severity = query.severity;
    const type = query.type;

    const db = getDatabaseByRegion(organization.region, c.env);

    let whereClause = 'WHERE organization_id = ?';
    const bindings = [organization.id];

    if (severity) {
      whereClause += ' AND severity = ?';
      bindings.push(severity);
    }

    if (type) {
      whereClause += ' AND type = ?';
      bindings.push(type);
    }

    const offset = (page - 1) * limit;
    const events = await db.prepare(`
      SELECT * FROM risk_events ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...bindings, limit, offset).all();

    // Parse JSON fields
    const parsedEvents = (events.results || []).map(event => ({
      ...event,
      features: JSON.parse(event.features || '{}'),
      decision: JSON.parse(event.decision || '{}')
    }));

    return c.json({
      success: true,
      data: {
        events: parsedEvents,
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
    console.error('Risk events list failed:', error);
    return c.json({
      success: false,
      error: {
        code: 'RISK_EVENTS_LIST_FAILED',
        message: 'Failed to retrieve risk events'
      }
    }, 500);
  }
});

// Policy Management Routes
risk.post('/policies', zValidator('json', createRiskPolicySchema), async (c) => {
  try {
    const user = c.get('user');
    const organization = c.get('organization');
    const data = c.req.valid('json');

    const riskPolicy: RiskPolicy = {
      id: crypto.randomUUID(),
      organization_id: organization.id,
      name: data.name,
      description: data.description,
      version: data.version,
      status: 'active',
      conditions: data.conditions,
      actions: data.actions,
      model_config: {
        ensemble_models: ['fraud_detection_v1', 'behavior_analysis_v1'],
        weights: { fraud_detection_v1: 0.6, behavior_analysis_v1: 0.4 },
        thresholds: { high_risk: 0.8, medium_risk: 0.6 }
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: user.id
    };

    const db = getDatabaseByRegion(organization.region, c.env);
    await db.prepare(`
      INSERT INTO risk_policies (
        id, organization_id, name, description, version, status,
        conditions, actions, model_config, created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      riskPolicy.id, riskPolicy.organization_id, riskPolicy.name,
      riskPolicy.description, riskPolicy.version, riskPolicy.status,
      JSON.stringify(riskPolicy.conditions), JSON.stringify(riskPolicy.actions),
      JSON.stringify(riskPolicy.model_config), riskPolicy.created_at,
      riskPolicy.updated_at, riskPolicy.created_by
    ).run();

    return c.json({
      success: true,
      data: riskPolicy,
      meta: {
        request_id: c.get('requestId'),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Risk policy creation failed:', error);
    return c.json({
      success: false,
      error: {
        code: 'RISK_POLICY_CREATION_FAILED',
        message: 'Failed to create risk policy'
      }
    }, 500);
  }
});

risk.get('/policies', async (c) => {
  try {
    const user = c.get('user');
    const organization = c.get('organization');
    const query = c.req.query();

    const status = query.status || 'active';

    const db = getDatabaseByRegion(organization.region, c.env);
    const policies = await db.prepare(`
      SELECT * FROM risk_policies
      WHERE organization_id = ? AND status = ?
      ORDER BY created_at DESC
    `).bind(organization.id, status).all();

    // Parse JSON fields
    const parsedPolicies = (policies.results || []).map(policy => ({
      ...policy,
      conditions: JSON.parse(policy.conditions || '[]'),
      actions: JSON.parse(policy.actions || '[]'),
      model_config: JSON.parse(policy.model_config || '{}')
    }));

    return c.json({
      success: true,
      data: {
        policies: parsedPolicies
      },
      meta: {
        request_id: c.get('requestId'),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Risk policies list failed:', error);
    return c.json({
      success: false,
      error: {
        code: 'RISK_POLICIES_LIST_FAILED',
        message: 'Failed to retrieve risk policies'
      }
    }, 500);
  }
});

// Analytics Dashboard Routes
risk.get('/analytics/dashboard', async (c) => {
  try {
    const user = c.get('user');
    const organization = c.get('organization');
    const aiContext = c.get('aiContext');
    const query = c.req.query();

    const period = query.period || '7d';

    const db = getDatabaseByRegion(organization.region, c.env);

    // Calculate period dates
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(period));

    // Get risk metrics
    const [
      totalEvents,
      highRiskEvents,
      criticalEvents,
      blockedTransactions,
      riskByType
    ] = await Promise.all([
      db.prepare('SELECT COUNT(*) as total FROM risk_events WHERE organization_id = ? AND created_at >= ?').bind(organization.id, startDate.toISOString()).first(),
      db.prepare('SELECT COUNT(*) as total FROM risk_events WHERE organization_id = ? AND severity = "high" AND created_at >= ?').bind(organization.id, startDate.toISOString()).first(),
      db.prepare('SELECT COUNT(*) as total FROM risk_events WHERE organization_id = ? AND severity = "critical" AND created_at >= ?').bind(organization.id, startDate.toISOString()).first(),
      db.prepare('SELECT COUNT(*) as total FROM risk_events WHERE organization_id = ? AND JSON_EXTRACT(decision, "$.action") = "decline" AND created_at >= ?').bind(organization.id, startDate.toISOString()).first(),
      db.prepare('SELECT type, COUNT(*) as count, AVG(risk_score) as avg_score FROM risk_events WHERE organization_id = ? AND created_at >= ? GROUP BY type').bind(organization.id, startDate.toISOString()).all()
    ]);

    // AI-powered risk insights
    let insights = null;
    if (aiContext?.enabled) {
      insights = await generateRiskInsights(c.env, organization, {
        period,
        totalEvents: totalEvents?.total || 0,
        highRiskEvents: highRiskEvents?.total || 0,
        criticalEvents: criticalEvents?.total || 0,
        blockedTransactions: blockedTransactions?.total || 0,
        riskByType: riskByType.results || []
      });
    }

    const dashboard = {
      period,
      metrics: {
        total_events: totalEvents?.total || 0,
        high_risk_events: highRiskEvents?.total || 0,
        critical_events: criticalEvents?.total || 0,
        blocked_transactions: blockedTransactions?.total || 0,
        risk_by_type: riskByType.results || []
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
    console.error('Risk dashboard failed:', error);
    return c.json({
      success: false,
      error: {
        code: 'RISK_DASHBOARD_FAILED',
        message: 'Failed to retrieve risk dashboard'
      }
    }, 500);
  }
});

// Helper functions
function getDatabaseByRegion(region: 'US' | 'EU', env: Env): D1Database {
  return region === 'EU' ? env.DB_RISK_EU : env.DB_RISK_US;
}

// AI-enhanced functions
async function analyzeRiskEvent(env: Env, data: any, organization: any): Promise<any> {
  try {
    if (!env.AI) return null;

    const prompt = `
    Analyze this risk event for potential threats:

    Event Data: ${JSON.stringify(data, null, 2)}
    Organization: ${organization.id}

    Provide JSON response:
    {
      "risk_score": 0.75,
      "features": {
        "velocity_metrics": {"score": 0.6},
        "behavioral_patterns": {"score": 0.8},
        "network_analysis": {"score": 0.4}
      },
      "decision": {
        "action": "manual_review",
        "reason": "Suspicious pattern detected",
        "confidence": 0.85
      }
    }`;

    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 400
    });

    if (response?.response) {
      return JSON.parse(response.response);
    }
  } catch (error) {
    console.error('Risk event analysis failed:', error);
  }

  return null;
}

async function generateRiskInsights(env: Env, organization: any, metrics: any): Promise<any> {
  try {
    if (!env.AI) return null;

    const prompt = `
    Analyze these risk metrics and provide insights:

    Metrics: ${JSON.stringify(metrics, null, 2)}

    Provide JSON response:
    {
      "risk_trends": ["trend1", "trend2"],
      "threat_level": "low|medium|high|critical",
      "recommendations": ["recommendation1", "recommendation2"],
      "security_posture": "strong|moderate|weak"
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
    console.error('Risk insights generation failed:', error);
  }

  return null;
}

async function triggerRiskResponse(env: Env, riskEvent: RiskEvent, organization: any): Promise<void> {
  try {
    // Queue automated risk response
    if (env.RISK_ANALYSIS_QUEUE) {
      await env.RISK_ANALYSIS_QUEUE.send({
        type: 'risk_response',
        riskEventId: riskEvent.id,
        organizationId: organization.id,
        severity: riskEvent.severity,
        riskScore: riskEvent.risk_score
      });
    }
  } catch (error) {
    console.error('Risk response trigger failed:', error);
  }
}

export { risk as riskRoutes };