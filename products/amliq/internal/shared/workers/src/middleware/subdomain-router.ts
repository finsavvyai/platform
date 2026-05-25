/**
 * AI-Powered Subdomain Router
 * Revolutionary subdomain routing with intelligent context detection and AI enhancement
 */

import type { Context, Next } from 'hono';
import type { ProductContext, ProductType } from '../types';

export interface SubdomainRouterOptions {
  defaultProduct?: ProductType;
  aiEnhancement?: boolean;
  intelligentRouting?: boolean;
}

const SUBDOMAIN_PRODUCT_MAP: Record<string, ProductType> = {
  'billing': 'smart-billing',
  'compliance': 'enterprise-compliance',
  'intelligence': 'financial-intelligence',
  'risk': 'risk-investigator',
  'api': 'smart-billing', // API defaults to billing but provides access to all
  'www': 'smart-billing', // Default to billing
  'app': 'smart-billing',
  'dashboard': 'financial-intelligence',
  'admin': 'enterprise-compliance',
  'monitor': 'risk-investigator'
};

const PRODUCT_PERMISSIONS: Record<ProductType, string[]> = {
  'smart-billing': ['billing.read', 'billing.write', 'billing.delete'],
  'enterprise-compliance': ['compliance.read', 'compliance.write', 'compliance.delete'],
  'financial-intelligence': ['intelligence.read', 'intelligence.write'],
  'risk-investigator': ['risk.read', 'risk.write', 'risk.delete']
};

export function SubdomainRouter(options: SubdomainRouterOptions = {}) {
  const {
    defaultProduct = 'smart-billing',
    aiEnhancement = true,
    intelligentRouting = true
  } = options;

  return async (c: Context, next: Next) => {
    const startTime = Date.now();
    const url = new URL(c.req.url);
    const hostname = url.hostname;

    // Extract subdomain from hostname
    const subdomain = extractSubdomain(hostname);

    // Determine product type with AI enhancement
    let productType = SUBDOMAIN_PRODUCT_MAP[subdomain] || defaultProduct;
    let confidence = 1.0;

    if (aiEnhancement && intelligentRouting) {
      const aiAnalysis = await analyzeSubdomainIntent(c, subdomain, url.pathname);
      if (aiAnalysis.confidence > 0.8) {
        productType = aiAnalysis.suggestedProduct;
        confidence = aiAnalysis.confidence;
      }
    }

    // Detect region from URL or headers
    const region = detectRegion(c);

    // Create product context
    const productContext: ProductContext = {
      subdomain: subdomain as any,
      product: productType,
      region,
      features: await getProductFeatures(c, productType),
      permissions: PRODUCT_PERMISSIONS[productType]
    };

    // Set context for downstream middleware
    c.set('productContext', productContext);
    c.set('routingConfidence', confidence);
    c.set('routingTime', Date.now() - startTime);

    // Log routing decision for AI learning
    if (aiEnhancement) {
      await logRoutingDecision(c, {
        subdomain,
        product: productType,
        confidence,
        processing_time: Date.now() - startTime,
        pathname: url.pathname,
        user_agent: c.req.header('User-Agent'),
        timestamp: new Date().toISOString()
      });
    }

    await next();
  };
}

function extractSubdomain(hostname: string): string {
  // Handle different hostname formats
  const parts = hostname.split('.');

  // Remove TLD and domain
  if (parts.length >= 3) {
    return parts[0].toLowerCase();
  }

  // Handle localhost with ports
  if (hostname.includes('localhost')) {
    const portMatch = hostname.match(/:(\d+)/);
    if (portMatch) {
      const port = portMatch[1];
      // Map development ports to subdomains
      const portSubdomainMap: Record<string, string> = {
        '8787': 'billing',
        '8788': 'compliance',
        '8789': 'intelligence',
        '8790': 'risk',
        '8791': 'api'
      };
      return portSubdomainMap[port] || 'www';
    }
  }

  return 'www';
}

function detectRegion(c: Context): 'US' | 'EU' {
  // Detect region from various sources
  const cfCountry = c.req.header('CF-IPCountry');
  const regionHeader = c.req.header('X-Region');
  const url = new URL(c.req.url);

  // Priority order: header > Cloudflare > default
  if (regionHeader) {
    return regionHeader.toUpperCase() === 'EU' ? 'EU' : 'US';
  }

  // EU countries for GDPR compliance
  const euCountries = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
    'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
    'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
  ];

  if (cfCountry && euCountries.includes(cfCountry)) {
    return 'EU';
  }

  // Check URL path for region hints
  if (url.pathname.startsWith('/eu/') || url.searchParams.get('region') === 'eu') {
    return 'EU';
  }

  return 'US';
}

