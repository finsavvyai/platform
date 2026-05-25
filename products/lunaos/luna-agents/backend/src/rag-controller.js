import config from './config.js';
import { DatabaseService } from './database.js';
import { LemonSqueezyService } from './lemonsqueezy.js';
import { EmailService } from './email.js';
import { AuthService } from './auth.js';
import { LicenseService } from './license.js';

export class RAGController {
  constructor(env) {
    this.env = env;
    this.db = new DatabaseService(env);
    this.ls = new LemonSqueezyService(env);
    this.email = new EmailService(env);
    this.auth = new AuthService(env);
    this.license = new LicenseService(env);
  }

  /**
   * Main RAG conversational flow endpoint
   * Handles intelligent routing based on user state and needs
   */
  async handleRAGQuery(userId, message, apiKey = null, sessionId = null, licenseKey = null) {
    try {
      // Validate license first
      const licenseData = await this.validateLicense(licenseKey, userId);

      if (!licenseData.valid) {
        return {
          success: false,
          error: 'Invalid or expired license. Please activate your license.',
          error_code: 'invalid_license',
          requiresActivation: licenseData.requiresActivation,
          activationUrl: this.license.generateActivationUrl(licenseKey, userId, 'localhost')
        };
      }

      const analysis = this.analyzeMessage(message, { tier: licenseData.tier });

      // Check if user can perform requested action
      if (!await this.license.canPerformAction(licenseData, analysis.primaryIntent)) {
        return {
          success: false,
          error: 'This feature is not available with your current license tier.',
          error_code: 'feature_not_available',
          currentTier: licenseData.tier,
          upgradeUrl: 'https://lunaos.ai/upgrade'
        };
      }

      const response = await this.routeMessage(analysis, { tier: licenseData.tier, id: licenseData.licenseKey, dailyUsage: 0, licenseData }, message);

      return {
        success: true,
        data: {
          response,
          user: { tier: licenseData.tier, id: licenseData.licenseKey, licenseData },
          suggestions: this.generateSuggestions(analysis, { tier: licenseData.tier }),
          sessionId: sessionId || this.generateSessionId()
        }
      };
    } catch (error) {
      console.error('RAG Query error:', error);
      return {
        success: false,
        error: 'I apologize, but I encountered an error. Please try again or contact support.',
        error_code: 'query_error'
      };
    }
  }

  /**
   * Analyze user message to determine intent and needs
   */
  analyzeMessage(message, user) {
    try {
      const lowerMessage = message.toLowerCase();

      // Detect intent
      const intents = {
        search: this.isSearchQuery(lowerMessage),
        upgrade: this.isUpgradeQuery(lowerMessage),
        status: this.isStatusQuery(lowerMessage),
        vision: this.isVisionQuery(lowerMessage),
        patterns: this.isPatternsQuery(lowerMessage),
        compare: this.isCompareQuery(lowerMessage),
        pricing: this.isPricingQuery(lowerMessage),
        enterprise: this.isEnterpriseQuery(lowerMessage),
        help: this.isHelpQuery(lowerMessage)
      };

      // Determine primary intent (highest priority)
      const primaryIntent = this.getPrimaryIntent(intents);

      // Determine complexity
      const complexity = this.analyzeComplexity(message);

      return {
        intents,
        primaryIntent,
        complexity,
        isSearchQuery: intents.search || intents.patterns || intents.compare,
        isPremiumFeature: intents.vision || (complexity && complexity.level === 'high'),
        requiresUpgrade: this.checkIfRequiresUpgrade(intents, user, complexity),
        message: message.trim()
      };
    } catch (error) {
      console.error('Message analysis error:', error);
      // Fallback to search intent if analysis fails
      return {
        intents: { search: true },
        primaryIntent: 'search',
        complexity: { level: 'medium', indicators: [] },
        isSearchQuery: true,
        isPremiumFeature: false,
        requiresUpgrade: false,
        message: message.trim()
      };
    }
  }

