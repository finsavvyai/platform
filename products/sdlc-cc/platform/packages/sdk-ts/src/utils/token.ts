// Token utilities for the SDLC.ai JavaScript SDK

export class TokenUtils {
  /**
   * Parse JWT token (without verification)
   */
  static parseJWT(token: string): Record<string, unknown> {
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) throw new Error('Invalid JWT token');
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      throw new Error('Invalid JWT token');
    }
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token: string, bufferSeconds: number = 30): boolean {
    try {
      const payload = this.parseJWT(token);
      const exp = typeof payload.exp === 'number' ? payload.exp : 0;
      return exp <= Date.now() / 1000 + bufferSeconds;
    } catch {
      return true;
    }
  }

  /**
   * Get time until token expires
   */
  static getTokenTTL(token: string): number {
    try {
      const payload = this.parseJWT(token);
      const exp = typeof payload.exp === 'number' ? payload.exp : 0;
      return Math.max(0, exp * 1000 - Date.now());
    } catch {
      return 0;
    }
  }
}
