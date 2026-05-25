import { v4 as uuidv4 } from 'uuid';
/**
 * Session Management for Analytics
 *
 * Handles user session tracking, GDPR compliance, and session persistence
 * across the enterprise platform.
 */
export class SessionManager {
    config;
    gdpr;
    currentSession = null;
    storageKey = 'sdlc_analytics_session';
    constructor(config, gdpr) {
        this.config = config;
        this.gdpr = gdpr;
    }
    /**
     * Get or create current session
     */
    async getSession() {
        if (this.currentSession) {
            return this.currentSession;
        }
        // Try to restore existing session
        this.currentSession = await this.restoreSession();
        if (!this.currentSession || this.isSessionExpired(this.currentSession)) {
            // Create new session
            this.currentSession = await this.createSession();
        }
        await this.saveSession();
        return this.currentSession;
    }
    /**
     * Create a new analytics session
     */
    async createSession() {
        const now = Date.now();
        // Detect user info (if GDPR allows)
        const userInfo = this.gdpr.enabled ? await this.detectUserInfo() : {};
        const session = {
            id: uuidv4(),
            startTime: now,
            pageViews: 0,
            events: 0,
            bounceRate: 1.0, // Will be updated based on activity
            ...userInfo
        };
        // Track session start event
        await this.trackSessionStart(session);
        return session;
    }
    /**
     * Restore session from storage
     */
    async restoreSession() {
        if (typeof localStorage === 'undefined' || this.gdpr.doNotTrack) {
            return null;
        }
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (!stored)
                return null;
            const session = JSON.parse(stored);
            // Validate session integrity
            if (!this.isValidSession(session)) {
                return null;
            }
            return session;
        }
        catch (error) {
            console.warn('Failed to restore analytics session:', error);
            return null;
        }
    }
    /**
     * Save session to storage
     */
    async saveSession() {
        if (!this.currentSession || typeof localStorage === 'undefined') {
            return;
        }
        // Only save if not in do-not-track mode
        if (this.gdpr.doNotTrack) {
            return;
        }
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.currentSession));
        }
        catch (error) {
            console.warn('Failed to save analytics session:', error);
        }
    }
    /**
     * Check if session has expired
     */
    isSessionExpired(session) {
        const maxSessionDuration = 30 * 60 * 1000; // 30 minutes
        const maxInactiveDuration = 5 * 60 * 1000; // 5 minutes
        const now = Date.now();
        const sessionAge = now - session.startTime;
        const lastActivity = session.endTime || session.startTime;
        const inactiveTime = now - lastActivity;
        return sessionAge > maxSessionDuration || inactiveTime > maxInactiveDuration;
    }
    /**
     * Validate session structure
     */
    isValidSession(session) {
        return (session &&
            typeof session === 'object' &&
            typeof session.id === 'string' &&
            typeof session.startTime === 'number' &&
            typeof session.pageViews === 'number' &&
            typeof session.events === 'number');
    }
    /**
     * Detect user information (GDPR compliant)
     */
    async detectUserInfo() {
        if (typeof navigator === 'undefined') {
            return {};
        }
        const info = {};
        // Detect browser/device info (non-personally identifiable)
        try {
            const userAgent = navigator.userAgent;
            // Simple device detection
            if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
                info.device = 'mobile';
            }
            else {
                info.device = 'desktop';
            }
            // Simple browser detection
            if (userAgent.includes('Chrome'))
                info.browser = 'chrome';
            else if (userAgent.includes('Firefox'))
                info.browser = 'firefox';
            else if (userAgent.includes('Safari'))
                info.browser = 'safari';
            else if (userAgent.includes('Edge'))
                info.browser = 'edge';
            // IP anonymization (if needed)
            if (this.gdpr.anonymizeIP) {
                // IP will be anonymized at the collection level
            }
        }
        catch (error) {
            console.warn('Failed to detect user info:', error);
        }
        return info;
    }
    /**
     * Track session start event
     */
    async trackSessionStart(session) {
        // This would send a session_start event to the analytics service
        console.log('Session started:', {
            sessionId: session.id,
            device: session.device,
            browser: session.browser
        });
    }
    /**
     * Update session with new activity
     */
    async updateSession(activity) {
        const session = await this.getSession();
        if (activity.pageView) {
            session.pageViews++;
        }
        if (activity.event) {
            session.events++;
        }
        if (activity.userId && !session.userId) {
            session.userId = activity.userId;
        }
        // Update bounce rate (user is no longer bouncing if they have activity)
        if (session.pageViews > 1 || session.events > 1) {
            session.bounceRate = 0;
        }
        await this.saveSession();
    }
    /**
     * End current session
     */
    async endSession() {
        if (!this.currentSession) {
            return;
        }
        const now = Date.now();
        this.currentSession.endTime = now;
        this.currentSession.duration = now - this.currentSession.startTime;
        // Track session end event
        await this.trackSessionEnd(this.currentSession);
        // Clear session
        await this.saveSession();
        this.currentSession = null;
    }
    /**
     * Track session end event
     */
    async trackSessionEnd(session) {
        console.log('Session ended:', {
            sessionId: session.id,
            duration: session.duration,
            pageViews: session.pageViews,
            events: session.events,
            bounceRate: session.bounceRate
        });
    }
    /**
     * Get current session ID
     */
    async getSessionId() {
        const session = await this.getSession();
        return session.id;
    }
    /**
     * Get session metrics
     */
    async getSessionMetrics() {
        const session = await this.getSession();
        const now = Date.now();
        return {
            id: session.id,
            userId: session.userId,
            startTime: session.startTime,
            duration: now - session.startTime,
            pageViews: session.pageViews,
            events: session.events,
            bounceRate: session.bounceRate
        };
    }
    /**
     * Clear all analytics data (GDPR compliance)
     */
    async clearData() {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(this.storageKey);
        }
        this.currentSession = null;
    }
    /**
     * Update GDPR settings
     */
    updateGDPRSettings(gdpr) {
        this.gdpr = { ...this.gdpr, ...gdpr };
        // Clear data if do-not-track is enabled
        if (gdpr.doNotTrack) {
            this.clearData();
        }
    }
}
//# sourceMappingURL=session.js.map