  /**
   * Route message to appropriate response handler
   */
  async routeMessage(analysis, user, originalMessage) {
    const { intents, requiresUpgrade } = analysis;

    // Handle upgrade flows
    if (requiresUpgrade) {
      return await this.handleUpgradeFlow(intents, user, analysis);
    }

    // Handle different intents
    switch (analysis.primaryIntent) {
      case 'upgrade':
        return await this.handleUpgradeRequest(user);
      case 'status':
        return await this.handleStatusRequest(user);
      case 'pricing':
        return await this.handlePricingRequest(user);
      case 'enterprise':
        return await this.handleEnterpriseRequest(user);
      case 'vision':
        if (user.tier === 'pro') {
          return await this.handleVisionRequest(user, originalMessage);
        } else {
          return await this.handleUpgradeFlow({ vision: true }, user, analysis);
        }
      case 'help':
        return await this.handleHelpRequest(user);
      default:
        return await this.handleSearchRequest(user, originalMessage, analysis);
    }
  }

  /**
   * Handle upgrade flow for users hitting limits or wanting premium features
   */
  async handleUpgradeFlow(intents, user, analysis) {
    if (user.tier === 'free') {
      const usage = await this.db.getUserUsage(user.id);
      const tierConfig = config.tiers.free;

      if (usage.searches >= tierConfig.searchesPerDay) {
        return {
          type: 'usage_limit',
          message: `⚠️ Daily Limit Reached\n\nYou've used all ${tierConfig.searchesPerDay} free searches for today! 🎯\n\n🚀 Upgrade to Luna RAG Pro for:\n• Unlimited searches (no limits!)\n• Luna Vision RAG™ (screenshot analysis)\n• GLM Vision (advanced visual AI)\n• Priority support\n\n💎 Limited Time: 14-day FREE trial\n\n⏰ Resets in: ${this.getTimeUntilReset()}\n\nReady to continue your search immediately?`,
          actions: [
            { text: '🚀 Start 14-day FREE trial', command: 'start_upgrade' },
            { text: 'Learn about Pro features', command: 'show_pricing' },
            { text: 'Wait for reset', command: 'show_reset_time' }
          ],
          userTier: user.tier,
          usageStats: {
            current: usage.searches,
            limit: tierConfig.searchesPerDay,
            resetsIn: this.getTimeUntilReset()
          }
        };
      }
    }

    if (analysis.isPremiumFeature && user.tier === 'free') {
      return {
        type: 'premium_feature',
        message: `🖼️ ${intents.vision ? 'Luna Vision RAG™' : 'Premium Feature'} - Pro Tier\n\nWow! That's an advanced ${intents.vision ? 'screenshot analysis' : 'feature'} you want to try!\n\n🎁 Try it FREE (watermarked preview):\n✅ Basic analysis (limited)\n✅ Pattern recognition (sample)\n✅ Quick insights\n\n💎 Unlock FULL Pro Features:\n✅ Complete ${intents.vision ? 'screenshot analysis' : 'feature set'}\n✅ Unlimited visual AI processing\n✅ Advanced code-to-visual mapping\n✅ GLM Vision integration\n\n🚀 Start your 14-day FREE trial:\n\nReady to see the full analysis?`,
        actions: [
          { text: '🚀 Try Pro FREE for 14 days', command: 'start_vision_trial' },
          { text: 'See sample analysis', command: 'show_sample' },
          { text: 'Learn more about Vision AI', command: 'show_vision_info' }
        ]
      };
    }

    return await this.handleSearchRequest(user, analysis.message, analysis);
  }

  /**
   * Handle upgrade request
   */
  async handleUpgradeRequest(user) {
    return {
      type: 'upgrade_info',
      message: `🚀 Upgrade to Luna RAG Pro\n\n🎯 Unlock Everything:\n✅ Unlimited semantic searches (no daily limits)\n✅ Unlimited file indexing (no size limits)\n✅ Luna Vision RAG™ - Screenshot analysis with code context\n✅ GLM Vision - Advanced visual AI testing\n✅ Priority support (24hr response time)\n✅ Advanced analytics dashboard\n✅ API access for integrations\n\n💳 Pricing: $29/month\n🎁 14-day FREE trial - Cancel anytime\n\n📧 Quick Setup:\n1. Enter your email\n2. Choose payment method\n3. Get instant API key\n\nReady to upgrade?`,
      actions: [
        { text: '🚀 Start FREE trial', command: 'start_upgrade' },
        { text: '📊 Compare plans', command: 'show_pricing' },
        { text: '❓ Have questions?', command: 'show_faq' }
      ]
    };
  }

