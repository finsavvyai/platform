// Date utilities for the SDLC.ai JavaScript SDK

export class DateUtils {
  /**
   * Format date as ISO string with timezone
   */
  static toISOString(date: Date = new Date()): string {
    return date.toISOString();
  }

  /**
   * Parse date from various formats
   */
  static parse(date: string | number | Date): Date {
    if (date instanceof Date) return date;
    if (typeof date === 'number') return new Date(date);

    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Invalid date: ${date}`);
    }

    return parsed;
  }

  /**
   * Add time to date
   */
  static add(date: Date, amount: number, unit: 'ms' | 's' | 'm' | 'h' | 'd'): Date {
    const result = new Date(date);

    switch (unit) {
      case 'ms':
        result.setMilliseconds(result.getMilliseconds() + amount);
        break;
      case 's':
        result.setSeconds(result.getSeconds() + amount);
        break;
      case 'm':
        result.setMinutes(result.getMinutes() + amount);
        break;
      case 'h':
        result.setHours(result.getHours() + amount);
        break;
      case 'd':
        result.setDate(result.getDate() + amount);
        break;
    }

    return result;
  }

  /**
   * Check if date is expired
   */
  static isExpired(date: Date | string | number, bufferMs: number = 0): boolean {
    const expiry = this.parse(date);
    return Date.now() >= expiry.getTime() - bufferMs;
  }

  /**
   * Format duration in human-readable format
   */
  static formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}
