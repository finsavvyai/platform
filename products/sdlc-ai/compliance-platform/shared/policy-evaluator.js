/**
 * SDLC Policy Evaluator - OPA-based Policy Engine
 *
 * Evaluates AI requests against compliance policies in real-time
 * Supports dynamic policy updates and context-aware decision making
 */

export class PolicyEvaluator {
  constructor(env) {
    this.env = env;
    this.policyCache = new Map();
    this.complianceFrameworks = this.loadComplianceFrameworks();
  }

  /**
   * Evaluate a request against applicable compliance policies
   */
  async evaluate(requestData, context) {
    try {
      // Step 1: Identify applicable policies based on context
      const applicablePolicies = await this.getApplicablePolicies(context);

      // Step 2: Load policy rules from cache or KV
      const policyRules = await this.loadPolicyRules(applicablePolicies);

      // Step 3: Evaluate each policy
      const evaluationResults = [];
      let overallAllowed = true;
      let transformations = [];
      let appliedPolicies = [];

      for (const policy of policyRules) {
        const result = await this.evaluatePolicy(policy, requestData, context);
        evaluationResults.push(result);

        if (!result.allowed) {
          overallAllowed = false;
          return {
            allowed: false,
            reason: result.reason,
            policy: policy.name,
            version: policy.version,
            transformations: [],
            appliedPolicies: [policy.name]
          };
        }

        // Collect transformations from all allowed policies
        if (result.transformations) {
          transformations.push(...result.transformations);
        }
        appliedPolicies.push(policy.name);
      }

      // Step 4: Calculate compliance score
      const complianceScore = this.calculateComplianceScore(evaluationResults);

      // Step 5: Return consolidated evaluation result
      return {
        allowed: overallAllowed,
        reason: overallAllowed ? 'All policies satisfied' : 'Policy violation',
        version: this.getLatestPolicyVersion(applicablePolicies),
        transformations: transformations,
        appliedPolicies: appliedPolicies,
        complianceScore: complianceScore,
        evaluationTime: new Date().toISOString()
      };

    } catch (error) {
      console.error('Policy evaluation error:', error);
      return {
        allowed: false,
        reason: `Policy evaluation error: ${error.message}`,
        version: 'unknown',
        transformations: [],
        appliedPolicies: [],
        complianceScore: 0.0
      };
    }
  }

  /**
   * Determine which policies apply based on request context
   */
  async getApplicablePolicies(context) {
    const policies = [];

    // Base policies that always apply
    policies.push('base-security-policy', 'data-classification-policy');

    // Industry-specific policies
    if (context.organization) {
      const orgType = await this.getOrganizationType(context.organization);
      switch (orgType) {
        case 'financial':
          policies.push('finra-policy', 'pci-dss-policy', 'sox-policy');
          break;
        case 'healthcare':
          policies.push('hipaa-policy', 'hitech-policy');
          break;
        case 'legal':
          policies.push('aba-policy', 'privilege-policy');
          break;
        case 'government':
          policies.push('fisma-policy', 'fedramp-policy');
          break;
      }
    }

    // Data classification specific policies
    switch (context.dataClassification) {
      case 'pii':
        policies.push('pii-protection-policy');
        break;
      case 'phi':
        policies.push('phi-protection-policy', 'hipaa-policy');
        break;
      case 'financial':
        policies.push('financial-data-policy', 'pci-dss-policy');
        break;
      case 'confidential':
        policies.push('confidential-data-policy');
        break;
    }

    // Geographic policies
    if (context.clientIP) {
      const country = await this.getCountryFromIP(context.clientIP);
      if (country === 'EU') {
        policies.push('gdpr-policy');
      } else if (country === 'CA') {
        policies.push('pipeda-policy');
      }
    }

    return [...new Set(policies)]; // Remove duplicates
  }

  /**
   * Load policy rules from KV storage or cache
   */
  async loadPolicyRules(policyNames) {
    const rules = [];

    for (const policyName of policyNames) {
      // Check cache first
      if (this.policyCache.has(policyName)) {
        const cached = this.policyCache.get(policyName);
        if (Date.now() - cached.timestamp < 300000) { // 5 minute cache
          rules.push(cached.policy);
          continue;
        }
      }

      // Load from KV
      try {
        const policyData = await this.env.COMPLIANCE_CONFIG.get(policyName, 'json');
        if (policyData) {
          this.policyCache.set(policyName, {
            policy: policyData,
            timestamp: Date.now()
          });
          rules.push(policyData);
        }
      } catch (error) {
        console.error(`Failed to load policy ${policyName}:`, error);
        // Use default policy as fallback
        rules.push(this.getDefaultPolicy(policyName));
      }
    }

    return rules;
  }

