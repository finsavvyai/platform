/**
 * Utility functions for analytics operations
 */
/**
 * Debounce function to limit frequent calls
 */
export function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}
/**
 * Throttle function to limit call frequency
 */
export function throttle(func, limit) {
    let inThrottle;
    return (...args) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}
/**
 * Generate unique ID for events
 */
export function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
/**
 * Check if value is a valid URL
 */
export function isValidUrl(value) {
    try {
        new URL(value);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Sanitize string for analytics
 */
export function sanitizeString(value) {
    return value
        .replace(/[<>]/g, '') // Remove HTML tags
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
        .trim()
        .substring(0, 500); // Limit length
}
/**
 * Extract domain from URL
 */
export function extractDomain(url) {
    try {
        return new URL(url).hostname;
    }
    catch {
        return '';
    }
}
/**
 * Check if user agent is a bot
 */
export function isBot(userAgent) {
    const botPatterns = [
        /bot/i,
        /crawler/i,
        /spider/i,
        /scraper/i,
        /curl/i,
        /wget/i,
        /python/i,
        /java/i,
        /node/i,
        /go-http/i,
        /postman/i,
        /insomnia/i
    ];
    return botPatterns.some(pattern => pattern.test(userAgent));
}
/**
 * Get device type from user agent
 */
export function getDeviceType(userAgent) {
    const mobilePattern = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    const tabletPattern = /iPad|Android(?!.*Mobile)|Tablet/i;
    if (tabletPattern.test(userAgent)) {
        return 'tablet';
    }
    else if (mobilePattern.test(userAgent)) {
        return 'mobile';
    }
    else if (userAgent.length > 0) {
        return 'desktop';
    }
    return 'unknown';
}
/**
 * Get browser from user agent
 */
export function getBrowser(userAgent) {
    const browsers = [
        { name: 'Chrome', pattern: /Chrome\//i },
        { name: 'Firefox', pattern: /Firefox\//i },
        { name: 'Safari', pattern: /Safari\//i, exclude: /Chrome\//i },
        { name: 'Edge', pattern: /Edge\//i },
        { name: 'Opera', pattern: /OPR\//i },
        { name: 'IE', pattern: /MSIE|Trident\//i }
    ];
    for (const browser of browsers) {
        if (browser.pattern.test(userAgent)) {
            if ('exclude' in browser) {
                if (browser.exclude && !browser.exclude.test(userAgent)) {
                    return browser.name;
                }
            }
            else {
                return browser.name;
            }
        }
    }
    return 'Unknown';
}
/**
 * Get operating system from user agent
 */
export function getOS(userAgent) {
    const operatingSystems = [
        { name: 'Windows', pattern: /Windows NT/i },
        { name: 'macOS', pattern: /Mac OS X/i },
        { name: 'Linux', pattern: /Linux/i },
        { name: 'iOS', pattern: /iPhone|iPad|iPod/i },
        { name: 'Android', pattern: /Android/i },
        { name: 'Chrome OS', pattern: /CrOS/i }
    ];
    for (const os of operatingSystems) {
        if (os.pattern.test(userAgent)) {
            return os.name;
        }
    }
    return 'Unknown';
}
/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes, decimals = 2) {
    if (bytes === 0)
        return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
/**
 * Format duration to human readable string
 */
export function formatDuration(ms) {
    if (ms < 1000) {
        return `${ms}ms`;
    }
    else if (ms < 60000) {
        return `${(ms / 1000).toFixed(1)}s`;
    }
    else if (ms < 3600000) {
        return `${(ms / 60000).toFixed(1)}m`;
    }
    else {
        return `${(ms / 3600000).toFixed(1)}h`;
    }
}
/**
 * Get percentage change between two values
 */
export function getPercentageChange(oldValue, newValue) {
    if (oldValue === 0)
        return newValue > 0 ? 100 : 0;
    return ((newValue - oldValue) / oldValue) * 100;
}
/**
 * Group events by property
 */
export function groupEventsByProperty(events, property) {
    return events.reduce((groups, event) => {
        const key = String(event.data[property] || 'unknown');
        groups[key] = (groups[key] || 0) + 1;
        return groups;
    }, {});
}
/**
 * Filter events by date range
 */
export function filterEventsByDate(events, startDate, endDate) {
    return events.filter(event => {
        const eventDate = new Date(event.timestamp);
        if (startDate && eventDate < startDate)
            return false;
        if (endDate && eventDate > endDate)
            return false;
        return true;
    });
}
/**
 * Calculate moving average
 */
export function movingAverage(values, windowSize) {
    const result = [];
    for (let i = 0; i < values.length; i++) {
        const start = Math.max(0, i - windowSize + 1);
        const end = i + 1;
        const window = values.slice(start, end);
        const average = window.reduce((sum, val) => sum + val, 0) / window.length;
        result.push(average);
    }
    return result;
}
/**
 * Generate color palette for charts
 */
export function generateColorPalette(count) {
    const colors = [
        '#3b82f6', // blue
        '#10b981', // emerald
        '#f59e0b', // amber
        '#ef4444', // red
        '#8b5cf6', // violet
        '#ec4899', // pink
        '#06b6d4', // cyan
        '#84cc16', // lime
        '#f97316', // orange
        '#6366f1', // indigo
    ];
    const palette = [];
    for (let i = 0; i < count; i++) {
        palette.push(colors[i % colors.length]);
    }
    return palette;
}
/**
 * Validate analytics configuration
 */
export function validateConfig(config) {
    const errors = [];
    if (!config.productId || typeof config.productId !== 'string') {
        errors.push('productId is required and must be a string');
    }
    if (!config.version || typeof config.version !== 'string') {
        errors.push('version is required and must be a string');
    }
    if (!config.environment || !['development', 'staging', 'production'].includes(config.environment)) {
        errors.push('environment must be one of: development, staging, production');
    }
    if (config.batchSize && (typeof config.batchSize !== 'number' || config.batchSize < 1)) {
        errors.push('batchSize must be a positive number');
    }
    if (config.flushInterval && (typeof config.flushInterval !== 'number' || config.flushInterval < 1000)) {
        errors.push('flushInterval must be at least 1000ms');
    }
    if (config.samplingRate !== undefined && (typeof config.samplingRate !== 'number' || config.samplingRate < 0 || config.samplingRate > 1)) {
        errors.push('samplingRate must be a number between 0 and 1');
    }
    return {
        valid: errors.length === 0,
        errors
    };
}
/**
 * Deep clone object
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item));
    }
    const cloned = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }
    return cloned;
}
//# sourceMappingURL=utils.js.map