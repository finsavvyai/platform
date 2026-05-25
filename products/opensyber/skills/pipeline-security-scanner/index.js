/**
 * Pipeline Security Scanner Skill for OpenSyber
 * Integrates with PipeWarden to perform AI-powered CI/CD pipeline security analysis.
 * Supports GitHub Actions, GitLab CI/CD, and Bitbucket Pipelines.
 */

const API_URL = process.env.PIPEWARDEN_API_URL || 'http://localhost:8080';
const API_KEY = process.env.PIPEWARDEN_API_KEY;

/**
 * Map OpenSyber severity to PipeWarden severity
 */
const severityMap = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
  info: 'info',
};

/**
 * Execute pipeline security scan
 * @param {Object} ctx - OpenSyber execution context
 * @param {Object} config - Skill configuration
 * @param {string} config.connection_name - Name of the CI/CD connection (e.g., "github-prod")
 * @param {string} config.owner - Repository owner/organization
 * @param {string} config.repo - Repository name
 * @param {string} config.scan_type - Scan type: 'quick', 'full', or 'deep' (default: 'quick')
 * @returns {Promise<Object>} Security findings and risk assessment
 */
async function execute(ctx) {
  const config = ctx.config || {};

  if (!config.connection_name) {
    throw new Error('connection_name is required');
  }
  if (!config.owner) {
    throw new Error('owner is required');
  }
  if (!config.repo) {
    throw new Error('repo is required');
  }

  const scanType = config.scan_type || 'quick';
  const endpoint = scanType === 'quick' ? '/api/v1/analysis/quick' : '/api/v1/analysis/run';

  try {
    // Call PipeWarden API for analysis
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY && { 'Authorization': `Bearer ${API_KEY}` }),
      },
      body: JSON.stringify({
        connection_name: config.connection_name,
        owner: config.owner,
        repo: config.repo,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `PipeWarden API error: ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json();

    // Transform PipeWarden findings to OpenSyber format
    const findings = result.findings?.map((finding) => ({
      id: finding.id,
      severity: severityMap[finding.severity] || 'info',
      category: finding.category,
      title: finding.title,
      description: finding.description,
      remediation: finding.remediation,
      file: finding.file,
      line: finding.line,
      confidence: finding.confidence,
      status: finding.status || 'open',
      source: 'pipewarden',
    })) || [];

    return {
      success: true,
      scan_type: scanType,
      connection: config.connection_name,
      repository: `${config.owner}/${config.repo}`,
      findings,
      summary: result.summary || 'Scan completed',
      risk_score: result.risk_score || 0,
      findings_count: findings.length,
      critical_count: findings.filter((f) => f.severity === 'critical').length,
      high_count: findings.filter((f) => f.severity === 'high').length,
      duration_ms: result.duration_ms || 0,
      analyzed_at: result.analyzed_at || new Date().toISOString(),
    };
  } catch (error) {
    console.error('[pipeline-security-scanner]', error);
    throw new Error(`Security scan failed: ${error.message}`);
  }
}

// Export for OpenSyber agent runtime
module.exports = { execute };