  /**
   * Evaluate a single policy against the request
   */
  async evaluatePolicy(policy, requestData, context) {
    try {
      switch (policy.name) {
        case 'hipaa-policy':
          return this.evaluateHIPAAPolicy(policy, requestData, context);
        case 'gdpr-policy':
          return this.evaluateGDPRPolicy(policy, requestData, context);
        case 'finra-policy':
          return this.evaluateFINRAPolicy(policy, requestData, context);
        case 'pii-protection-policy':
          return this.evaluatePIIPolicy(policy, requestData, context);
        case 'data-classification-policy':
          return this.evaluateDataClassificationPolicy(policy, requestData, context);
        default:
          return this.evaluateGenericPolicy(policy, requestData, context);
      }
    } catch (error) {
      console.error(`Error evaluating policy ${policy.name}:`, error);
      return {
        allowed: false,
        reason: `Policy evaluation error: ${error.message}`,
        transformations: []
      };
    }
  }

  /**
   * HIPAA Compliance Evaluation
   */
  evaluateHIPAAPolicy(policy, requestData, context) {
    // Check for PHI data patterns
    const phiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{10}\b/, // Phone numbers
      /[A-Z]{2}\d{4}/, // Medical record numbers
      /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/ // DOB
    ];

    const requestText = JSON.stringify(requestData).toLowerCase();
    const hasPHI = phiPatterns.some(pattern => pattern.test(requestText));

    if (hasPHI) {
      // Check if user is authorized to handle PHI
      const authorizedRoles = ['doctor', 'nurse', 'admin', 'medical_staff'];
      const userRole = context.userId ? context.userId.toLowerCase() : '';

      if (!authorizedRoles.some(role => userRole.includes(role))) {
        return {
          allowed: false,
          reason: 'Unauthorized access to PHI data',
          transformations: []
        };
      }

      // Apply PHI redactions
      return {
        allowed: true,
        reason: 'PHI access authorized, applying redactions',
        transformations: [
          { type: 'redact', pattern: 'ssn', replacement: '[REDACTED]' },
          { type: 'redact', pattern: 'medical_id', replacement: '[REDACTED]' },
          { type: 'redact', pattern: 'phone', replacement: '[REDACTED]' },
          { type: 'audit', level: 'high', retention: '7_years' }
        ]
      };
    }

