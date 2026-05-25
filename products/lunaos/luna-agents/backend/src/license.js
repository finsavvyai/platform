import config from './config.js';

export class LicenseService {
  constructor(env) {
    this.env = env;
    this.db = env.DB;
    this.cache = env.CACHE;
  }

  /**
   * Validate license key and return license info
   */
  async validateLicense(licenseKey, userId, domain = null) {
    try {
      // Check cache first
      const cacheKey = `license:${licenseKey}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        const licenseData = JSON.parse(cached);
        if (this.isLicenseValid(licenseData)) {
          return licenseData;
        }
      }

      // Validate license against your server
      const licenseData = await this.validateAgainstServer(licenseKey, userId, domain);

      if (licenseData.valid) {
        // Cache for 24 hours
        await this.cache.put(cacheKey, JSON.stringify(licenseData), {
          expirationTtl: 86400
        });

        // Store validation in database
        await this.logLicenseValidation(licenseKey, userId, domain, true);
      } else {
        await this.logLicenseValidation(licenseKey, userId, domain, false);
      }

      return licenseData;
    } catch (error) {
      console.error('License validation error:', error);
      return {
        valid: false,
        error: 'License validation failed',
        requiresActivation: true
      };
    }
  }

  /**
   * Validate license against your server
   */
  async validateAgainstServer(licenseKey, userId, domain) {
    // For demo purposes, return mock validation
    // In production, this would call your validation API
    const mockLicenseData = this.mockValidateLicense(licenseKey, userId, domain);

    if (mockLicenseData.requiresActivation) {
      // Send activation request to your server
      await this.sendActivationRequest(licenseKey, userId, domain);
    }

    return mockLicenseData;
  }

  /**
   * Mock license validation (replace with real server validation)
   */
  mockValidateLicense(licenseKey, userId, domain) {
    // Demo license keys that would work
    const validLicenses = [
      'LUNA-TRIAL-123456',
      'LUNA-PRO-789012',
      'LUNA-ENTERPRISE-345678'
    ];

    if (validLicenses.includes(licenseKey)) {
      return {
        valid: true,
        licenseKey,
        tier: this.getLicenseTier(licenseKey),
        expiresAt: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)), // 30 days
        domain,
        userId,
        features: this.getFeaturesForTier(this.getLicenseTier(licenseKey)),
        maxUsers: this.getMaxUsersForTier(this.getLicenseTier(licenseKey))
      };
    }

    return {
      valid: false,
      error: 'Invalid license key',
      requiresActivation: true
    };
  }

  /**
   * Check if license is still valid
   */
  isLicenseValid(licenseData) {
    if (!licenseData.valid) return false;

    const now = new Date();
    const expiresAt = new Date(licenseData.expiresAt);

    // Check expiration
    if (now > expiresAt) return false;

    // Check grace period
    const gracePeriodEnd = new Date(expiresAt.getTime() + (config.license.maxOfflineGracePeriod * 24 * 60 * 60 * 1000));
    if (now > gracePeriodEnd) return false;

    return true;
  }

  /**
   * Get license tier from license key
   */
  getLicenseTier(licenseKey) {
    if (licenseKey.includes('ENTERPRISE')) return 'enterprise';
    if (licenseKey.includes('PRO')) return 'pro';
    if (licenseKey.includes('TRIAL')) return 'trial';
    return 'invalid';
  }

  /**
   * Get features for tier
   */
  getFeaturesForTier(tier) {
    const features = {
      trial: ['search', 'basic_patterns', 'community_support'],
      pro: ['search', 'patterns', 'vision_rag', 'glm_vision', 'priority_support', 'advanced_analytics'],
      enterprise: ['search', 'patterns', 'vision_rag', 'glm_vision', 'team_collaboration', 'sso', 'dedicated_support', 'custom_training']
    };
    return features[tier] || [];
  }

  /**
   * Get max users for tier
   */
  getMaxUsersForTier(tier) {
    const limits = {
      trial: 1,
      pro: 5,
      enterprise: 1000
    };
    return limits[tier] || 1;
  }

  /**
   * Log license validation
   */
  async logLicenseValidation(licenseKey, userId, domain, success) {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO license_validations (
          id, license_key, user_id, domain, success, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      await stmt.bind(
        crypto.randomUUID(),
        licenseKey,
        userId,
        domain || 'unknown',
        success,
        new Date().toISOString()
      ).run();
    } catch (error) {
      console.error('Failed to log license validation:', error);
    }
  }

  /**
   * Send activation request to server
   */
  async sendActivationRequest(licenseKey, userId, domain) {
    try {
      // In production, this would send to your activation server
      console.log('Activation request:', {
        licenseKey,
        userId,
        domain,
        timestamp: new Date().toISOString()
      });

      // Mock activation - replace with real server call
      // const response = await fetch(`${config.license.validationEndpoint}/activate`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ licenseKey, userId, domain })
      // });
    } catch (error) {
      console.error('Activation request failed:', error);
    }
  }

  /**
   * Generate activation URL for customer
   */
  generateActivationUrl(licenseKey, userId, domain) {
    const params = new URLSearchParams({
      license: licenseKey,
      user: userId,
      domain: domain || '',
      redirect: window?.location?.href || ''
    });

    return `https://lunaos.ai/activate?${params.toString()}`;
  }

  /**
   * Check if user can perform action based on license
   */
  async canPerformAction(licenseData, action) {
    if (!this.isLicenseValid(licenseData)) {
      return false;
    }

    // Check if action is allowed for this tier
    const tier = licenseData.tier;
    const actionFeatures = {
      'vision_rag': ['pro', 'enterprise'],
      'glm_vision': ['pro', 'enterprise'],
      'team_management': ['enterprise'],
      'sso': ['enterprise'],
      'custom_training': ['enterprise']
    };

    const allowedTiers = actionFeatures[action];
    if (allowedTiers && !allowedTiers.includes(tier)) {
      return false;
    }

    // Check user limits for team licenses
    if (tier === 'enterprise' && licenseData.maxUsers) {
      const currentUsers = await this.getCurrentUsersForLicense(licenseData.licenseKey);
      if (currentUsers >= licenseData.maxUsers) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get current users for a license
   */
  async getCurrentUsersForLicense(licenseKey) {
    try {
      const result = await this.db.prepare(`
        SELECT COUNT(DISTINCT user_id) as count
        FROM license_validations
        WHERE license_key = ?
        AND success = true
        AND created_at > date('now', '-30 days')
      `).bind(licenseKey).first();

      return result?.count || 0;
    } catch (error) {
      console.error('Failed to get current users count:', error);
      return 0;
    }
  }

  /**
   * Deactivate license
   */
  async deactivateLicense(licenseKey) {
    try {
      await this.cache.delete(`license:${licenseKey}`);

      const stmt = this.db.prepare(`
        UPDATE license_validations
        SET success = false
        WHERE license_key = ?
      `);

      await stmt.bind(licenseKey).run();

      return { success: true };
    } catch (error) {
      console.error('License deactivation failed:', error);
      return { success: false, error: 'Failed to deactivate license' };
    }
  }
}

export default LicenseService;