  /**
   * Handle status request
   */
  async handleStatusRequest(user) {
    const userTier = user?.tier || 'free';
    const tier = config.tiers[userTier];

    if (userTier === 'free') {
      return {
        type: 'status',
        message: `📊 Luna RAG Account Status\n\n👤 Plan: Free Tier\n📈 Usage Today:\n• Searches: 0/${tier.searchesPerDay}\n• Files Indexed: 0/${tier.maxFiles}\n• Vision AI: Not available\n\n⏰ Resets in: ${this.getTimeUntilReset()}\n\n💡 Upgrade for unlimited usage:`,
        actions: [
          { text: '🚀 Upgrade to Pro', command: 'start_upgrade' },
          { text: '📊 View full stats', command: 'show_detailed_stats' },
          { text: '🔧 Manage account', command: 'show_account_settings' }
        ]
      };
    } else {
      return {
        type: 'status',
        message: `📊 Luna RAG Account Status\n\n👤 Plan: Pro Tier\n📅 Member Since: Today\n💰 Billing: $29/month (Next: ${this.getNextBillingDate()})\n\n📈 Usage This Month:\n• Searches: 0 (unlimited)\n• Files Indexed: 0 (unlimited)\n• Vision AI: 0 analyses\n• GLM Vision: 0 analyses\n\n🚀 Premium Features Active: ✅ All features unlocked`,
        actions: [
          { text: '📊 View analytics', command: 'show_analytics' },
          { text: '💳 Manage billing', command: 'manage_billing' },
          { text: '🎯 Support', command: 'contact_support' }
        ]
      };
    }
  }

  /**
   * Handle pricing request
   */
  async handlePricingRequest(user) {
    return {
      type: 'pricing',
      message: `🎯 Luna RAG Pricing Plans\n\n🆓 FREE TIER - $0/month\n✅ 100 searches per day\n✅ 1,000 files indexed\n✅ Basic semantic search\n✅ Community support\n✅ Local development\n\n💎 PRO TIER - $29/month\n🚀 Everything in Free, plus:\n✅ Unlimited searches\n✅ Unlimited indexing\n✅ Luna Vision RAG™ (screenshot analysis)\n✅ GLM Vision (advanced visual AI)\n✅ Priority support (24hr response)\n✅ Advanced analytics dashboard\n✅ API access for integrations\n🎁 14-day FREE trial\n\n🏢 ENTERPRISE - Custom Pricing\n🚀 Everything in Pro, plus:\n✅ Team collaboration (10+ seats)\n✅ SSO integration (SAML, LDAP)\n✅ Dedicated support (SLA)\n✅ Custom AI model training\n✅ On-premise deployment\n\n🚀 Get Started:`,
      actions: [
        { text: '🚀 Start Pro trial', command: 'start_upgrade' },
        { text: '🏢 Get enterprise quote', command: 'request_enterprise' },
        { text: '📚 View detailed comparison', command: 'show_comparison' }
      ]
    };
  }

  /**
   * Handle search request
   */
  async handleSearchRequest(user, message, analysis) {
    // Simulate search results (in real implementation, this would connect to your search service)
    const mockResults = this.generateMockSearchResults(message, analysis);

    return {
      type: 'search_results',
      message: `🔍 Search Results\n\nFound ${mockResults.count} relevant items for your query:\n\n${mockResults.summary}`,
      results: mockResults.items,
      analysis: mockResults.analysis,
      actions: [
        { text: '🔍 Search deeper', command: 'deepen_search' },
        { text: '📋 Find similar patterns', command: 'find_patterns' },
        { text: '⚡ Analyze architecture', command: 'analyze_architecture' }
      ],
      usage: {
        current: 1,
        limit: (user?.tier || 'free') === 'free' ? config.tiers.free.searchesPerDay : 'unlimited'
      }
    };
  }

