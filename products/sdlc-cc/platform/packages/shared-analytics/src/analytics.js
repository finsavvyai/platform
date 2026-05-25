import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';
import { SessionManager } from './session';
/**
 * Main Analytics Class
 *
 * Provides enterprise-grade analytics tracking capabilities with GDPR compliance
 * and Cloudflare integration for all products in the platform.
 */
export class Analytics {
    config;
    gdpr;
    sessionManager;
    provider = null;
    eventQueue = [];
    isInitialized = false;
    flushTimer = null;
    constructor(config, gdpr) {
        this.config = config;
        this.gdpr = gdpr;
        this.sessionManager = new SessionManager(config, gdpr);
    }
    /**
     * Initialize analytics with specified provider
     */
    async initialize(provider) {
        if (this.isInitialized) {
            return;
        }
        try {
            // Use provided provider or create default Cloudflare provider
            this.provider = provider || await this.createDefaultProvider();
            if (this.provider) {
                await this.provider.initialize(this.config);
            }
            this.setupAutoFlush();
            this.isInitialized = true;
            // Track initialization event
            await this.track('feature_usage', {
                action: 'analytics_initialized',
                config: {
                    productId: this.config.productId,
                    version: this.config.version,
                    environment: this.config.environment
                }
            });
            if (this.config.enableDebug) {
                console.log('Analytics initialized:', this.config.productId);
            }
        }
        catch (error) {
            console.error('Failed to initialize analytics:', error);
            throw error;
        }
    }
    /**
     * Create default Cloudflare analytics provider
     */
    async createDefaultProvider() {
        try {
            // Check if we're in Cloudflare environment
            if (typeof globalThis !== 'undefined' && 'Cloudflare' in globalThis) {
                const { CloudflareProvider } = await import('./providers/cloudflare');
                return new CloudflareProvider();
            }
            // Fallback to memory provider for development
            const { MemoryProvider } = await import('./providers/memory');
            return new MemoryProvider();
        }
        catch (error) {
            console.warn('Failed to create analytics provider:', error);
            return null;
        }
    }
    /**
     * Setup automatic event flushing
     */
    setupAutoFlush() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        this.flushTimer = setInterval(() => {
            this.flush();
        }, this.config.flushInterval);
    }
    /**
     * Track a custom event
     */
    async track(eventType, data, userId) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        try {
            // Check GDPR compliance
            if (!this.shouldTrack(eventType, data)) {
                return;
            }
            // Update session
            await this.sessionManager.updateSession({
                event: true,
                userId
            });
            // Create event
            const event = await this.createEvent(eventType, data, userId);
            // Apply sampling
            if (this.shouldSample()) {
                await this.addEventToQueue(event);
            }
        }
        catch (error) {
            console.error('Failed to track event:', error);
        }
    }
    /**
     * Track page view
     */
    async trackPageView(path, title) {
        await this.track('page_view', {
            path,
            title,
            referrer: typeof document !== 'undefined' ? document.referrer : undefined,
            loadTime: this.getLoadTime()
        });
    }
    /**
     * Track user action
     */
    async trackUserAction(action, target, value, context) {
        await this.track('user_action', {
            action,
            target,
            value,
            context
        });
    }
    /**
     * Track form submission
     */
    async trackFormSubmit(formName, fields, success, duration, errors) {
        await this.track('form_submit', {
            formName,
            fields: this.sanitizeFields(fields),
            success,
            duration,
            errors
        });
    }
    /**
     * Track API call
     */
    async trackApiCall(endpoint, method, statusCode, duration, requestSize, responseSize) {
        await this.track('api_call', {
            endpoint,
            method,
            statusCode,
            duration,
            requestSize,
            responseSize
        });
    }
    /**
     * Track error
     */
    async trackError(error, context, severity = 'medium') {
        const errorInfo = typeof error === 'string' ? { error } : {
            error: error.message,
            stack: error.stack
        };
        await this.track('error', {
            ...errorInfo,
            context,
            severity
        });
    }
    /**
     * Track performance metric
     */
    async trackPerformance(metric, value, unit = 'ms', context) {
        await this.track('performance', {
            metric,
            value,
            unit,
            context
        });
    }
    /**
     * Track conversion event
     */
    async trackConversion(type, value, currency, context) {
        await this.track('conversion', {
            type,
            value,
            currency,
            context
        });
    }
    /**
     * Track feature usage
     */
    async trackFeatureUsage(feature, action, parameters) {
        await this.track('feature_usage', {
            feature,
            action,
            parameters
        });
    }
    /**
     * Create analytics event
     */
    async createEvent(eventType, data, userId) {
        const sessionId = await this.sessionManager.getSessionId();
        const metadata = {
            productId: this.config.productId,
            version: this.config.version,
            environment: this.config.environment,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
            ipAddress: undefined, // Will be set by provider
            referrer: typeof document !== 'undefined' ? document.referrer : undefined,
            url: typeof window !== 'undefined' ? window.location.href : undefined,
            platform: this.detectPlatform()
        };
        return {
            id: uuidv4(),
            type: eventType,
            userId: this.gdpr.enabled ? this.hashUserId(userId) : userId,
            sessionId,
            timestamp: Date.now(),
            data,
            metadata
        };
    }
    /**
     * Detect platform type
     */
    detectPlatform() {
        if (typeof window !== 'undefined') {
            return 'web';
        }
        else if (typeof globalThis !== 'undefined' && 'DurableObject' in globalThis) {
            return 'worker';
        }
        else if (typeof global !== 'undefined') {
            return 'api';
        }
        return 'web';
    }
    /**
     * Get page load time
     */
    getLoadTime() {
        if (typeof performance !== 'undefined' && performance.timing) {
            return performance.timing.loadEventEnd - performance.timing.navigationStart;
        }
        return undefined;
    }
    /**
     * Sanitize form fields for GDPR compliance
     */
    sanitizeFields(fields) {
        if (!this.gdpr.enabled) {
            return fields;
        }
        const sanitized = {};
        const sensitiveFields = ['password', 'ssn', 'creditcard', 'email', 'phone'];
        for (const [key, value] of Object.entries(fields)) {
            const lowerKey = key.toLowerCase();
            const isSensitive = sensitiveFields.some(field => lowerKey.includes(field));
            if (isSensitive) {
                sanitized[key] = '[REDACTED]';
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
    /**
     * Hash user ID for GDPR compliance
     */
    hashUserId(userId) {
        if (!userId || !this.gdpr.enabled) {
            return userId;
        }
        try {
            return CryptoJS.SHA256(userId + this.config.productId).toString();
        }
        catch (error) {
            console.warn('Failed to hash user ID:', error);
            return undefined;
        }
    }
    /**
     * Check if event should be tracked based on GDPR settings
     */
    shouldTrack(eventType, data) {
        // Check if tracking is disabled
        if (this.gdpr.doNotTrack) {
            return false;
        }
        // Check consent requirements
        if (this.gdpr.consentRequired && !this.hasUserConsent()) {
            return false;
        }
        // Check regional restrictions
        if (this.gdpr.regionalRestrictions.length > 0) {
            // Implement regional checking logic here
        }
        return true;
    }
    /**
     * Check if user has given consent
     */
    hasUserConsent() {
        if (typeof localStorage === 'undefined') {
            return true; // Default to true for server-side
        }
        const consent = localStorage.getItem('sdlc_analytics_consent');
        return consent === 'granted';
    }
    /**
     * Check if event should be sampled
     */
    shouldSample() {
        if (!this.config.enableSampling) {
            return true;
        }
        return Math.random() < this.config.samplingRate;
    }
    /**
     * Add event to queue
     */
    async addEventToQueue(event) {
        this.eventQueue.push(event);
        // Flush if batch size reached
        if (this.eventQueue.length >= this.config.batchSize) {
            await this.flush();
        }
    }
    /**
     * Flush events to provider
     */
    async flush() {
        if (this.eventQueue.length === 0 || !this.provider) {
            return;
        }
        try {
            const events = [...this.eventQueue];
            this.eventQueue = [];
            // Send events to provider
            for (const event of events) {
                await this.provider.track(event);
            }
            if (this.config.enableDebug) {
                console.log(`Flushed ${events.length} analytics events`);
            }
        }
        catch (error) {
            console.error('Failed to flush analytics events:', error);
            // Re-queue events on failure
            this.eventQueue.unshift(...this.eventQueue);
        }
    }
    /**
     * Get analytics metrics
     */
    async getMetrics(filters) {
        if (!this.provider) {
            throw new Error('Analytics provider not initialized');
        }
        const query = {
            filters: filters || {},
            metrics: ['totalEvents', 'uniqueUsers', 'totalSessions'],
            dimensions: ['eventType', 'productId']
        };
        return await this.provider.getMetrics(query);
    }
    /**
     * Set user consent
     */
    setUserConsent(granted) {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('sdlc_analytics_consent', granted ? 'granted' : 'denied');
        }
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        // Restart auto-flush with new interval
        if (this.isInitialized) {
            this.setupAutoFlush();
        }
    }
    /**
     * Update GDPR settings
     */
    updateGDPRSettings(gdpr) {
        this.gdpr = { ...this.gdpr, ...gdpr };
        this.sessionManager.updateGDPRSettings(gdpr);
    }
    /**
     * Get current session
     */
    async getSession() {
        return await this.sessionManager.getSession();
    }
    /**
     * Destroy analytics instance
     */
    async destroy() {
        // Flush remaining events
        await this.flush();
        // Clear auto-flush timer
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        // End session
        await this.sessionManager.endSession();
        // Destroy provider
        if (this.provider) {
            await this.provider.destroy();
            this.provider = null;
        }
        this.isInitialized = false;
    }
}
// Export singleton instance creator
export function createAnalytics(config, gdpr) {
    const defaultGDPR = {
        enabled: true,
        consentRequired: false,
        anonymizeIP: true,
        dataRetentionDays: 365,
        cookiePolicy: 'strict',
        doNotTrack: false,
        regionalRestrictions: []
    };
    return new Analytics(config, { ...defaultGDPR, ...gdpr });
}
//# sourceMappingURL=analytics.js.map