async function analyzeSubdomainIntent(c: Context, subdomain: string, pathname: string): Promise<{
  suggestedProduct: ProductType;
  confidence: number;
  reasoning: string;
}> {
  try {
    const env = c.env as any;

    // Use AI to analyze user intent based on path and context
    const prompt = `Analyze the user intent based on this request information:
    Subdomain: ${subdomain}
    Path: ${pathname}
    User Agent: ${c.req.header('User-Agent') || 'Unknown'}

    Available products:
    - Smart Billing: Invoice management, payment processing, billing automation
    - Enterprise Compliance: KYC, AML, sanctions screening, regulatory compliance
    - Financial Intelligence: Financial analysis, forecasting, expense tracking
    - Risk Investigator: Fraud detection, risk assessment, security analysis

    Respond with JSON format:
    {
      "suggestedProduct": "smart-billing" | "enterprise-compliance" | "financial-intelligence" | "risk-investigator",
      "confidence": 0.0-1.0,
      "reasoning": "Brief explanation of the decision"
    }`;

    const response = await env.AI.run(env.AI_MODEL, {
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 200
    });

    if (response?.response) {
      const analysis = JSON.parse(response.response);
      return {
        suggestedProduct: analysis.suggestedProduct,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning
      };
    }
  } catch (error) {
    console.error('AI intent analysis failed:', error);
  }

  // Fallback to basic pattern matching
  const pathPatterns = {
    'smart-billing': ['/invoice', '/payment', '/billing', '/customer'],
    'enterprise-compliance': ['/kyc', '/compliance', '/aml', '/sanction', '/verify'],
    'financial-intelligence': ['/analytics', '/forecast', '/transaction', '/expense', '/cash'],
    'risk-investigator': ['/risk', '/fraud', '/security', '/investigate', 'threat']
  };

  for (const [product, patterns] of Object.entries(pathPatterns)) {
    for (const pattern of patterns) {
      if (pathname.toLowerCase().includes(pattern)) {
        return {
          suggestedProduct: product as ProductType,
          confidence: 0.7,
          reasoning: `Path pattern "${pattern}" matched ${product}`
        };
      }
    }
  }

  return {
    suggestedProduct: 'smart-billing',
    confidence: 0.3,
    reasoning: 'No specific pattern detected, using default'
  };
}

async function getProductFeatures(c: Context, productType: ProductType): Promise<any[]> {
  try {
    const env = c.env as any;
    const cacheKey = `product_features:${productType}`;

    // Try to get from cache first
    const cached = await env.CACHE.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Define features for each product
    const productFeatures = {
      'smart-billing': [
        {
          name: 'ai_invoice_generation',
          enabled: true,
          configuration: { auto_categorization: true, smart_templates: true },
          permissions: ['billing.write']
        },
        {
          name: 'payment_orchestration',
          enabled: true,
          configuration: { providers: ['stripe', 'paypal', 'lemonqueezy'] },
          permissions: ['billing.write']
        },
        {
          name: 'reconciliation_ai',
          enabled: true,
          configuration: { fuzzy_matching: true, auto_reconciliation: true },
          permissions: ['billing.read']
        }
      ],
      'enterprise-compliance': [
        {
          name: 'ai_kyc_processing',
          enabled: true,
          configuration: { document_analysis: true, risk_assessment: true },
          permissions: ['compliance.write']
        },
        {
          name: 'sanctions_screening',
          enabled: true,
          configuration: { real_time: true, batch_processing: true },
          permissions: ['compliance.read']
        },
        {
          name: 'adverse_media_monitoring',
          enabled: true,
          configuration: { continuous_monitoring: true, ai_scoring: true },
          permissions: ['compliance.read']
        }
      ],
      'financial-intelligence': [
        {
          name: 'ai_categorization',
          enabled: true,
          configuration: { learning_enabled: true, confidence_threshold: 0.8 },
          permissions: ['intelligence.write']
        },
        {
          name: 'predictive_analytics',
          enabled: true,
          configuration: { forecasting_horizon: '90d', confidence_intervals: true },
          permissions: ['intelligence.read']
        },
        {
          name: 'anomaly_detection',
          enabled: true,
          configuration: { real_time_alerts: true, pattern_learning: true },
          permissions: ['intelligence.read']
        }
      ],
      'risk-investigator': [
        {
          name: 'real_time_scoring',
          enabled: true,
          configuration: { model_ensemble: true, explainable_ai: true },
          permissions: ['risk.write']
        },
        {
          name: 'behavioral_analysis',
          enabled: true,
          configuration: { baseline_learning: true, anomaly_detection: true },
          permissions: ['risk.read']
        },
        {
          name: 'network_analysis',
          enabled: true,
          configuration: { graph_analysis: true, pattern_detection: true },
          permissions: ['risk.read']
        }
      ]
    };

    const features = productFeatures[productType] || [];

    // Cache for 1 hour
    await env.CACHE.put(cacheKey, JSON.stringify(features), { expirationTtl: 3600 });

    return features;
  } catch (error) {
    console.error('Failed to get product features:', error);
    return [];
  }
}

