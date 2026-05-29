/**
 * SDLC Compliance Intelligence Platform - AI Gateway
 *
 * Core Responsibilities:
 * 1. Intercept all AI provider requests
 * 2. Validate compliance policies before forwarding
 * 3. Log all transactions with cryptographic audit trail
 * 4. Enforce rate limiting and cost controls
 * 5. Provide real-time compliance scoring
 */

import { ComplianceEngine } from '../shared/compliance-engine.js';
import { AuditLogger } from '../shared/audit-logger.js';
import { PolicyEvaluator } from '../shared/policy-evaluator.js';
import { MetricsCollector } from '../shared/metrics-collector.js';

export default {
  async fetch(request, env, ctx) {
    const startTime = Date.now();
    const url = new URL(request.url);

    try {
      // Initialize compliance components
      const compliance = new ComplianceEngine(env);
      const auditLogger = new AuditLogger(env);
      const policyEval = new PolicyEvaluator(env);
      const metrics = new MetricsCollector(env);

      // Extract request metadata
      const requestId = crypto.randomUUID();
      const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
      const userAgent = request.headers.get('User-Agent') || 'unknown';

      // Parse request for compliance validation
      const requestBody = await request.clone().json().catch(() => ({}));
      const provider = this.detectAIProvider(url.pathname);

      // Build compliance context
      const complianceContext = {
        requestId,
        timestamp: new Date().toISOString(),
        provider,
        endpoint: url.pathname,
        method: request.method,
        clientIP,
        userAgent,
        userId: request.headers.get('X-User-ID') || 'anonymous',
        organization: request.headers.get('X-Organization') || 'unknown',
        dataClassification: request.headers.get('X-Data-Classification') || 'public',
        complianceScore: 0.0,
        policyVersion: 'v1.0.0'
      };

      // Step 1: Compliance Policy Evaluation
      console.log(`[${requestId}] Evaluating compliance for ${provider} request`);

      const policyResult = await policyEval.evaluate(requestBody, complianceContext);
      if (!policyResult.allowed) {
        // Policy violation - block request
        const violation = {
          requestId,
          violation: policyResult.reason,
          policy: policyResult.policy,
          timestamp: complianceContext.timestamp,
          blocked: true
        };

        await auditLogger.logViolation(violation, env);
        await metrics.record('policy_blockage', { provider, reason: policyResult.reason });

        return new Response(JSON.stringify({
          error: 'Policy violation',
          requestId,
          reason: policyResult.reason,
          complianceScore: 0.0
        }), {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'X-Compliance-Score': '0.0',
            'X-Policy-Result': 'blocked',
            'X-Request-ID': requestId
          }
        });
      }

      // Step 2: Apply Compliance Transformations
      const transformedRequest = await compliance.applyComplianceTransformations(
        requestBody,
        policyResult.transformations
      );

      // Step 3: Forward to AI Provider
      console.log(`[${requestId}] Forwarding to ${provider}`);

      const aiResponse = await this.forwardToProvider(
        provider,
        transformedRequest,
        request.headers,
        env
      );

      if (!aiResponse.ok) {
        throw new Error(`AI Provider Error: ${aiResponse.status} ${aiResponse.statusText}`);
      }

      const aiResponseData = await aiResponse.json();

      // Step 4: Post-Response Compliance Processing
      const postComplianceResult = await compliance.processResponse(
        aiResponseData,
        complianceContext
      );

      // Step 5: Create Cryptographic Audit Record
      const auditRecord = {
        ...complianceContext,
        policyVersion: policyResult.version,
        complianceScore: postComplianceResult.score,
        transformations: policyResult.transformations,
        inputHash: this.hashData(requestBody),
        outputHash: this.hashData(aiResponseData),
        merkleIndex: await auditLogger.getNextIndex(),
        processingTime: Date.now() - startTime,
        success: true
      };

      // Step 6: Store Audit Record
      await auditLogger.logTransaction(auditRecord, env);

      // Step 7: Update Metrics
      await metrics.record('successful_request', {
        provider,
        complianceScore: postComplianceResult.score,
        processingTime: auditRecord.processingTime,
        dataClassification: complianceContext.dataClassification
      });

      // Step 8: Return Compliant Response
      const finalResponse = {
        ...postComplianceResult.response,
        compliance: {
          score: postComplianceResult.score,
          requestId,
          policiesApplied: policyResult.appliedPolicies,
          dataRedactions: postComplianceResult.redactions,
          auditId: auditRecord.merkleIndex,
          complianceLevel: postComplianceResult.level
        }
      };

      console.log(`[${requestId}] Request completed successfully. Score: ${postComplianceResult.score}`);

      return new Response(JSON.stringify(finalResponse), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Compliance-Score': postComplianceResult.score.toString(),
          'X-Policy-Result': 'allowed',
          'X-Request-ID': requestId,
          'X-Audit-Index': auditRecord.merkleIndex.toString()
        }
      });

    } catch (error) {
      console.error('Gateway error:', error);

      // Log error for compliance tracking
      await metrics.record('gateway_error', {
        error: error.message,
        endpoint: url.pathname,
        method: request.method
      });

      return new Response(JSON.stringify({
        error: 'Internal compliance gateway error',
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Policy-Result': 'error'
        }
      });
    }
  },

  /**
   * Detect which AI provider is being requested based on URL path
   */
  detectAIProvider(pathname) {
    if (pathname.includes('/openai') || pathname.includes('/chat/completions')) {
      return 'openai';
    } else if (pathname.includes('/anthropic') || pathname.includes('/messages')) {
      return 'anthropic';
    } else if (pathname.includes('/bedrock') || pathname.includes('/invoke')) {
      return 'bedrock';
    } else if (pathname.includes('/gemini') || pathname.includes('/generate')) {
      return 'gemini';
    }
    return 'unknown';
  },

  /**
   * Forward request to appropriate AI provider
   */
  async forwardToProvider(provider, requestBody, headers, env) {
    const providerURLs = {
      openai: env.OPENAI_API_URL || 'https://api.openai.com',
      anthropic: env.ANTHROPIC_API_URL || 'https://api.anthropic.com',
      bedrock: env.BEDROCK_API_URL || 'https://bedrock-runtime.us-east-1.amazonaws.com',
      gemini: 'https://generativelanguage.googleapis.com'
    };

    const baseURL = providerURLs[provider];
    if (!baseURL) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    // Get API key from secure environment
    const apiKey = await this.getProviderAPIKey(provider, env);
    if (!apiKey) {
      throw new Error(`No API key configured for provider: ${provider}`);
    }

    // Build provider-specific headers
    const providerHeaders = new Headers();
    providerHeaders.set('Content-Type', 'application/json');

    if (provider === 'openai') {
      providerHeaders.set('Authorization', `Bearer ${apiKey}`);
    } else if (provider === 'anthropic') {
      providerHeaders.set('x-api-key', apiKey);
      providerHeaders.set('anthropic-version', '2023-06-01');
    } else if (provider === 'bedrock') {
      providerHeaders.set('X-Amz-Target', 'BedrockRuntime.InvokeModel');
    } else if (provider === 'gemini') {
      providerHeaders.set('x-goog-api-key', apiKey);
    }

    // Copy important original headers
    if (headers.get('Accept')) providerHeaders.set('Accept', headers.get('Accept'));
    if (headers.get('Accept-Encoding')) providerHeaders.set('Accept-Encoding', headers.get('Accept-Encoding'));

    // Forward request to AI provider
    return fetch(baseURL + new URL(request.url).pathname, {
      method: 'POST',
      headers: providerHeaders,
      body: JSON.stringify(requestBody)
    });
  },

  /**
   * Get API key for AI provider from secure storage
   */
  async getProviderAPIKey(provider, env) {
    // In production, these would be stored in Cloudflare secrets
    const secretKeys = {
      openai: env.OPENAI_API_KEY,
      anthropic: env.ANTHROPIC_API_KEY,
      bedrock: env.AWS_ACCESS_KEY, // Plus proper AWS SigV4 signing
      gemini: env.GEMINI_API_KEY
    };

    return secretKeys[provider];
  },

  /**
   * Create SHA-256 hash for audit trail
   */
  hashData(data) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(data));
    return crypto.subtle.digest('SHA-256', dataBuffer)
      .then(hashBuffer => {
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      });
  }
};