// Network utilities for the SDLC.ai JavaScript SDK

export class NetworkUtils {
  /**
   * Exponential backoff for retries
   */
  static async backoff(
    attempt: number,
    baseDelay: number = 1000,
    maxDelay: number = 30000,
    jitter: boolean = true
  ): Promise<void> {
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    const finalDelay = jitter ? delay * (0.5 + Math.random() * 0.5) : delay;

    await new Promise(resolve => setTimeout(resolve, finalDelay));
  }

  /**
   * Parse retry-after header
   */
  static parseRetryAfter(header?: string): number | null {
    if (!header) return null;

    // Try to parse as integer (seconds)
    const seconds = parseInt(header, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }

    // Try to parse as HTTP date
    const date = new Date(header);
    if (!isNaN(date.getTime())) {
      return date.getTime() - Date.now();
    }

    return null;
  }

  /**
   * Check if error is retryable
   */
  static isRetryableError(error: unknown): boolean {
    // Network errors are generally retryable
    const err = error as { code?: string; statusCode?: number };
    if (err.code === 'ECONNRESET' ||
        err.code === 'ECONNABORTED' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'ENOTFOUND') {
      return true;
    }

    // HTTP status codes that are retryable
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    if (err.statusCode && retryableStatusCodes.includes(err.statusCode)) {
      return true;
    }

    return false;
  }

  /**
   * Get public IP address
   */
  static async getPublicIP(): Promise<string | null> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return null;
    }
  }
}