async function logRoutingDecision(c: Context, decision: any): Promise<void> {
  try {
    const env = c.env as any;

    // Store routing decision for AI learning and analytics
    await env.AGENT_MEMORY.put(
      `routing_log:${Date.now()}:${crypto.randomUUID()}`,
      JSON.stringify(decision),
      { expirationTtl: 30 * 24 * 60 * 60 } // 30 days
    );

    // Update routing statistics
    const statsKey = `routing_stats:${decision.subdomain}:${decision.product}`;
    const currentStats = await env.AGENT_MEMORY.get(statsKey);

    let stats = currentStats ? JSON.parse(currentStats) : { count: 0, avg_confidence: 0 };
    stats.count++;
    stats.avg_confidence = (stats.avg_confidence * (stats.count - 1) + decision.confidence) / stats.count;
    stats.last_seen = decision.timestamp;

    await env.AGENT_MEMORY.put(statsKey, JSON.stringify(stats), { expirationTtl: 7 * 24 * 60 * 60 }); // 7 days
  } catch (error) {
    console.error('Failed to log routing decision:', error);
  }
}

// Advanced routing features
export class IntelligentRouter {
  private context: Context;
  private learningEnabled: boolean;

  constructor(context: Context, learningEnabled = true) {
    this.context = context;
    this.learningEnabled = learningEnabled;
  }

  async routeWithLearning(): Promise<ProductContext> {
    const startTime = Date.now();
    const productContext = this.context.get('productContext') as ProductContext;

    // Enhance with machine learning insights
    const insights = await this.getRoutingInsights(productContext);

    // Update context with insights
    productContext.features = this.enhanceFeatures(productContext.features, insights);

    // Log for continuous learning
    if (this.learningEnabled) {
      await this.logRoutingInsights(productContext, insights, Date.now() - startTime);
    }

    return productContext;
  }

  private async getRoutingInsights(context: ProductContext): Promise<any> {
    try {
      const env = this.context.env as any;

      // Analyze historical routing patterns
      const historicalData = await this.getHistoricalRoutingData(context.subdomain);

      // Get user preferences if available
      const userPreferences = await this.getUserPreferences();

      // Analyze current session context
      const sessionContext = await this.getSessionContext();

      return {
        historical_patterns: historicalData,
        user_preferences: userPreferences,
        session_context: sessionContext,
        confidence_boost: this.calculateConfidenceBoost(historicalData, userPreferences)
      };
    } catch (error) {
      console.error('Failed to get routing insights:', error);
      return null;
    }
  }

  private async getHistoricalRoutingData(subdomain: string): Promise<any> {
    try {
      const env = this.context.env as any;
      const patterns = await env.AGENT_MEMORY.get(`routing_patterns:${subdomain}`);
      return patterns ? JSON.parse(patterns) : null;
    } catch {
      return null;
    }
  }

  private async getUserPreferences(): Promise<any> {
    try {
      const user = this.context.get('user');
      if (!user) return null;

      const env = this.context.env as any;
      const preferences = await env.AGENT_MEMORY.get(`user_preferences:${user.id}`);
      return preferences ? JSON.parse(preferences) : null;
    } catch {
      return null;
    }
  }

  private async getSessionContext(): Promise<any> {
    try {
      const sessionId = this.context.get('sessionId');
      if (!sessionId) return null;

      const env = this.context.env as any;
      const context = await env.SESSIONS.get(`session:${sessionId}`);
      return context ? JSON.parse(context) : null;
    } catch {
      return null;
    }
  }

  private calculateConfidenceBoost(historical: any, preferences: any): number {
    let boost = 0;

    if (historical?.success_rate > 0.8) {
      boost += 0.1;
    }

    if (preferences?.preferred_product) {
      boost += 0.05;
    }

    return Math.min(boost, 0.2); // Cap at 0.2
  }

  private enhanceFeatures(features: any[], insights: any): any[] {
    if (!insights) return features;

    return features.map(feature => {
      const enhancedFeature = { ...feature };

      // Apply user preferences
      if (insights.user_preferences?.disabled_features?.includes(feature.name)) {
        enhancedFeature.enabled = false;
      }

      // Apply learning insights
      if (insights.historical_patterns?.feature_usage?.[feature.name] > 0.9) {
        enhancedFeature.priority = 'high';
      }

      return enhancedFeature;
    });
  }

  private async logRoutingInsights(context: ProductContext, insights: any, processingTime: number): Promise<void> {
    try {
      const env = this.context.env as any;

      const logEntry = {
        timestamp: new Date().toISOString(),
        subdomain: context.subdomain,
        product: context.product,
        insights,
        processing_time_ms: processingTime,
        user_agent: this.context.req.header('User-Agent'),
        request_id: this.context.get('requestId')
      };

      await env.AGENT_MEMORY.put(
        `routing_insights:${Date.now()}:${crypto.randomUUID()}`,
        JSON.stringify(logEntry),
        { expirationTtl: 7 * 24 * 60 * 60 } // 7 days
      );
    } catch (error) {
      console.error('Failed to log routing insights:', error);
    }
  }
}