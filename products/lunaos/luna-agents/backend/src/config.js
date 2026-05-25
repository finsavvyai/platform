// Configuration for Luna RAG Cloudflare Workers
export const config = {
  // Environment
  environment: globalThis.ENVIRONMENT || 'development',

  // License Configuration
  license: {
    validationEndpoint: globalThis.LICENSE_VALIDATION_ENDPOINT || 'https://api.lunaos.ai/validate',
    maxOfflineGracePeriod: 30, // days
    encryptionKey: globalThis.LICENSE_ENCRYPTION_KEY || 'default-key-change-me'
  },

  // LemonSqueezy Configuration
  lemonsqueezy: {
    storeId: globalThis.LEMONSQUEEZY_STORE_ID,
    apiUrl: 'https://api.lemonsqueezy.com/v1',
    webhookSecret: globalThis.LEMONSQUEEZY_WEBHOOK_SECRET,
    products: {
      pro: {
        variantId: 'pro-monthly-variant', // Set this in LemonSqueezy
        productId: 'pro-product',
        price: 29.00
      },
      enterprise: {
        variantId: 'enterprise-monthly-variant',
        productId: 'enterprise-product',
        price: 49.00
      }
    }
  },

  // Subscription Tiers
  tiers: {
    free: {
      searchesPerDay: 100,
      maxFiles: 1000,
      visionAnalyses: 0,
      glmAnalyses: 0,
      features: ['basic_search', 'community_support', 'local_indexing']
    },
    pro: {
      searchesPerDay: -1, // Unlimited
      maxFiles: -1, // Unlimited
      visionAnalyses: -1, // Unlimited
      glmAnalyses: -1, // Unlimited
      features: ['unlimited_search', 'vision_rag', 'glm_vision', 'priority_support', 'advanced_analytics', 'api_access']
    },
    enterprise: {
      searchesPerDay: -1,
      maxFiles: -1,
      visionAnalyses: -1,
      glmAnalyses: -1,
      features: ['team_collaboration', 'sso_integration', 'dedicated_support', 'custom_training', 'on_premise', 'white_label']
    }
  },

  // JWT Configuration
  jwt: {
    secret: globalThis.JWT_SECRET,
    expiresIn: globalThis.JWT_EXPIRES_IN || '7d',
    issuer: 'luna-rag',
    audience: 'luna-rag-users'
  },

  // Email Configuration
  email: {
    provider: 'sendgrid', // Can be 'sendgrid', 'resend', or 'smtp'
    from: globalThis.EMAIL_FROM || 'noreply@lunaos.ai',
    support: globalThis.EMAIL_SUPPORT || 'support@lunaos.ai',
    templates: {
      welcome: 'welcome-email',
      trialExpiry: 'trial-expiry',
      paymentSuccess: 'payment-success',
      cancellation: 'subscription-cancelled',
      usageReport: 'usage-report'
    }
  },

  // API Configuration
  api: {
    version: globalThis.API_VERSION || 'v1',
    rateLimiting: {
      free: {
        requests: 1000,
        window: '1h'
      },
      pro: {
        requests: 10000,
        window: '1h'
      }
    },
    cors: {
      origins: ['*'], // Restrict in production
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'X-API-Key'],
      maxAge: 86400
    }
  },

  // Cache Configuration
  cache: {
    ttl: {
      user: 300, // 5 minutes
      usage: 60, // 1 minute
      search: 1800 // 30 minutes
    }
  },

  // Feature Flags
  features: {
    visionRag: true,
    glmVision: true,
    analytics: true,
    teamManagement: false, // Coming soon
    ssoIntegration: false, // Coming soon
    customTraining: false // Coming soon
  },

  // Analytics
  analytics: {
    trackEvents: true,
    retentionDays: 90,
    anonymizeData: false // Set to true for GDPR compliance
  }
};

export default config;