  /**
   * Handle vision request (Pro users only)
   */
  async handleVisionRequest(user, message) {
    return {
      type: 'vision_analysis',
      message: `🖼️ Luna Vision RAG™ Analysis\n\n✅ Pro feature detected! Ready to analyze your visual content.\n\nPlease upload your screenshot or image, and I'll provide:\n• Visual-to-code mapping\n• Design pattern recognition\n• UI compliance checking\n• Implementation suggestions\n\n📎 Upload an image or describe what you'd like to analyze:`,
      actions: [
        { text: '📤 Upload screenshot', command: 'upload_image' },
        { text: '🎨 Analyze design patterns', command: 'analyze_design' },
        { text: '🧪 Run UI tests', command: 'test_ui' },
        { text: '📖 Learn Vision RAG features', command: 'vision_help' }
      ]
    };
  }

  /**
   * Handle help request
   */
  async handleHelpRequest(user) {
    return {
      type: 'help',
      message: `🌙 Welcome to Luna RAG!\n\n${user.tier === 'free' ?
        `🎁 Your Free Starter Kit:\n✅ 100 searches per day\n✅ 1,000 files indexed\n✅ Basic semantic search\n✅ Community support\n\n` :
        `💎 Pro Features Active:\n✅ Unlimited searches\n✅ Luna Vision RAG™\n✅ GLM Vision\n✅ Priority support\n\n`
      }🚀 Try asking me about your codebase:\n• "How does authentication work here?"\n• "Find similar implementations to user profiles"\n• "What are the error handling patterns?"\n• "Compare these two approaches"\n${user.tier === 'free' ? '\n🖼️ Try "analyze this screenshot" to see Vision RAG™ in action!' : '\n🖼️ Upload screenshots for visual AI analysis!'}`,
      actions: [
        { text: '🔍 Try code search', command: 'start_search' },
        { text: '📋 Find patterns', command: 'find_patterns' },
        { text: '🎯 View examples', command: 'show_examples' },
        ...(user.tier === 'free' ? [{ text: '🚀 Upgrade to Pro', command: 'start_upgrade' }] : [])
      ]
    };
  }

  /**
   * Start upgrade process
   */
  async startUpgradeProcess(email, userId = null) {
    try {
      // Generate checkout URL
      const checkoutUrl = await this.ls.createProCheckout(email, userId);

      return {
        success: true,
        checkoutUrl,
        message: `✅ Email set: ${email}\n\n💳 Opening secure checkout...\n🎁 Your 14-day FREE trial includes:\n• Unlimited searches immediately\n• Luna Vision RAG™ screenshot analysis\n• GLM Vision advanced testing\n• Priority support\n\n💰 Pricing: $0.00 today, then $29/month\n🔒 Secure payment via LemonSqueezy (PCI compliant)\n\n⏳ Waiting for payment completion...`
      };
    } catch (error) {
      console.error('Upgrade process error:', error);
      return {
        success: false,
        error: 'Unable to start checkout process. Please try again or contact support.'
      };
    }
  }

  /**
   * Process webhook events from LemonSqueezy
   */
  async processWebhook(eventType, eventData) {
    try {
      switch (eventType) {
        case 'order_created':
          await this.handleOrderCreated(eventData);
          break;
        case 'subscription_created':
          await this.handleSubscriptionCreated(eventData);
          break;
        case 'subscription_payment_success':
          await this.handlePaymentSuccess(eventData);
          break;
        case 'subscription_cancelled':
          await this.handleSubscriptionCancelled(eventData);
          break;
        default:
          console.log('Unhandled webhook event:', eventType);
      }

      return { success: true };
    } catch (error) {
      console.error('Webhook processing error:', error);
      return { success: false, error: 'Webhook processing failed' };
    }
  }

