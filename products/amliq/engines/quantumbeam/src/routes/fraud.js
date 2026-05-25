/**
 * Fraud detection routes for Cloudflare Workers
 */

import { corsHeaders } from '../utils/cors.js';

export async function fraudRoutes(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/v1/fraud', '');

  switch (path) {
    case '/analyze':
      return handleAnalyzeTransaction(request, env);
    case '/batch':
      return handleBatchAnalyze(request, env);
    case '/history':
      return handleGetHistory(request, env);
    case '/patterns':
      return handleGetPatterns(request, env);
    default:
      return new Response(JSON.stringify({
        error: 'Not Found',
        message: 'Fraud endpoint not found'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders()
        }
      });
  }
}

async function handleAnalyzeTransaction(request, env) {
  if (request.method !== 'POST') {
    return jsonResponse({
      error: 'Method Not Allowed'
    }, 405);
  }

  try {
    let transaction;
    try {
      transaction = await parseJson(request);
    } catch (error) {
      return jsonResponse({
        error: 'Bad Request',
        message: 'Invalid JSON'
      }, 400);
    }

    const validationErrors = validateTransaction(transaction);
    if (validationErrors.length > 0) {
      return jsonResponse({
        error: 'Bad Request',
        message: 'Invalid transaction data',
        details: validationErrors
      }, 400);
    }

    // Route to ML service for analysis
    const [mlResult, quantumResult] = await Promise.all([
      callMLService(transaction, env),
      callQuantumService(transaction, env)
    ]);

    // Combine results
    const combinedResult = combineResults(mlResult, quantumResult);
    if (!combinedResult) {
      return jsonResponse({
        error: 'Bad Gateway',
        message: 'Fraud analysis unavailable',
        details: {
          ml: mlResult.error,
          quantum: quantumResult.error
        }
      }, 502);
    }

    return jsonResponse({
      success: true,
      data: {
        transactionId: transaction.id || crypto.randomUUID(),
        fraudScore: combinedResult.score,
        riskLevel: combinedResult.riskLevel,
        confidence: combinedResult.confidence,
        analysis: {
          ml: mlResult.data,
          quantum: quantumResult.data,
          combined: combinedResult
        },
        warnings: combinedResult.warnings,
        degraded: combinedResult.degraded,
        timestamp: new Date().toISOString(),
        sources: combinedResult.sources
      }
    }, 200);
  } catch (error) {
    return jsonResponse({
      error: 'Internal Server Error',
      message: 'Failed to analyze transaction'
    }, 500);
  }
}

async function handleBatchAnalyze(request, env) {
  if (request.method !== 'POST') {
    return jsonResponse({
      error: 'Method Not Allowed'
    }, 405);
  }

  try {
    let payload;
    try {
      payload = await parseJson(request);
    } catch (error) {
      return jsonResponse({
        error: 'Bad Request',
        message: 'Invalid JSON'
      }, 400);
    }

    const { transactions } = payload;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return jsonResponse({
        error: 'Bad Request',
        message: 'Invalid transactions array'
      }, 400);
    }

    const results = [];
    for (const transaction of transactions) {
      const validationErrors = validateTransaction(transaction);
      if (validationErrors.length > 0) {
        results.push({
          transactionId: transaction?.id,
          error: 'Invalid transaction data',
          details: validationErrors,
          fraudScore: null,
          riskLevel: 'unknown'
        });
        continue;
      }

      try {
        const [mlResult, quantumResult] = await Promise.all([
          callMLService(transaction, env),
          callQuantumService(transaction, env)
        ]);
        const combinedResult = combineResults(mlResult, quantumResult);
        if (!combinedResult) {
          results.push({
            transactionId: transaction.id,
            error: 'Fraud analysis unavailable',
            fraudScore: null,
            riskLevel: 'unknown'
          });
          continue;
        }

        results.push({
          transactionId: transaction.id,
          fraudScore: combinedResult.score,
          riskLevel: combinedResult.riskLevel,
          confidence: combinedResult.confidence,
          degraded: combinedResult.degraded
        });
      } catch (error) {
        results.push({
          transactionId: transaction.id,
          error: 'Analysis failed',
          fraudScore: null,
          riskLevel: 'unknown'
        });
      }
    }

    return jsonResponse({
      success: true,
      data: {
        results,
        processed: results.length,
        failed: transactions.length - results.filter(r => !r.error).length,
        timestamp: new Date().toISOString()
      }
    }, 200);
  } catch (error) {
    return jsonResponse({
      error: 'Internal Server Error',
      message: 'Failed to analyze batch'
    }, 500);
  }
}

