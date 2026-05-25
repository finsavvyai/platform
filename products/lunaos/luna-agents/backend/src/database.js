import config from './config.js';
import DatabasePerformanceOptimizer from './database-performance.js';

export class DatabaseService {
  constructor(env) {
    this.db = env.DB;
    this.cache = env.CACHE;
    this.optimizer = new DatabasePerformanceOptimizer(env.DB, env.CACHE);
  }

  /**
   * Safely get data from cache with error handling
   * P1-1 FIX: Graceful degradation when cache fails
   */
  async getCached(cacheKey) {
    try {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (parseError) {
          console.error(`Cache parse error for key ${cacheKey}:`, parseError);
          // Invalidate corrupted cache entry
          await this.cache.delete(cacheKey).catch(() => {});
          return null;
        }
      }
      return null;
    } catch (error) {
      console.error(`Cache read error for key ${cacheKey}:`, error);
      // Degrade gracefully to database - don't crash
      return null;
    }
  }

  /**
   * Safely set data in cache with error handling
   * P1-1 FIX: Don't crash if cache write fails
   */
  async setCached(cacheKey, value, ttl) {
    try {
      const serialized = JSON.stringify(value);
      await this.cache.put(cacheKey, serialized, { expirationTtl: ttl });
    } catch (error) {
      console.error(`Cache write error for key ${cacheKey}:`, error);
      // Don't throw - cache write failures are non-critical
    }
  }

  /**
   * Get or create user by user_id (from Claude Code)
   */
  async getOrCreateUser(userId, email = null) {
    const cacheKey = `user:${userId}`;

    // Try cache first with error handling
    const cached = await this.getCached(cacheKey);
    if (cached) {
      return cached;
    }

    // Check if user exists
    let user = await this.getUserByUserId(userId);

    if (!user) {
      // Create new user
      const id = this.generateId();
      const now = new Date().toISOString();

      user = {
        id,
        user_id: userId,
        email: email || `${userId}@luna-rag.local`,
        tier: 'free',
        api_key: null,
        subscription_id: null,
        subscription_status: 'inactive',
        created_at: now,
        updated_at: now
      };

      await this.createUser(user);
    }

    // Cache for 5 minutes with error handling
    await this.setCached(cacheKey, user, config.cache.ttl.user);

    return user;
  }

  /**
   * Get user by API key
   */
  async getUserByApiKey(apiKey) {
    if (!apiKey) return null;

    const cacheKey = `api_key:${apiKey}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await this.db
      .prepare('SELECT * FROM users WHERE api_key = ?')
      .bind(apiKey)
      .first();

    if (result) {
      await this.cache.put(cacheKey, JSON.stringify(result), { expirationTtl: config.cache.ttl.user });
    }

    return result;
  }

  /**
   * Get user by user_id
   */
  async getUserByUserId(userId) {
    return await this.optimizer.getUserOptimized({ userId });
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    const cacheKey = `email:${email}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await this.db
      .prepare('SELECT * FROM users WHERE email = ?')
      .bind(email)
      .first();

    if (result) {
      await this.cache.put(cacheKey, JSON.stringify(result), { expirationTtl: config.cache.ttl.user });
    }

    return result;
  }

  /**
   * Create new user with transaction support
   * P1-2 FIX: Atomic user creation with usage metrics initialization
   */
  async createUser(userData) {
    try {
      // Use D1 batch for atomic transaction
      const results = await this.db.batch([
        // Insert user record
        this.db.prepare(`
          INSERT INTO users (
            id, user_id, email, tier, api_key, subscription_id,
            subscription_status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          userData.id,
          userData.user_id,
          userData.email,
          userData.tier || 'free',
          userData.api_key,
          userData.subscription_id,
          userData.subscription_status || 'inactive',
          userData.created_at,
          userData.updated_at
        ),
        // Initialize usage metrics record
        this.db.prepare(`
          INSERT INTO usage_metrics (
            id, user_id, queries_count, documents_indexed,
            storage_used_mb, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          this.generateId(),
          userData.id,
          0, // Initial query count
          0, // Initial documents indexed
          0, // Initial storage used
          userData.created_at,
          userData.created_at
        )
      ]);

      // Check if all operations succeeded
      const allSucceeded = results.every(r => r.success);
      if (!allSucceeded) {
        const failedOps = results.filter(r => !r.success);
        throw new Error(`Transaction failed: ${JSON.stringify(failedOps)}`);
      }

      return userData;
    } catch (error) {
      console.error('User creation transaction failed:', error);
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  /**
   * Validate and sanitize user updates
   * @param {Object} updates - Fields to update
   * @returns {Object} Validated and sanitized updates
   */
  validateUserUpdates(updates) {
    // Whitelist of allowed update fields
    const allowedFields = [
      'email',
      'tier',
      'api_key',
      'subscription_id',
      'subscription_status'
    ];

    const validatedUpdates = {};

    for (const [key, value] of Object.entries(updates)) {
      // Check if field is allowed
      if (!allowedFields.includes(key)) {
        throw new Error(`Invalid update field: ${key}`);
      }

      // Validate field-specific constraints
      switch (key) {
        case 'email':
          if (!this.isValidEmail(value)) {
            throw new Error('Invalid email format');
          }
          validatedUpdates[key] = value.toLowerCase().trim();
          break;

        case 'tier':
          const validTiers = ['free', 'pro', 'enterprise'];
          if (!validTiers.includes(value)) {
            throw new Error(`Invalid tier: ${value}. Must be one of: ${validTiers.join(', ')}`);
          }
          validatedUpdates[key] = value;
          break;

        case 'subscription_status':
          const validStatuses = ['active', 'inactive', 'cancelled', 'past_due', 'trialing'];
          if (!validStatuses.includes(value)) {
            throw new Error(`Invalid subscription status: ${value}`);
          }
          validatedUpdates[key] = value;
          break;

        case 'api_key':
          if (value !== null && typeof value !== 'string') {
            throw new Error('API key must be a string or null');
          }
          validatedUpdates[key] = value;
          break;

        case 'subscription_id':
          if (value !== null && typeof value !== 'string') {
            throw new Error('Subscription ID must be a string or null');
          }
          validatedUpdates[key] = value;
          break;

        default:
          validatedUpdates[key] = value;
      }
    }

    return validatedUpdates;
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} True if valid
   */
  isValidEmail(email) {
    if (!email || typeof email !== 'string') {
      return false;
    }

    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 255;
  }

  /**
   * Update user with input validation
   */
  async updateUser(id, updates) {
    // Validate ID
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid user ID');
    }

    // Validate and sanitize updates
    const validatedUpdates = this.validateUserUpdates(updates);

    // Check if there are any valid updates
    if (Object.keys(validatedUpdates).length === 0) {
      throw new Error('No valid fields to update');
    }

    const setClause = Object.keys(validatedUpdates)
      .map(key => `${key} = ?`)
      .join(', ');

    const values = Object.values(validatedUpdates);
    values.push(new Date().toISOString()); // updated_at
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE users
      SET ${setClause}, updated_at = ?
      WHERE id = ?
    `);

    await stmt.bind(...values).run();

    // P1-5 FIX: Comprehensive cache invalidation with error handling
    // Invalidate all related cache keys
    const user = await this.getUserById(id);
    if (user) {
      const cacheKeys = [
        `user:${user.user_id}`,
        `email:${user.email}`
      ];

      if (user.api_key) {
        cacheKeys.push(`api_key:${user.api_key}`);
      }

      // Also invalidate old values if they were updated
      if (validatedUpdates.email && validatedUpdates.email !== user.email) {
        cacheKeys.push(`email:${validatedUpdates.email}`);
      }
      if (validatedUpdates.api_key && validatedUpdates.api_key !== user.api_key) {
        cacheKeys.push(`api_key:${validatedUpdates.api_key}`);
      }

      // Delete cache keys with error handling (don't crash if cache fails)
      await Promise.allSettled(
        cacheKeys.map(key =>
          this.cache.delete(key).catch(err => {
            console.error(`Failed to delete cache key ${key}:`, err);
          })
        )
      );
    }

    return this.getUserByUserId(id);
  }

  /**
   * Update user by email
   */
  async updateUserByEmail(email, updates) {
    const user = await this.getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    return await this.updateUser(user.id, updates);
  }

  /**
   * Track usage
   */
  async trackUsage(userId, type, amount = 1) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Get user for current stats
    const user = await this.getUserByUserId(userId);
    if (!user) return null;

    // Check if usage record exists for today
    let usage = await this.getUsageByDate(userId, today);

    if (!usage) {
      // Create new usage record
      usage = {
        id: this.generateId(),
        user_id: userId,
        date: today,
        searches_count: 0,
        files_indexed: 0,
        vision_analyses: 0,
        glm_analyses: 0,
        api_calls: 0
      };
    }

    // Update the appropriate counter
    switch (type) {
      case 'search':
        usage.searches_count += amount;
        break;
      case 'files_indexed':
        usage.files_indexed += amount;
        break;
      case 'vision_analysis':
        usage.vision_analyses += amount;
        break;
      case 'glm_analysis':
        usage.glm_analyses += amount;
        break;
      case 'api_call':
        usage.api_calls += amount;
        break;
    }

    // Save usage
    await this.saveUsage(usage);

    // Update monthly aggregation
    await this.updateMonthlyUsage(userId, usage, user.tier);

    // Invalidate usage cache
    await this.cache.delete(`usage:${userId}:${today}`);

    return usage;
  }

  /**
   * Get usage by date
   */
  async getUsageByDate(userId, date) {
    const cacheKey = `usage:${userId}:${date}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await this.db
      .prepare('SELECT * FROM usage_stats WHERE user_id = ? AND date = ?')
      .bind(userId, date)
      .first();

    if (result) {
      await this.cache.put(cacheKey, JSON.stringify(result), { expirationTtl: config.cache.ttl.usage });
    }

    return result;
  }

  /**
   * Get user usage statistics
   */
  async getUserUsage(userId) {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date();
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;

    // Get today's usage
    const dailyUsage = await this.getUsageByDate(userId, today) || {
      searches_count: 0,
      files_indexed: 0,
      vision_analyses: 0,
      glm_analyses: 0,
      api_calls: 0
    };

    // Get monthly usage
    const monthlyUsage = await this.getMonthlyUsage(userId, year, month) || {
      total_searches: 0,
      total_files_indexed: 0,
      total_vision_analyses: 0,
      total_glm_analyses: 0,
      total_api_calls: 0
    };

    return {
      ...dailyUsage,
      searches: dailyUsage.searches_count,
      filesIndexed: dailyUsage.files_indexed,
      visionAnalyses: dailyUsage.vision_analyses,
      glmAnalyses: dailyUsage.glm_analyses,
      monthly: monthlyUsage
    };
  }

  /**
   * Save usage record
   */
  async saveUsage(usage) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO usage_stats (
        id, user_id, date, searches_count, files_indexed,
        vision_analyses, glm_analyses, api_calls, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      usage.id,
      usage.user_id,
      usage.date,
      usage.searches_count,
      usage.files_indexed,
      usage.vision_analyses,
      usage.glm_analyses,
      usage.api_calls,
      new Date().toISOString()
    ).run();
  }

  /**
   * Get monthly usage
   */
  async getMonthlyUsage(userId, year, month) {
    const result = await this.db
      .prepare(`
        SELECT * FROM monthly_usage
        WHERE user_id = ? AND year = ? AND month = ?
      `)
      .bind(userId, year, month)
      .first();

    return result;
  }

  /**
   * Update monthly usage aggregation
   */
  async updateMonthlyUsage(userId, dailyUsage, tier) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // Check if monthly record exists
    let monthly = await this.getMonthlyUsage(userId, year, month);

    if (!monthly) {
      monthly = {
        id: this.generateId(),
        user_id: userId,
        year,
        month,
        total_searches: 0,
        total_files_indexed: 0,
        total_vision_analyses: 0,
        total_glm_analyses: 0,
        total_api_calls: 0,
        subscription_tier: tier
      };
    }

    // Update totals (this is simplified - in production you'd sum all daily records)
    monthly.total_searches += dailyUsage.searches_count;
    monthly.total_files_indexed += dailyUsage.files_indexed;
    monthly.total_vision_analyses += dailyUsage.vision_analyses;
    monthly.total_glm_analyses += dailyUsage.glm_analyses;
    monthly.total_api_calls += dailyUsage.api_calls;
    monthly.subscription_tier = tier;

    // Save monthly aggregation
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO monthly_usage (
        id, user_id, year, month, total_searches, total_files_indexed,
        total_vision_analyses, total_glm_analyses, total_api_calls,
        subscription_tier, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      monthly.id,
      monthly.user_id,
      monthly.year,
      monthly.month,
      monthly.total_searches,
      monthly.total_files_indexed,
      monthly.total_vision_analyses,
      monthly.total_glm_analyses,
      monthly.total_api_calls,
      monthly.subscription_tier,
      new Date().toISOString()
    ).run();
  }

  /**
   * Log conversation
   */
  async logConversation(userId, sessionId, message, response, intent, metadata = {}) {
    const stmt = this.db.prepare(`
      INSERT INTO conversations (
        id, user_id, session_id, message, response, intent,
        tokens_used, processing_time_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      this.generateId(),
      userId,
      sessionId,
      message,
      response,
      intent,
      metadata.tokensUsed || 0,
      metadata.processingTimeMs || 0,
      new Date().toISOString()
    ).run();
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(userId, sessionId = null, limit = 50) {
    let query = 'SELECT * FROM conversations WHERE user_id = ?';
    const params = [userId];

    if (sessionId) {
      query += ' AND session_id = ?';
      params.push(sessionId);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const results = await this.db
      .prepare(query)
      .bind(...params)
      .all();

    return results.results || [];
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return crypto.randomUUID();
  }

  /**
   * Check if user can perform action
   */
  async canPerformAction(userId, actionType) {
    const user = await this.getUserByUserId(userId);
    if (!user) return false;

    const tier = config.tiers[user.tier];
    if (!tier) return false;

    // Pro and Enterprise users have unlimited access
    if (tier.searchesPerDay === -1) return true;

    const usage = await this.getUserUsage(userId);

    switch (actionType) {
      case 'search':
        return usage.searches < tier.searchesPerDay;
      case 'vision_analysis':
        return tier.visionAnalyses === -1 || usage.visionAnalyses < tier.visionAnalyses;
      case 'glm_analysis':
        return tier.glmAnalyses === -1 || usage.glmAnalyses < tier.glmAnalyses;
      default:
        return true;
    }
  }

  // ==================== TEAM MANAGEMENT METHODS ====================

  /**
   * Create a new team
   */
  async createTeam(teamData) {
    const stmt = this.db.prepare(`
      INSERT INTO teams (
        id, name, description, owner_id, settings, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const team = {
      id: teamData.id || this.generateId(),
      name: teamData.name,
      description: teamData.description || null,
      owner_id: teamData.owner_id,
      settings: JSON.stringify(teamData.settings || {}),
      created_at: teamData.created_at || new Date().toISOString(),
      updated_at: teamData.updated_at || new Date().toISOString()
    };

    await stmt.bind(
      team.id,
      team.name,
      team.description,
      team.owner_id,
      team.settings,
      team.created_at,
      team.updated_at
    ).run();

    // Create team settings
    await this.createTeamSettings(team.id, teamData.settings || {});

    // Add owner as team member
    await this.addTeamMember({
      team_id: team.id,
      user_id: teamData.owner_id,
      role: 'owner',
      status: 'joined',
      invited_by: teamData.owner_id,
      joined_at: new Date().toISOString()
    });

    // Log team creation
    await this.logTeamActivity({
      team_id: team.id,
      user_id: teamData.owner_id,
      action: 'created',
      target_id: team.id,
      details: JSON.stringify({ team_name: team.name })
    });

    return team;
  }

  /**
   * Get team by ID
   */
  async getTeamById(teamId) {
    const cacheKey = `team:${teamId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await this.db
      .prepare('SELECT * FROM teams WHERE id = ?')
      .bind(teamId)
      .first();

    if (result) {
      await this.cache.put(cacheKey, JSON.stringify(result), { expirationTtl: config.cache.ttl.user });
    }

    return result;
  }

  /**
   * Get teams for a user
   */
  async getUserTeams(userId, role = null) {
    let query = `
      SELECT t.*, tm.role, tm.status as member_status
      FROM teams t
      JOIN team_members tm ON t.id = tm.team_id
      WHERE tm.user_id = ? AND tm.status = 'joined'
    `;
    const params = [userId];

    if (role) {
      query += ' AND tm.role = ?';
      params.push(role);
    }

    query += ' ORDER BY t.created_at DESC';

    const results = await this.db
      .prepare(query)
      .bind(...params)
      .all();

    return results.results || [];
  }

  /**
   * Add member to team
   */
  async addTeamMember(memberData) {
    // Check if user is already a member
    const existing = await this.getTeamMember(memberData.team_id, memberData.user_id);
    if (existing && existing.status !== 'removed') {
      throw new Error('User is already a team member');
    }

    const stmt = this.db.prepare(`
      INSERT INTO team_members (
        id, team_id, user_id, role, status, invited_by, invited_at, joined_at, permissions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const member = {
      id: memberData.id || this.generateId(),
      team_id: memberData.team_id,
      user_id: memberData.user_id,
      role: memberData.role || 'member',
      status: memberData.status || 'invited',
      invited_by: memberData.invited_by,
      invited_at: memberData.invited_at || new Date().toISOString(),
      joined_at: memberData.joined_at || null,
      permissions: JSON.stringify(memberData.permissions || {})
    };

    await stmt.bind(
      member.id,
      member.team_id,
      member.user_id,
      member.role,
      member.status,
      member.invited_by,
      member.invited_at,
      member.joined_at,
      member.permissions
    ).run();

    // Log team member addition
    await this.logTeamActivity({
      team_id: member.team_id,
      user_id: member.invited_by,
      action: 'invited',
      target_id: member.user_id,
      details: JSON.stringify({ role: member.role })
    });

    return member;
  }

  /**
   * Get team member
   */
  async getTeamMember(teamId, userId) {
    const result = await this.db
      .prepare('SELECT * FROM team_members WHERE team_id = ? AND user_id = ?')
      .bind(teamId, userId)
      .first();

    return result;
  }

  /**
   * Get all team members
   */
  async getTeamMembers(teamId, status = 'joined') {
    const query = `
      SELECT tm.*, u.email, u.user_id
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ? AND tm.status = ?
      ORDER BY tm.joined_at ASC, tm.invited_at ASC
    `;

    const results = await this.optimizer.executeQuery(
      query,
      [teamId, status],
      {
        cacheable: true,
        cacheKey: `team_members:${teamId}:${status}`
      }
    );

    return results.results || [];
  }

  /**
   * Update team member role
   */
  async updateTeamMemberRole(teamId, userId, newRole, updatedBy) {
    const stmt = this.db.prepare(`
      UPDATE team_members
      SET role = ?, updated_at = ?
      WHERE team_id = ? AND user_id = ?
    `);

    await stmt.bind(newRole, new Date().toISOString(), teamId, userId).run();

    // Log role change
    await this.logTeamActivity({
      team_id: teamId,
      user_id: updatedBy,
      action: 'role_changed',
      target_id: userId,
      details: JSON.stringify({ new_role: newRole })
    });

    return this.getTeamMember(teamId, userId);
  }

  /**
   * Remove team member
   */
  async removeTeamMember(teamId, userId, removedBy) {
    const stmt = this.db.prepare(`
      UPDATE team_members
      SET status = 'removed', left_at = ?
      WHERE team_id = ? AND user_id = ?
    `);

    await stmt.bind(new Date().toISOString(), teamId, userId).run();

    // Log member removal
    await this.logTeamActivity({
      team_id: teamId,
      user_id: removedBy,
      action: 'removed',
      target_id: userId,
      details: JSON.stringify({})
    });

    return true;
  }

  /**
   * Create team settings
   */
  async createTeamSettings(teamId, settings) {
    const stmt = this.db.prepare(`
      INSERT INTO team_settings (
        team_id, rag_sharing, codebase_sharing, conversation_sharing,
        analytics_sharing, default_permissions, invitation_expiry_hours,
        max_members, storage_limit_mb, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      teamId,
      settings.rag_sharing !== undefined ? settings.rag_sharing : true,
      settings.codebase_sharing !== undefined ? settings.codebase_sharing : true,
      settings.conversation_sharing !== undefined ? settings.conversation_sharing : false,
      settings.analytics_sharing !== undefined ? settings.analytics_sharing : true,
      JSON.stringify(settings.default_permissions || { create: true, read: true, update: false, delete: false }),
      settings.invitation_expiry_hours || 168,
      settings.max_members || 50,
      settings.storage_limit_mb || 1000,
      new Date().toISOString(),
      new Date().toISOString()
    ).run();

    return { team_id: teamId, ...settings };
  }

  /**
   * Get team settings
   */
  async getTeamSettings(teamId) {
    const result = await this.db
      .prepare('SELECT * FROM team_settings WHERE team_id = ?')
      .bind(teamId)
      .first();

    if (result && result.default_permissions) {
      result.default_permissions = JSON.parse(result.default_permissions);
    }

    return result;
  }

  /**
   * Update team settings
   */
  async updateTeamSettings(teamId, updates) {
    const setClause = Object.keys(updates)
      .filter(key => key !== 'team_id')
      .map(key => `${key} = ?`)
      .join(', ');

    const values = Object.keys(updates)
      .filter(key => key !== 'team_id')
      .map(key => {
        if (key === 'default_permissions') {
          return JSON.stringify(updates[key]);
        }
        return updates[key];
      });

    values.push(new Date().toISOString()); // updated_at
    values.push(teamId);

    const stmt = this.db.prepare(`
      UPDATE team_settings
      SET ${setClause}, updated_at = ?
      WHERE team_id = ?
    `);

    await stmt.bind(...values).run();

    return this.getTeamSettings(teamId);
  }

  /**
   * Log team activity
   */
  async logTeamActivity(activityData) {
    const stmt = this.db.prepare(`
      INSERT INTO team_audit_log (
        id, team_id, user_id, action, target_id, details, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      this.generateId(),
      activityData.team_id,
      activityData.user_id,
      activityData.action,
      activityData.target_id,
      activityData.details || JSON.stringify({}),
      activityData.ip_address || null,
      activityData.user_agent || null,
      new Date().toISOString()
    ).run();
  }

  /**
   * Get team audit log
   */
  async getTeamAuditLog(teamId, limit = 100, action = null) {
    let query = `
      SELECT tal.*, u.email as user_email
      FROM team_audit_log tal
      LEFT JOIN users u ON tal.user_id = u.id
      WHERE tal.team_id = ?
    `;
    const params = [teamId];

    if (action) {
      query += ' AND tal.action = ?';
      params.push(action);
    }

    query += ' ORDER BY tal.created_at DESC LIMIT ?';
    params.push(limit);

    const results = await this.db
      .prepare(query)
      .bind(...params)
      .all();

    return results.results || [];
  }

  /**
   * Check if user has team permission
   */
  async hasTeamPermission(userId, teamId, permission, resource = null) {
    const member = await this.getTeamMember(teamId, userId);
    if (!member || member.status !== 'joined') {
      return false;
    }

    // Owners have all permissions
    if (member.role === 'owner') {
      return true;
    }

    const settings = await this.getTeamSettings(teamId);
    if (!settings) {
      return false;
    }

    const rolePermissions = {
      'admin': { create: true, read: true, update: true, delete: true },
      'member': settings.default_permissions,
      'viewer': { create: false, read: true, update: false, delete: false }
    };

    const userPermissions = rolePermissions[member.role] || {};
    return userPermissions[permission] === true;
  }

  /**
   * Get team statistics
   */
  async getTeamStatistics(teamId) {
    const memberCount = await this.db
      .prepare('SELECT COUNT(*) as count FROM team_members WHERE team_id = ? AND status = "joined"')
      .bind(teamId)
      .first();

    const projectCount = await this.db
      .prepare('SELECT COUNT(*) as count FROM team_projects WHERE team_id = ?')
      .bind(teamId)
      .first();

    const recentActivity = await this.db
      .prepare(`
        SELECT COUNT(*) as count
        FROM team_audit_log
        WHERE team_id = ? AND created_at > datetime('now', '-7 days')
      `)
      .bind(teamId)
      .first();

    return {
      member_count: memberCount?.count || 0,
      project_count: projectCount?.count || 0,
      recent_activity_count: recentActivity?.count || 0,
      team_id: teamId
    };
  }

  // ==================== SHARED WORKSPACE METHODS ====================

  /**
   * Create team project
   */
  async createTeamProject(projectData) {
    const stmt = this.db.prepare(`
      INSERT INTO team_projects (
        id, team_id, name, description, repository_url, language,
        settings, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const project = {
      id: projectData.id || this.generateId(),
      team_id: projectData.team_id,
      name: projectData.name,
      description: projectData.description || null,
      repository_url: projectData.repository_url,
      language: projectData.language || null,
      settings: JSON.stringify(projectData.settings || {}),
      created_at: projectData.created_at || new Date().toISOString(),
      updated_at: projectData.updated_at || new Date().toISOString()
    };

    await stmt.bind(
      project.id,
      project.team_id,
      project.name,
      project.description,
      project.repository_url,
      project.language,
      project.settings,
      project.created_at,
      project.updated_at
    ).run();

    return project;
  }

  /**
   * Get team projects
   */
  async getTeamProjects(teamId) {
    const results = await this.db
      .prepare('SELECT * FROM team_projects WHERE team_id = ? ORDER BY created_at DESC')
      .bind(teamId)
      .all();

    const projects = results.results || [];
    return projects.map(project => ({
      ...project,
      settings: project.settings ? JSON.parse(project.settings) : {}
    }));
  }

  /**
   * Update team project
   */
  async updateTeamProject(projectId, updates) {
    const setClause = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ');

    const values = Object.values(updates);
    values.push(new Date().toISOString()); // updated_at
    values.push(projectId);

    const stmt = this.db.prepare(`
      UPDATE team_projects
      SET ${setClause}, updated_at = ?
      WHERE id = ?
    `);

    await stmt.bind(...values).run();

    const result = await this.db
      .prepare('SELECT * FROM team_projects WHERE id = ?')
      .bind(projectId)
      .first();

    return result;
  }

  /**
   * Create team knowledge entry
   */
  async createTeamKnowledge(knowledgeData) {
    const stmt = this.db.prepare(`
      INSERT INTO team_knowledge (
        id, team_id, title, content, type, tags, category,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const knowledge = {
      id: knowledgeData.id || this.generateId(),
      team_id: knowledgeData.team_id,
      title: knowledgeData.title,
      content: knowledgeData.content,
      type: knowledgeData.type || 'document',
      tags: JSON.stringify(knowledgeData.tags || []),
      category: knowledgeData.category || null,
      created_by: knowledgeData.created_by,
      created_at: knowledgeData.created_at || new Date().toISOString(),
      updated_at: knowledgeData.updated_at || new Date().toISOString()
    };

    await stmt.bind(
      knowledge.id,
      knowledge.team_id,
      knowledge.title,
      knowledge.content,
      knowledge.type,
      knowledge.tags,
      knowledge.category,
      knowledge.created_by,
      knowledge.created_at,
      knowledge.updated_at
    ).run();

    return knowledge;
  }

  /**
   * Get team knowledge
   */
  async getTeamKnowledge(teamId, options = {}) {
    let query = 'SELECT * FROM team_knowledge WHERE team_id = ?';
    const params = [teamId];

    if (options.type) {
      query += ' AND type = ?';
      params.push(options.type);
    }

    if (options.category) {
      query += ' AND category = ?';
      params.push(options.category);
    }

    if (options.search) {
      query += ' AND (title LIKE ? OR content LIKE ?)';
      const searchTerm = `%${options.search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ' ORDER BY created_at DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }

    const results = await this.db
      .prepare(query)
      .bind(...params)
      .all();

    const knowledge = results.results || [];
    return knowledge.map(item => ({
      ...item,
      tags: item.tags ? JSON.parse(item.tags) : []
    }));
  }

  /**
   * Get team conversations
   */
  async getTeamConversations(teamId, options = {}) {
    let query = `
      SELECT c.*, u.email as member_email, u.user_id as member_name
      FROM team_conversations c
      JOIN users u ON c.user_id = u.id
      WHERE c.team_id = ?
    `;
    const params = [teamId];

    if (options.search) {
      query += ' AND (c.message LIKE ? OR c.response LIKE ?)';
      const searchTerm = `%${options.search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (options.member_id) {
      query += ' AND c.user_id = ?';
      params.push(options.member_id);
    }

    if (options.date_range) {
      query += ' AND c.created_at BETWEEN ? AND ?';
      params.push(options.date_range.start, options.date_range.end);
    }

    query += ' ORDER BY c.created_at DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }

    const results = await this.db
      .prepare(query)
      .bind(...params)
      .all();

    return results.results || [];
  }

  /**
   * Save team conversation
   */
  async saveTeamConversation(teamId, userId, message, response, metadata = {}) {
    const stmt = this.db.prepare(`
      INSERT INTO team_conversations (
        id, team_id, user_id, message, response, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const conversation = {
      id: this.generateId(),
      team_id: teamId,
      user_id: userId,
      message: message,
      response: response,
      metadata: JSON.stringify(metadata),
      created_at: new Date().toISOString()
    };

    await stmt.bind(
      conversation.id,
      conversation.team_id,
      conversation.user_id,
      conversation.message,
      conversation.response,
      conversation.metadata,
      conversation.created_at
    ).run();

    return conversation;
  }

  /**
   * Get team query statistics
   */
  async getTeamQueryStats(teamId, dateRange = null) {
    let query = `
      SELECT
        COUNT(*) as total_queries,
        COUNT(DISTINCT user_id) as active_members,
        AVG(JSON_EXTRACT(metadata, '$.response_length')) as avg_response_length,
        DATE(created_at) as query_date
      FROM team_audit_log
      WHERE team_id = ? AND action = 'rag_query'
    `;
    const params = [teamId];

    if (dateRange) {
      query += ' AND created_at BETWEEN ? AND ?';
      params.push(dateRange.start, dateRange.end);
    }

    query += ' GROUP BY DATE(created_at) ORDER BY query_date DESC LIMIT 30';

    const results = await this.db
      .prepare(query)
      .bind(...params)
      .all();

    return results.results || [];
  }

  /**
   * Get team project statistics
   */
  async getTeamProjectStats(teamId) {
    const projects = await this.getTeamProjects(teamId);

    return {
      total_projects: projects.length,
      indexed_projects: projects.filter(p => p.indexed_at).length,
      languages: [...new Set(projects.map(p => p.language).filter(Boolean))],
      last_indexed: projects
        .filter(p => p.indexed_at)
        .sort((a, b) => new Date(b.indexed_at) - new Date(a.indexed_at))[0]?.indexed_at || null
    };
  }

  // ==================== TEAM ANALYTICS METHODS ====================

  /**
   * Get member activity statistics
   */
  async getMemberActivityStats(teamId, userId, dateRange = null) {
    // Get query statistics for member
    const queryStats = await this.getMemberQueryStats(teamId, userId, dateRange);

    // Get knowledge contributions
    const knowledgeContributions = await this.db
      .prepare('SELECT COUNT(*) as count FROM team_knowledge WHERE team_id = ? AND created_by = ?')
      .bind(teamId, userId)
      .first();

    // Get projects indexed by member
    const projectsIndexed = await this.db
      .prepare('SELECT COUNT(*) as count FROM team_projects WHERE team_id = ? AND created_by = ? AND indexed_at IS NOT NULL')
      .bind(teamId, userId)
      .first();

    // Get collaboration sessions
    const collaborationSessions = await this.db
      .prepare('SELECT COUNT(*) as count FROM team_collaboration_sessions WHERE team_id = ? AND host_user_id = ?')
      .bind(teamId, userId)
      .first();

    return {
      last_active: queryStats.last_active || new Date(0).toISOString(),
      queries_count: queryStats.total_queries || 0,
      knowledge_contributions: knowledgeContributions?.count || 0,
      projects_indexed: projectsIndexed?.count || 0,
      collaboration_sessions: collaborationSessions?.count || 0
    };
  }

  /**
   * Get member query statistics
   */
  async getMemberQueryStats(teamId, userId, dateRange = null) {
    let query = `
      SELECT
        COUNT(*) as total_queries,
        MAX(created_at) as last_active,
        AVG(JSON_EXTRACT(metadata, '$.response_length')) as avg_response_length
      FROM team_audit_log
      WHERE team_id = ? AND user_id = ? AND action = 'rag_query'
    `;
    const params = [teamId, userId];

    if (dateRange) {
      query += ' AND created_at BETWEEN ? AND ?';
      params.push(dateRange.start, dateRange.end);
    }

    const result = await this.db
      .prepare(query)
      .bind(...params)
      .first();

    return {
      total_queries: result?.total_queries || 0,
      last_active: result?.last_active || null,
      avg_response_length: result?.avg_response_length || 0
    };
  }

  /**
   * Get knowledge contributors
   */
  async getKnowledgeContributors(teamId, dateRange = null) {
    let query = `
      SELECT DISTINCT created_by as user_id, COUNT(*) as contribution_count
      FROM team_knowledge
      WHERE team_id = ?
    `;
    const params = [teamId];

    if (dateRange) {
      query += ' AND created_at BETWEEN ? AND ?';
      params.push(dateRange.start, dateRange.end);
    }

    query += ' GROUP BY created_by HAVING contribution_count > 0';

    const results = await this.db
      .prepare(query)
      .bind(...params)
      .all();

    return results.results || [];
  }

  /**
   * Get feature usage metrics
   */
  async getFeatureUsageMetrics(teamId, feature, dateRange = null) {
    let query = `
      SELECT
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(*) as total_usage,
        DATE(created_at) as usage_date
      FROM team_audit_log
      WHERE team_id = ? AND action = ?
    `;
    const params = [teamId, feature];

    if (dateRange) {
      query += ' AND created_at BETWEEN ? AND ?';
      params.push(dateRange.start, dateRange.end);
    }

    query += ' GROUP BY DATE(created_at) ORDER BY usage_date DESC LIMIT 30';

    const results = await this.db
      .prepare(query)
      .bind(...params)
      .all();

    return results.results || [];
  }

  /**
   * Get project indexing metrics
   */
  async getProjectIndexingMetrics(teamId, dateRange = null) {
    let query = `
      SELECT
        COUNT(*) as total_projects,
        COUNT(CASE WHEN indexed_at IS NOT NULL THEN 1 END) as indexed_projects,
        AVG(files_count) as avg_files_count,
        DATE(created_at) as indexing_date
      FROM team_projects
      WHERE team_id = ?
    `;
    const params = [teamId];

    if (dateRange) {
      query += ' AND created_at BETWEEN ? AND ?';
      params.push(dateRange.start, dateRange.end);
    }

    query += ' GROUP BY DATE(created_at) ORDER BY indexing_date DESC LIMIT 30';

    const results = await this.db
      .prepare(query)
      .bind(...params)
      .all();

    return results.results || [];
  }

  /**
   * Get search performance metrics
   */
  async getSearchPerformanceMetrics(teamId, dateRange = null) {
    let query = `
      SELECT
        AVG(response_time_ms) as avg_response_time,
        AVG(results_count) as avg_results_count,
        COUNT(*) as total_searches,
        COUNT(CASE WHEN results_count = 0 THEN 1 END) as zero_results_searches,
        DATE(created_at) as search_date
      FROM team_search_history
      WHERE team_id = ?
    `;
    const params = [teamId];

    if (dateRange) {
      query += ' AND created_at BETWEEN ? AND ?';
      params.push(dateRange.start, dateRange.end);
    }

    query += ' GROUP BY DATE(created_at) ORDER BY search_date DESC LIMIT 30';

    const results = await this.db
      .prepare(query)
      .bind(...params)
      .all();

    return results.results || [];
  }

  /**
   * Get collaboration session metrics
   */
  async getCollaborationMetrics(teamId, dateRange = null) {
    let query = `
      SELECT
        COUNT(*) as total_sessions,
        AVG(CASE WHEN ended_at IS NOT NULL THEN
          (julianday(ended_at) - julianday(started_at)) * 24 * 60
        END) as avg_duration_minutes,
        session_type,
        DATE(started_at) as session_date
      FROM team_collaboration_sessions
      WHERE team_id = ?
    `;
    const params = [teamId];

    if (dateRange) {
      query += ' AND started_at BETWEEN ? AND ?';
      params.push(dateRange.start, dateRange.end);
    }

    query += ' GROUP BY session_type, DATE(started_at) ORDER BY session_date DESC LIMIT 30';

    const results = await this.db
      .prepare(query)
      .bind(...params)
      .all();

    return results.results || [];
  }

  /**
   * Get error metrics for team
   */
  async getErrorMetrics(teamId, dateRange = null) {
    let query = `
      SELECT
        action,
        COUNT(*) as error_count,
        details,
        DATE(created_at) as error_date
      FROM team_audit_log
      WHERE team_id = ? AND details LIKE '%"error":%'
    `;
    const params = [teamId];

    if (dateRange) {
      query += ' AND created_at BETWEEN ? AND ?';
      params.push(dateRange.start, dateRange.end);
    }

    query += ' GROUP BY action, details, DATE(created_at) ORDER BY error_date DESC LIMIT 100';

    const results = await this.db
      .prepare(query)
      .bind(...params)
      .all();

    return results.results || [];
  }

  /**
   * Get storage usage metrics
   */
  async getStorageUsageMetrics(teamId) {
    // Get knowledge base size
    const knowledgeSize = await this.db
      .prepare('SELECT SUM(LENGTH(content)) as total_size FROM team_knowledge WHERE team_id = ?')
      .bind(teamId)
      .first();

    // Get conversation size
    const conversationSize = await this.db
      .prepare('SELECT SUM(LENGTH(message) + LENGTH(response)) as total_size FROM team_conversations WHERE team_id = ?')
      .bind(teamId)
      .first();

    return {
      knowledge_base_size_kb: Math.round((knowledgeSize?.total_size || 0) / 1024),
      conversations_size_kb: Math.round((conversationSize?.total_size || 0) / 1024),
      total_storage_kb: Math.round(((knowledgeSize?.total_size || 0) + (conversationSize?.total_size || 0)) / 1024)
    };
  }

  /**
   * Get team growth metrics
   */
  async getGrowthMetrics(teamId) {
    // Get member growth over time
    const memberGrowth = await this.db
      .prepare(`
        SELECT
          DATE(joined_at) as join_date,
          COUNT(*) as new_members
        FROM team_members
        WHERE team_id = ? AND status = 'joined'
        GROUP BY DATE(joined_at)
        ORDER BY join_date DESC
        LIMIT 30
      `)
      .bind(teamId)
      .all();

    // Get project growth over time
    const projectGrowth = await this.db
      .prepare(`
        SELECT
          DATE(created_at) as create_date,
          COUNT(*) as new_projects
        FROM team_projects
        WHERE team_id = ?
        GROUP BY DATE(created_at)
        ORDER BY create_date DESC
        LIMIT 30
      `)
      .bind(teamId)
      .all();

    return {
      member_growth: memberGrowth.results || [],
      project_growth: projectGrowth.results || []
    };
  }

  /**
   * Get database performance metrics
   */
  getPerformanceMetrics() {
    return this.optimizer.getPerformanceMetrics();
  }

  /**
   * Get performance recommendations
   */
  getPerformanceRecommendations() {
    return this.optimizer.analyzeQueryPerformance();
  }

  /**
   * Generate performance indexes migration
   */
  generatePerformanceIndexes() {
    return this.optimizer.createPerformanceIndexMigrations();
  }

  /**
   * Execute bulk insert with optimization
   */
  async bulkInsertOptimized(table, records, options = {}) {
    return await this.optimizer.bulkInsertOptimized(table, records, options);
  }

  /**
   * Execute search with optimization
   */
  async searchOptimized(table, searchTerm, options = {}) {
    return await this.optimizer.searchOptimized(table, searchTerm, options);
  }

  /**
   * Execute batch queries with optimization
   */
  async executeBatch(queries, options = {}) {
    return await this.optimizer.executeBatch(queries, options);
  }
}

export default DatabaseService;