  /**
   * Handle subscription created event
   */
  async handleSubscriptionCreated(eventData) {
    const customerEmail = eventData.attributes?.customer_email;
    const subscriptionId = eventData.id;

    if (!customerEmail) {
      console.error('No customer email in subscription created event');
      return;
    }

    // Update user to Pro tier
    const user = await this.db.getUserByEmail(customerEmail);
    if (user) {
      const apiKey = await this.auth.generateApiKey(user.user_id);

      await this.db.updateUser(user.id, {
        tier: 'pro',
        subscription_id: subscriptionId,
        subscription_status: 'active',
        trial_started_at: new Date().toISOString(),
        api_key: apiKey
      });

      // Send welcome email
      await this.email.sendWelcomeEmail(customerEmail, apiKey, 'pro');
    }

    console.log(`Subscription activated for ${customerEmail}`);
  }

  /**
   * Handle payment success event
   */
  async handlePaymentSuccess(eventData) {
    const customerEmail = eventData.attributes?.customer_email;

    if (customerEmail) {
      await this.email.sendPaymentSuccessEmail(customerEmail, eventData);
    }

    console.log(`Payment successful for ${customerEmail}`);
  }

  /**
   * Handle subscription cancelled event
   */
  async handleSubscriptionCancelled(eventData) {
    const customerEmail = eventData.attributes?.customer_email;

    if (customerEmail) {
      await this.db.updateUserByEmail(customerEmail, {
        subscription_status: 'cancelled',
        cancelled_at: new Date().toISOString()
      });

      await this.email.sendCancellationEmail(customerEmail, new Date());
    }

    console.log(`Subscription cancelled for ${customerEmail}`);
  }

  // Helper methods
  getPrimaryIntent(intents) {
    const intentPriority = [
      'enterprise', 'upgrade', 'pricing', 'status', 'vision',
      'help', 'patterns', 'compare', 'search'
    ];

    for (const intent of intentPriority) {
      if (intents[intent]) return intent;
    }

    return 'search';
  }

  isSearchQuery(message) {
    const searchKeywords = [
      'how', 'what', 'where', 'find', 'search', 'look for', 'show me',
      'explain', 'analyze', 'understand', 'pattern', 'implementation'
    ];
    return searchKeywords.some(keyword => message.includes(keyword));
  }

  isUpgradeQuery(message) {
    const upgradeKeywords = [
      'upgrade', 'pro', 'premium', 'trial', 'paid', 'buy', 'purchase',
      'pricing', 'cost', 'price', 'plan', 'subscription'
    ];
    return upgradeKeywords.some(keyword => message.includes(keyword));
  }

  isStatusQuery(message) {
    const statusKeywords = [
      'status', 'usage', 'current', 'account', 'profile', 'stats',
      'statistics', 'how many', 'remaining', 'limit'
    ];
    return statusKeywords.some(keyword => message.includes(keyword));
  }

  isVisionQuery(message) {
    const visionKeywords = [
      'screenshot', 'image', 'picture', 'vision', 'visual', 'ui', 'design',
      'mockup', 'prototype', 'analyze this', 'look at this'
    ];
    return visionKeywords.some(keyword => message.includes(keyword));
  }

  isPatternsQuery(message) {
    const patternKeywords = [
      'patterns', 'pattern', 'best practice', 'convention', 'standard',
      'architecture', 'structure', 'design', 'template'
    ];
    return patternKeywords.some(keyword => message.includes(keyword));
  }

  isCompareQuery(message) {
    const compareKeywords = [
      'compare', 'versus', 'vs', 'difference', 'better', 'which is',
      'alternative', 'option', 'choice'
    ];
    return compareKeywords.some(keyword => message.includes(keyword));
  }

  isPricingQuery(message) {
    const pricingKeywords = [
      'pricing', 'price', 'cost', 'how much', 'plans', 'tiers',
      'subscription', 'billing', 'payment'
    ];
    return pricingKeywords.some(keyword => message.includes(keyword));
  }

