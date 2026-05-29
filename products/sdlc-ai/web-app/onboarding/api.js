// SDLC Onboarding API Backend
// Cloudflare Worker for customer onboarding and account management

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Route handling
    try {
      if (path === '/api/onboarding/health' && method === 'GET') {
        return handleHealthCheck();
      } else if (path === '/api/onboarding/signup' && method === 'POST') {
        return handleSignup(request, env);
      } else if (path === '/api/onboarding/verify-email' && method === 'POST') {
        return handleEmailVerification(request, env);
      } else if (path === '/api/onboarding/api-keys' && method === 'POST') {
        return handleApiKeyGeneration(request, env);
      } else if (path === '/api/onboarding/test-compliance' && method === 'POST') {
        return handleComplianceTest(request, env);
      } else if (path === '/api/onboarding/complete' && method === 'POST') {
        return handleOnboardingComplete(request, env);
      } else if (path === '/api/onboarding/config' && method === 'GET') {
        return handleGetConfig(request, env);
      } else if (path === '/api/onboarding/config' && method === 'PUT') {
        return handleUpdateConfig(request, env);
      } else if (path === '/api/onboarding/providers' && method === 'GET') {
        return handleGetProviders(request, env);
      } else {
        return new Response(JSON.stringify({ error: 'Not Found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (error) {
      console.error('API Error:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
};

// Health check endpoint
async function handleHealthCheck() {
  return new Response(JSON.stringify({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// Handle customer signup
async function handleSignup(request, env) {
  try {
    const body = await request.json();
    const { email, company, companySize, industry, signupMethod } = body;

    // Validate input
    if (!email || !company || !companySize || !industry) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if email already exists
    const existingUser = await env.SDLC_USERS.get(`email:${email}`);
    if (existingUser) {
      return new Response(JSON.stringify({ error: 'Email already registered' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generate tenant ID and user ID
    const tenantId = `tenant_${generateId()}`;
    const userId = `user_${generateId()}`;
    const verificationToken = `verify_${generateId()}`;

    // Create user record
    const userData = {
      id: userId,
      email,
      company,
      companySize,
      industry,
      signupMethod: signupMethod || 'email',
      tenantId,
      status: 'pending_verification',
      createdAt: new Date().toISOString(),
      verificationToken,
      plan: 'enterprise_trial',
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      settings: {
        complianceFrameworks: getComplianceFrameworks(industry),
        dataResidency: 'global',
        notifications: true
      }
    };

    // Store user data
    await env.SDLC_USERS.put(`email:${email}`, JSON.stringify(userData));
    await env.SDLC_USERS.put(`user:${userId}`, JSON.stringify(userData));
    await env.SDLC_USERS.put(`tenant:${tenantId}`, JSON.stringify({
      id: tenantId,
      name: company,
      industry,
      createdAt: new Date().toISOString(),
      status: 'active'
    }));

    // Send verification email (simulated)
    await sendVerificationEmail(email, verificationToken, env);

    return new Response(JSON.stringify({
      success: true,
      message: 'Account created. Please verify your email.',
      userId,
      tenantId,
      requiresVerification: true
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    return new Response(JSON.stringify({ error: 'Signup failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Handle email verification
async function handleEmailVerification(request, env) {
  try {
    const body = await request.json();
    const { email, token } = body;

    // Get user data
    const userKey = `email:${email}`;
    const user = await env.SDLC_USERS.get(userKey);
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userData = JSON.parse(user);

    // Verify token
    if (userData.verificationToken !== token) {
      return new Response(JSON.stringify({ error: 'Invalid verification token' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update user status
    userData.status = 'active';
    userData.emailVerifiedAt = new Date().toISOString();
    delete userData.verificationToken;

    // Save updated user data
    await env.SDLC_USERS.put(userKey, JSON.stringify(userData));
    await env.SDLC_USERS.put(`user:${userData.id}`, JSON.stringify(userData));

    // Generate API keys
    const apiKeys = await generateApiKeys(userData.tenantId, env);

    return new Response(JSON.stringify({
      success: true,
      message: 'Email verified successfully',
      user: {
        id: userData.id,
        email: userData.email,
        company: userData.company,
        tenantId: userData.tenantId
      },
      apiKeys
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return new Response(JSON.stringify({ error: 'Email verification failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Handle API key generation
async function handleApiKeyGeneration(request, env) {
  try {
    const body = await request.json();
    const { userId, keyType } = body;

    // Get user data
    const user = await env.SDLC_USERS.get(`user:${userId}`);
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userData = JSON.parse(user);

    // Generate new API key
    const apiKey = generateApiKey(keyType || 'production');
    const keyData = {
      id: generateId(),
      type: keyType || 'production',
      key: apiKey,
      tenantId: userData.tenantId,
      userId: userData.id,
      createdAt: new Date().toISOString(),
      lastUsed: null,
      isActive: true
    };

    // Store API key
    await env.SDLC_API_KEYS.put(`key:${apiKey}`, JSON.stringify(keyData));

    return new Response(JSON.stringify({
      success: true,
      apiKey: {
        id: keyData.id,
        type: keyData.type,
        key: keyData.key,
        createdAt: keyData.createdAt
      }
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('API key generation error:', error);
    return new Response(JSON.stringify({ error: 'API key generation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Handle compliance test
async function handleComplianceTest(request, env) {
  try {
    const body = await request.json();
    const { apiKey, provider, message, classification } = body;

    // Verify API key
    const keyData = await env.SDLC_API_KEYS.get(`key:${apiKey}`);
    if (!keyData) {
      return new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const keyInfo = JSON.parse(keyData);

    // Get tenant configuration
    const tenant = await env.SDLC_USERS.get(`tenant:${keyInfo.tenantId}`);
    const tenantData = JSON.parse(tenant);

    // Simulate compliance checking
    const startTime = Date.now();
    const piiDetection = await detectPII(message);
    const complianceResult = await evaluateCompliance(message, classification, tenantData.industry);

    // Create audit log
    const auditId = `audit_${Date.now()}_${generateId()}`;
    const auditLog = {
      id: auditId,
      tenantId: keyInfo.tenantId,
      userId: keyInfo.userId,
      provider,
      classification,
      inputHash: await hashString(message),
      processingTime: Date.now() - startTime,
      piiDetected: piiDetection.detected,
      complianceScore: complianceResult.score,
      policiesApplied: complianceResult.policies,
      timestamp: new Date().toISOString(),
      type: 'compliance_test'
    };

    // Store audit log
    await env.SDLC_AUDIT_LOGS.put(auditId, JSON.stringify(auditLog));

    // Sanitize message for response
    const sanitizedMessage = await sanitizeMessage(message, piiDetection.matches);

    return new Response(JSON.stringify({
      success: true,
      result: {
        auditId,
        complianceScore: complianceResult.score,
        piiDetected: piiDetection.detected,
        piiCount: piiDetection.matches.length,
        sanitizedMessage,
        policiesApplied: complianceResult.policies,
        processingTime: auditLog.processingTime,
        auditTrail: {
          id: auditId,
          timestamp: auditLog.timestamp,
          hash: auditLog.inputHash,
          policyVersion: 'v2.1.3'
        }
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Compliance test error:', error);
    return new Response(JSON.stringify({ error: 'Compliance test failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Handle onboarding completion
async function handleOnboardingComplete(request, env) {
  try {
    const body = await request.json();
    const { userId, providers, config } = body;

    // Get user data
    const user = await env.SDLC_USERS.get(`user:${userId}`);
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userData = JSON.parse(user);

    // Update user configuration
    userData.onboardingCompleted = true;
    userData.onboardingCompletedAt = new Date().toISOString();
    userData.configuredProviders = providers || [];
    userData.configuration = config || {};

    // Save updated user data
    await env.SDLC_USERS.put(`user:${userId}`, JSON.stringify(userData));

    // Send welcome email
    await sendWelcomeEmail(userData.email, userData.company, env);

    // Create initial analytics record
    const analytics = {
      tenantId: userData.tenantId,
      userId: userData.id,
      firstActivity: new Date().toISOString(),
      providersConfigured: providers?.length || 0,
      industry: userData.industry,
      plan: userData.plan
    };

    await env.SDLC_ANALYTICS.put(`onboarding:${userData.tenantId}`, JSON.stringify(analytics));

    return new Response(JSON.stringify({
      success: true,
      message: 'Onboarding completed successfully',
      dashboardUrl: `https://dashboard.sdlc.finsavvyai.com/tenant/${userData.tenantId}`,
      user: {
        email: userData.email,
        company: userData.company,
        tenantId: userData.tenantId,
        plan: userData.plan
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Onboarding completion error:', error);
    return new Response(JSON.stringify({ error: 'Onboarding completion failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Handle get configuration
async function handleGetConfig(request, env) {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenantId');

  if (!tenantId) {
    return new Response(JSON.stringify({ error: 'Tenant ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const tenant = await env.SDLC_USERS.get(`tenant:${tenantId}`);
  if (!tenant) {
    return new Response(JSON.stringify({ error: 'Tenant not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    success: true,
    config: {
      supportedProviders: [
        { id: 'openai', name: 'OpenAI', models: ['gpt-4', 'gpt-3.5-turbo'] },
        { id: 'anthropic', name: 'Anthropic', models: ['claude-3-sonnet', 'claude-3-opus'] },
        { id: 'aws-bedrock', name: 'AWS Bedrock', models: ['anthropic.claude-v2', 'amazon.titan-tg1-large'] },
        { id: 'google', name: 'Google AI', models: ['gemini-pro', 'gemini-1.5-pro'] },
        { id: 'azure', name: 'Microsoft Azure', models: ['gpt-4', 'gpt-35-turbo'] }
      ],
      complianceFrameworks: ['HIPAA', 'GDPR', 'FINRA', 'SOC2', 'PCI-DSS'],
      dataResidencyOptions: ['global', 'us', 'eu', 'custom'],
      piiTypes: [
        { id: 'ssn', name: 'Social Security Number', pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b' },
        { id: 'email', name: 'Email Address', pattern: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b' },
        { id: 'phone', name: 'Phone Number', pattern: '\\b\\d{3}[-.]?\\d{3}[-.]?\\d{4}\\b' },
        { id: 'credit_card', name: 'Credit Card', pattern: '\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b' }
      ]
    }
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// Helper functions
function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function generateApiKey(type = 'production') {
  const prefix = type === 'production' ? 'sk-sdlc-prod_live_' : 'sk-sdlc-dev_test_';
  const key = Math.random().toString(36).substring(2, 50);
  return prefix + key;
}

function getComplianceFrameworks(industry) {
  const frameworks = {
    'healthcare': ['HIPAA', 'HITECH'],
    'finance': ['FINRA', 'PCI-DSS', 'SOX'],
    'legal': ['ABA', 'Privilege_Rules'],
    'enterprise': ['SOC2', 'ISO27001'],
    'global': ['GDPR', 'CCPA'],
    'other': ['SOC2']
  };
  return frameworks[industry] || ['SOC2'];
}

async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function detectPII(text) {
  const piiPatterns = [
    { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, type: 'ssn' },
    { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, type: 'email' },
    { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, type: 'phone' },
    { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, type: 'credit_card' }
  ];

  const matches = [];
  let detected = false;

  for (const { pattern, type } of piiPatterns) {
    const found = text.match(pattern);
    if (found) {
      detected = true;
      matches.push(...found.map(match => ({ type, match })));
    }
  }

  return { detected, matches };
}

async function evaluateCompliance(message, classification, industry) {
  // Simulate compliance evaluation
  const score = Math.random() * 10 + 90; // Random score between 90-100
  const policies = getComplianceFrameworks(industry);

  return {
    score: Math.round(score * 10) / 10,
    policies
  };
}

async function sanitizeMessage(message, piiMatches) {
  let sanitized = message;

  for (const { type, match } of piiMatches) {
    const replacement = `[REDACTED ${type.toUpperCase()}]`;
    sanitized = sanitized.replace(new RegExp(match.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), replacement);
  }

  return sanitized;
}

// Email service stubs (would integrate with real email service)
async function sendVerificationEmail(email, token, env) {
  console.log(`Sending verification email to ${email} with token ${token}`);
  // Would integrate with SendGrid, AWS SES, or similar
}

async function sendWelcomeEmail(email, company, env) {
  console.log(`Sending welcome email to ${email} for company ${company}`);
  // Would integrate with SendGrid, AWS SES, or similar
}

// Handle get providers
async function handleGetProviders(request, env) {
  return new Response(JSON.stringify({
    success: true,
    providers: [
      {
        id: 'openai',
        name: 'OpenAI',
        description: 'GPT-4, GPT-3.5, DALL-E',
        authType: 'api_key',
        models: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo', 'dall-e-3']
      },
      {
        id: 'anthropic',
        name: 'Anthropic',
        description: 'Claude 3 models',
        authType: 'api_key',
        models: ['claude-3-sonnet-20240229', 'claude-3-opus-20240229']
      },
      {
        id: 'aws-bedrock',
        name: 'AWS Bedrock',
        description: 'Multiple foundation models',
        authType: 'aws_credentials',
        models: ['anthropic.claude-v2', 'amazon.titan-tg1-large']
      },
      {
        id: 'google',
        name: 'Google AI',
        description: 'Gemini models, NotebookLM',
        authType: 'service_account',
        models: ['gemini-pro', 'gemini-1.5-pro']
      },
      {
        id: 'azure',
        name: 'Microsoft Azure',
        description: 'OpenAI models on Azure',
        authType: 'azure_credentials',
        models: ['gpt-4', 'gpt-35-turbo', 'gpt-4-turbo']
      }
    ]
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// Handle update configuration
async function handleUpdateConfig(request, env) {
  try {
    const body = await request.json();
    const { tenantId, config } = body;

    // Get tenant data
    const tenant = await env.SDLC_USERS.get(`tenant:${tenantId}`);
    if (!tenant) {
      return new Response(JSON.stringify({ error: 'Tenant not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const tenantData = JSON.parse(tenant);
    tenantData.configuration = { ...tenantData.configuration, ...config };
    tenantData.updatedAt = new Date().toISOString();

    // Save updated configuration
    await env.SDLC_USERS.put(`tenant:${tenantId}`, JSON.stringify(tenantData));

    return new Response(JSON.stringify({
      success: true,
      message: 'Configuration updated successfully'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Configuration update error:', error);
    return new Response(JSON.stringify({ error: 'Configuration update failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}