async function handleGetHistory(request, env) {
  if (request.method !== 'GET') {
    return jsonResponse({
      error: 'Method Not Allowed'
    }, 405);
  }

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '10');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  if (!env?.DB) {
    return jsonResponse({
      error: 'Service Unavailable',
      message: 'Fraud history storage not configured'
    }, 503);
  }

  try {
    const results = await env.DB.prepare(
      `SELECT id, transaction_id, event_type, severity, description, confidence, created_at
       FROM fraud_events
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(limit, offset).all();

    return jsonResponse({
      success: true,
      data: {
        events: results?.results || [],
        pagination: {
          limit,
          offset,
          total: results?.results?.length || 0,
          hasMore: results?.results?.length === limit
        }
      }
    }, 200);
  } catch (error) {
    return jsonResponse({
      error: 'Internal Server Error',
      message: 'Failed to fetch history'
    }, 500);
  }
}

async function handleGetPatterns(request, env) {
  if (request.method !== 'GET') {
    return jsonResponse({
      error: 'Method Not Allowed'
    }, 405);
  }

  if (!env?.DB) {
    return jsonResponse({
      error: 'Service Unavailable',
      message: 'Fraud patterns storage not configured'
    }, 503);
  }

  return jsonResponse({
    error: 'Not Implemented',
    message: 'Fraud patterns endpoint requires rule storage integration'
  }, 501);
}

// Helper functions
async function callMLService(transaction, env) {
  return callService('ml', env?.ML_SERVICE, 'https://ml-service.quantumbeam.io/analyze', transaction, env);
}

async function callQuantumService(transaction, env) {
  return callService('quantum', env?.QUANTUM_SERVICE, 'https://quantum-service.quantumbeam.io/analyze', transaction, env);
}

function combineResults(mlResult, quantumResult) {
  const sources = [];
  const warnings = [];
  const mlData = mlResult?.data;
  const quantumData = quantumResult?.data;

  if (mlData) {
    sources.push('ml');
  } else if (mlResult?.error) {
    warnings.push(`ml:${mlResult.error}`);
  }

  if (quantumData) {
    sources.push('quantum');
  } else if (quantumResult?.error) {
    warnings.push(`quantum:${quantumResult.error}`);
  }

  if (sources.length === 0) {
    return null;
  }

  const mlScore = typeof mlData?.score === 'number' ? mlData.score : null;
  const quantumScore = typeof quantumData?.score === 'number' ? quantumData.score : null;
  const mlConfidence = typeof mlData?.confidence === 'number' ? mlData.confidence : null;
  const quantumConfidence = typeof quantumData?.confidence === 'number' ? quantumData.confidence : null;

  let combinedScore = 0;
  let combinedConfidence = 0;
  let weightSum = 0;

  if (mlScore !== null && mlConfidence !== null) {
    combinedScore += mlScore * mlConfidence;
    weightSum += mlConfidence;
    combinedConfidence += mlConfidence;
  }

  if (quantumScore !== null && quantumConfidence !== null) {
    combinedScore += quantumScore * quantumConfidence;
    weightSum += quantumConfidence;
    combinedConfidence += quantumConfidence;
  }

  if (weightSum === 0) {
    return null;
  }

  const normalizedScore = combinedScore / weightSum;

  let riskLevel;
  if (normalizedScore < 0.3) {
    riskLevel = 'low';
  } else if (normalizedScore < 0.7) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'high';
  }

  return {
    score: Math.round(normalizedScore * 100) / 100,
    riskLevel,
    confidence: Math.round((combinedConfidence / sources.length) * 100) / 100,
    degraded: sources.length === 1,
    warnings,
    sources
  };
}

async function callService(name, binding, url, payload, env) {
  if (!binding?.fetch) {
    return { data: null, error: `${name}_service_not_configured` };
  }

  const timeoutMs = parseInt(env?.SERVICE_TIMEOUT_MS || '3000', 10);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await binding.fetch(new Request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    }));

    if (!response.ok) {
      const body = await response.text();
      return { data: null, error: `${name}_service_error:${response.status}`, details: body };
    }

    const result = await response.json();
    return { data: result.data || result, error: null };
  } catch (error) {
    const errorCode = error.name === 'AbortError' ? `${name}_service_timeout` : `${name}_service_unavailable`;
    console.error(`${name} service call failed:`, error);
    return { data: null, error: errorCode };
  } finally {
    clearTimeout(timeout);
  }
}

async function parseJson(request) {
  try {
    return await request.json();
  } catch (error) {
    throw new Error('Invalid JSON');
  }
}

function validateTransaction(transaction) {
  const errors = [];

  if (!transaction || typeof transaction !== 'object') {
    return ['Transaction payload is required'];
  }

  if (typeof transaction.amount !== 'number' || transaction.amount <= 0) {
    errors.push('amount must be a positive number');
  }

  if (!transaction.merchant || typeof transaction.merchant !== 'string') {
    errors.push('merchant is required');
  }

  if (transaction.currency && typeof transaction.currency !== 'string') {
    errors.push('currency must be a string');
  }

  return errors;
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
}