  isEnterpriseQuery(message) {
    const enterpriseKeywords = [
      'enterprise', 'team', 'company', 'organization', 'business',
      'corporate', 'sso', 'multiple users', 'volume'
    ];
    return enterpriseKeywords.some(keyword => message.includes(keyword));
  }

  isHelpQuery(message) {
    const helpKeywords = [
      'help', 'how to', 'getting started', 'tutorial', 'guide',
      'examples', 'what can you do', 'features', 'commands'
    ];
    return helpKeywords.some(keyword => message.includes(keyword));
  }

  analyzeComplexity(message) {
    const complexityIndicators = {
      high: ['architecture', 'comprehensive', 'detailed', 'thorough', 'in-depth', 'complete'],
      medium: ['pattern', 'implementation', 'example', 'similar', 'compare'],
      low: ['simple', 'basic', 'quick', 'overview', 'summary']
    };

    for (const [level, indicators] of Object.entries(complexityIndicators)) {
      if (indicators.some(indicator => message.includes(indicator))) {
        return { level, indicators: indicators.filter(i => message.includes(i)) };
      }
    }

    return { level: 'medium', indicators: [] };
  }

  checkIfRequiresUpgrade(intents, user, analysis) {
    const userTier = user?.tier || 'free';

    // Free users hitting limits
    if (userTier === 'free') {
      // This would be checked in real-time, but for now we'll assume users might be close to limits
      if (intents.search || intents.patterns) {
        return Math.random() < 0.1; // 10% chance to show upgrade prompt
      }
    }

    // Premium features require upgrade
    if (analysis.isPremiumFeature && userTier === 'free') {
      return true;
    }

    // High complexity queries for free users
    if (analysis.complexity.level === 'high' && userTier === 'free') {
      return true;
    }

    return false;
  }

  generateSuggestions(analysis, user) {
    const suggestions = [];
    const userTier = user?.tier || 'free';

    if (userTier === 'free') {
      suggestions.push({
        type: 'upgrade',
        text: '🚀 Upgrade to Pro for unlimited searches and Vision AI!',
        action: 'start_upgrade'
      });
    }

    if (analysis.intents.vision && userTier === 'free') {
      suggestions.push({
        type: 'vision_trial',
        text: '🖼️ Try Luna Vision RAG™ FREE with a 14-day trial!',
        action: 'start_vision_trial'
      });
    }

    return suggestions;
  }

  generateMockSearchResults(message, analysis) {
    // This would connect to your actual search service
    return {
      count: Math.floor(Math.random() * 50) + 10,
      summary: `📋 Found ${analysis.intents.patterns ? 'design patterns' : 'relevant code'} related to your query.`,
      items: [
        { file: 'src/auth/auth.service.js', type: 'Authentication', summary: 'JWT token validation and user authentication' },
        { file: 'src/database/connection.js', type: 'Database', summary: 'PostgreSQL connection with connection pooling' },
        { file: 'src/utils/error-handler.js', type: 'Error Handling', summary: 'Centralized error handling middleware' }
      ],
      analysis: {
        complexity: analysis.complexity.level,
        estimatedTime: '~2 minutes for detailed analysis',
        relatedPatterns: ['authentication', 'error-handling', 'database-patterns']
      }
    };
  }

  getTimeUntilReset() {
    // Calculate until next day midnight UTC
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);

    const diff = tomorrow - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  }

  getNextBillingDate() {
    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth.toLocaleDateString();
  }

  sanitizeUser(user) {
    const { id, email, tier, created_at, subscription_status } = user;
    return { id, email, tier, created_at, subscription_status };
  }

  estimateTokens(text) {
    // Rough estimation: ~4 characters per token
    return Math.ceil(JSON.stringify(text).length / 4);
  }

  generateSessionId() {
    return crypto.randomUUID();
  }

  /**
   * Validate license
   */
  async validateLicense(licenseKey, userId) {
    // If no license key provided, return invalid
    if (!licenseKey) {
      return {
        valid: false,
        error: 'No license key provided',
        requiresActivation: true
      };
    }

    // Validate against license service
    return await this.license.validateLicense(licenseKey, userId, 'localhost');
  }
}

export default RAGController;