import { AnalyticsSession, AnalyticsConfig, GDPRConfig } from './types';
/**
 * Session Management for Analytics
 *
 * Handles user session tracking, GDPR compliance, and session persistence
 * across the enterprise platform.
 */
export declare class SessionManager {
    private config;
    private gdpr;
    private currentSession;
    private storageKey;
    constructor(config: AnalyticsConfig, gdpr: GDPRConfig);
    /**
     * Get or create current session
     */
    getSession(): Promise<AnalyticsSession>;
    /**
     * Create a new analytics session
     */
    private createSession;
    /**
     * Restore session from storage
     */
    private restoreSession;
    /**
     * Save session to storage
     */
    private saveSession;
    /**
     * Check if session has expired
     */
    private isSessionExpired;
    /**
     * Validate session structure
     */
    private isValidSession;
    /**
     * Detect user information (GDPR compliant)
     */
    private detectUserInfo;
    /**
     * Track session start event
     */
    private trackSessionStart;
    /**
     * Update session with new activity
     */
    updateSession(activity: {
        pageView?: boolean;
        event?: boolean;
        userId?: string;
    }): Promise<void>;
    /**
     * End current session
     */
    endSession(): Promise<void>;
    /**
     * Track session end event
     */
    private trackSessionEnd;
    /**
     * Get current session ID
     */
    getSessionId(): Promise<string>;
    /**
     * Get session metrics
     */
    getSessionMetrics(): Promise<Partial<AnalyticsSession>>;
    /**
     * Clear all analytics data (GDPR compliance)
     */
    clearData(): Promise<void>;
    /**
     * Update GDPR settings
     */
    updateGDPRSettings(gdpr: Partial<GDPRConfig>): void;
}
//# sourceMappingURL=session.d.ts.map