    return { allowed: true, reason: 'No PHI detected', transformations: [] };
  }

  /**
   * GDPR Compliance Evaluation
   */
  evaluateGDPRPolicy(policy, requestData, context) {
    // Check for EU personal data
    const euIndicatorPatterns = [
      /\b\d{2}[.-]?\d{2}[.-]?\d{4}\b/, // European date format
      /^[A-Z]{2}\d{6}[A-Z]?$/i, // European ID formats
      /IBAN|BIC|SWIFT/i // Banking identifiers
    ];

    const requestText = JSON.stringify(requestData);
    const hasEUPersonalData = euIndicatorPatterns.some(pattern =>
      pattern.test(requestText)
    );

    if (hasEUPersonalData) {
      return {
        allowed: true,
        reason: 'EU personal data detected, applying GDPR protections',
        transformations: [
          { type: 'redact', pattern: 'personal_id', replacement: '[REDACTED]' },
          { type: 'audit', level: 'high', retention: '7_years' },
          { type: 'consent_check', required: true },
          { type: 'data_minimization', enforce: true }
        ]
      };
    }

    return { allowed: true, reason: 'No EU personal data detected', transformations: [] };
  }

  /**
   * FINRA Compliance Evaluation
   */
  evaluateFINRAPolicy(policy, requestData, context) {
    const financialKeywords = [
      'stock', 'trade', 'portfolio', 'investment', 'broker', 'dealer',
      'securities', 'funds', 'mutual', 'etrade', 'charles schwab'
    ];

    const requestText = JSON.stringify(requestData).toLowerCase();
    const hasFinancialData = financialKeywords.some(keyword =>
      requestText.includes(keyword)
    );

    if (hasFinancialData) {
      return {
        allowed: true,
        reason: 'Financial data detected, applying FINRA compliance',
        transformations: [
          { type: 'audit', level: 'critical', retention: '10_years' },
          { type: 'supervision', required: true },
          { type: 'suitability_check', required: true },
          { type: 'record_keeping', finra_compliant: true }
        ]
      };
    }

    return { allowed: true, reason: 'No regulated financial data', transformations: [] };
  }

  /**
   * PII Protection Evaluation
   */
  evaluatePIIPolicy(policy, requestData, context) {
    const piiPatterns = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
      ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
      address: /\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|drive|dr)\b/gi
    };

    const requestText = JSON.stringify(requestData);
    const detectedPII = {};

    Object.entries(piiPatterns).forEach(([type, pattern]) => {
      const matches = requestText.match(pattern);
      if (matches && matches.length > 0) {
        detectedPII[type] = matches.length;
      }
    });

    if (Object.keys(detectedPII).length > 0) {
      return {
        allowed: true,
        reason: `PII detected: ${Object.keys(detectedPII).join(', ')}`,
        transformations: Object.keys(detectedPII).map(type => ({
          type: 'redact',
          pattern: type,
          replacement: '[REDACTED]'
        }))
      };
    }

    return { allowed: true, reason: 'No PII detected', transformations: [] };
  }

  /**
   * Data Classification Policy Evaluation
   */
  evaluateDataClassificationPolicy(policy, requestData, context) {
    const classification = context.dataClassification || 'public';

    switch (classification) {
      case 'public':
        return { allowed: true, reason: 'Public data access allowed', transformations: [] };

      case 'internal':
        return {
          allowed: true,
          reason: 'Internal data access allowed',
          transformations: [{ type: 'audit', level: 'medium', retention: '3_years' }]
        };

      case 'confidential':
        if (!context.userId || context.userId === 'anonymous') {
          return {
            allowed: false,
            reason: 'Authentication required for confidential data',
            transformations: []
          };
        }
        return {
          allowed: true,
          reason: 'Confidential data access authorized',
          transformations: [{ type: 'audit', level: 'high', retention: '7_years' }]
        };

      default:
        return {
          allowed: false,
          reason: `Unknown data classification: ${classification}`,
          transformations: []
        };
    }
  }

  /**
   * Generic Policy Evaluation
   */
  evaluateGenericPolicy(policy, requestData, context) {
    // Implement OPA-style evaluation for custom policies
    if (policy.rules && Array.isArray(policy.rules)) {
      for (const rule of policy.rules) {
        if (this.evaluateRule(rule, requestData, context)) {
          return {
            allowed: rule.effect === 'allow',
            reason: rule.reason || `Rule ${rule.name} triggered`,
            transformations: rule.transformations || []
          };
        }
      }
    }

    return { allowed: true, reason: 'No rules triggered', transformations: [] };
  }

  /**
   * Evaluate a single policy rule
   */
  evaluateRule(rule, requestData, context) {
    // Simple rule evaluation - can be extended with full OPA logic
    if (rule.condition) {
      switch (rule.condition.type) {
        case 'data_contains':
          const dataStr = JSON.stringify(requestData).toLowerCase();
          return dataStr.includes(rule.condition.value.toLowerCase());

        case 'user_has_role':
          return context.userId && context.userId.includes(rule.condition.role);

        case 'data_classification':
          return context.dataClassification === rule.condition.value;

        default:
          return false;
      }
    }
    return false;
  }

  /**
   * Calculate overall compliance score
   */
  calculateComplianceScore(evaluationResults) {
    if (evaluationResults.length === 0) return 1.0;

    // Weight scores based on policy criticality
    const weights = {
      'hipaa-policy': 0.3,
      'gdpr-policy': 0.25,
      'finra-policy': 0.25,
      'pii-protection-policy': 0.1,
      'data-classification-policy': 0.1
    };

    let totalScore = 0;
    let totalWeight = 0;

    evaluationResults.forEach(result => {
      const weight = weights[result.policy] || 0.05;
      totalScore += result.complianceScore || 1.0;
      totalWeight += weight;
    });

    return totalWeight > 0 ? (totalScore / evaluationResults.length) : 1.0;
  }

  /**
   * Get latest version for a set of policies
   */
  getLatestPolicyVersion(policies) {
    // In implementation, this would check policy versions
    return 'v1.0.0';
  }

  /**
   * Load compliance frameworks definitions
   */
  loadComplianceFrameworks() {
    return {
      HIPAA: {
        requirements: ['phi_protection', 'audit_trails', 'access_controls'],
        retention: '7_years'
      },
      GDPR: {
        requirements: ['consent', 'data_minimization', 'right_to_deletion'],
        retention: 'configurable'
      },
      FINRA: {
        requirements: ['supervision', 'record_keeping', 'suitability'],
        retention: '10_years'
      }
    };
  }

  /**
   * Helper methods
   */
  async getOrganizationType(organization) {
    // In implementation, this would query organization database
    return 'financial'; // Default for demo
  }

  async getCountryFromIP(ip) {
    // Use Cloudflare IP geolocation
    try {
      const response = await fetch(`http://ip-api.com/json/${ip}`);
      const data = await response.json();
      return data.countryCode;
    } catch {
      return 'US';
    }
  }

  getDefaultPolicy(policyName) {
    return {
      name: policyName,
      version: '1.0.0',
      description: `Default ${policyName} - please configure specific rules`,
      rules: [],
      default: true
    };
  }
}