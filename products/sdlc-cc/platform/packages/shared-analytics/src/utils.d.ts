import { AnalyticsEvent } from './core-types';
/**
 * Utility functions for analytics operations
 */
/**
 * Debounce function to limit frequent calls
 */
export declare function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void;
/**
 * Throttle function to limit call frequency
 */
export declare function throttle<T extends (...args: any[]) => any>(func: T, limit: number): (...args: Parameters<T>) => void;
/**
 * Generate unique ID for events
 */
export declare function generateId(): string;
/**
 * Check if value is a valid URL
 */
export declare function isValidUrl(value: string): boolean;
/**
 * Sanitize string for analytics
 */
export declare function sanitizeString(value: string): string;
/**
 * Extract domain from URL
 */
export declare function extractDomain(url: string): string;
/**
 * Check if user agent is a bot
 */
export declare function isBot(userAgent: string): boolean;
/**
 * Get device type from user agent
 */
export declare function getDeviceType(userAgent: string): 'mobile' | 'tablet' | 'desktop' | 'unknown';
/**
 * Get browser from user agent
 */
export declare function getBrowser(userAgent: string): string;
/**
 * Get operating system from user agent
 */
export declare function getOS(userAgent: string): string;
/**
 * Format bytes to human readable string
 */
export declare function formatBytes(bytes: number, decimals?: number): string;
/**
 * Format duration to human readable string
 */
export declare function formatDuration(ms: number): string;
/**
 * Get percentage change between two values
 */
export declare function getPercentageChange(oldValue: number, newValue: number): number;
/**
 * Group events by property
 */
export declare function groupEventsByProperty<T extends AnalyticsEvent>(events: T[], property: keyof T['data']): Record<string, number>;
/**
 * Filter events by date range
 */
export declare function filterEventsByDate<T extends AnalyticsEvent>(events: T[], startDate?: Date, endDate?: Date): T[];
/**
 * Calculate moving average
 */
export declare function movingAverage(values: number[], windowSize: number): number[];
/**
 * Generate color palette for charts
 */
export declare function generateColorPalette(count: number): string[];
/**
 * Validate analytics configuration
 */
export declare function validateConfig(config: any): {
    valid: boolean;
    errors: string[];
};
/**
 * Deep clone object
 */
export declare function deepClone<T>(obj: T): T;
//# sourceMappingURL=utils.d.ts.map