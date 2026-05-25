/**
 * Test Helpers Utility
 *
 * Collection of helper classes and functions to support E2E testing.
 * Includes API helpers, WebSocket helpers, database helpers, and SSO helpers.
 */

import { APIRequestContext, WebSocket, Page } from '@playwright/test';
import { generateTestUser, generateSSOTestData } from './test-data-generator';

/**
 * API Helper Class
 * Provides utility methods for making API calls in tests
 */
export class APIHelper {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseURL: string, defaultHeaders: Record<string, string> = {}) {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...defaultHeaders
    };
  }

  /**
   * Make a GET request
   */
  async get(request: APIRequestContext, endpoint: string, params?: Record<string, any>): Promise<any> {
    const url = new URL(endpoint, this.baseURL);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    const response = await request.get(url.toString(), {
      headers: this.defaultHeaders
    });

    return this.handleResponse(response);
  }

  /**
   * Make a POST request
   */
  async post(request: APIRequestContext, endpoint: string, data?: any): Promise<any> {
    const response = await request.post(`${this.baseURL}${endpoint}`, {
      headers: this.defaultHeaders,
      data: data ? JSON.stringify(data) : undefined
    });

    return this.handleResponse(response);
  }

  /**
   * Make a PUT request
   */
  async put(request: APIRequestContext, endpoint: string, data?: any): Promise<any> {
    const response = await request.put(`${this.baseURL}${endpoint}`, {
      headers: this.defaultHeaders,
      data: data ? JSON.stringify(data) : undefined
    });

    return this.handleResponse(response);
  }

  /**
   * Make a DELETE request
   */
  async delete(request: APIRequestContext, endpoint: string): Promise<any> {
    const response = await request.delete(`${this.baseURL}${endpoint}`, {
      headers: this.defaultHeaders
    });

    return this.handleResponse(response);
  }

  /**
   * Handle API response
   */
  private async handleResponse(response: any): Promise<any> {
    const contentType = response.headers()['content-type'];

    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }

    return await response.text();
  }

  /**
   * Authenticate user and get token
   */
  async authenticate(request: APIRequestContext, email: string, password: string): Promise<string> {
    const response = await this.post(request, '/api/auth/login', {
      email,
      password,
      rememberMe: false
    });

    if (response.success && response.tokens) {
      return response.tokens.accessToken;
    }

    throw new Error(`Authentication failed: ${response.error?.message || 'Unknown error'}`);
  }

  /**
   * Set up authenticated request context
   */
  async setupAuthenticatedRequest(request: APIRequestContext, token: string): Promise<void> {
    await request.addInitScript(() => {
      window.localStorage.setItem('auth_token', token);
    });
  }

  /**
   * Mock API endpoints
   */
  async mockEndpoint(page: Page, method: 'GET' | 'POST' | 'PUT' | 'DELETE', pattern: string, response: any, status: number = 200): Promise<void> {
    await page.route(`**${pattern}`, (route) => {
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(response)
      });
    });
  }

  /**
   * Mock streaming responses
   */
  async mockStreamingResponse(page: Page, pattern: string, chunks: string[]): Promise<void> {
    await page.route(`**${pattern}`, async (route) => {
      const response = await page.context.fetch(route.request());
      const headers = response.headers();

      route.fulfill({
        status: 200,
        headers: {
          ...headers,
          'Content-Type': 'text/plain',
          'Transfer-Encoding': 'chunked'
        },
        body: chunks.join('\n')
      });
    });
  }
}

/**
 * WebSocket Helper Class
 * Provides utility methods for WebSocket testing
 */
export class WebSocketHelper {
  private url: string;
  private connections: Map<string, WebSocket> = new Map();

  constructor(url: string) {
    this.url = url;
  }

  /**
   * Create a WebSocket connection
   */
  async connect(page: Page, connectionId: string = 'default'): Promise<WebSocket> {
    const ws = await page.evaluateHandle((url) => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);

        ws.onopen = () => {
          resolve(ws);
        };

        ws.onerror = (error) => {
          reject(error);
        };
      });
    }, this.url);

    this.connections.set(connectionId, ws as any);
    return ws as any;
  }

  /**
   * Send message through WebSocket
   */
  async sendMessage(page: Page, connectionId: string = 'default', message: any): Promise<void> {
    await page.evaluate((ws, msg) => {
      ws.send(JSON.stringify(msg));
    }, this.connections.get(connectionId), message);
  }

  /**
   * Wait for specific message type
   */
  async waitForMessage(page: Page, connectionId: string = 'default', messageType: string, timeout: number = 10000): Promise<any> {
    return await page.evaluate((ws, type, timeout) => {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Timeout waiting for message type: ${type}`));
        }, timeout);

        const originalOnMessage = ws.onmessage;
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === type) {
              clearTimeout(timeoutId);
              ws.onmessage = originalOnMessage;
              resolve(data);
            }
          } catch (error) {
            // Invalid JSON, ignore
          }
        };
      });
    }, this.connections.get(connectionId), messageType, timeout);
  }

  /**
   * Mock WebSocket for testing
   */
  async mockWebSocket(page: Page, behavior: 'echo' | 'delayed' | 'error' | 'custom', customHandler?: string): Promise<void> {
    const mockScript = this.generateMockScript(behavior, customHandler);
    await page.addInitScript(mockScript);
  }

  /**
   * Generate mock WebSocket script
   */
  private generateMockScript(behavior: string, customHandler?: string): string {
    const baseScript = `
      window.WebSocket = class MockWebSocket extends WebSocket {
        constructor(url) {
          super(url);
          this.url = url;
          this.readyState = WebSocket.CONNECTING;
          this.messages = [];

          setTimeout(() => {
            this.readyState = WebSocket.OPEN;
            if (this.onopen) this.onopen({ type: 'open' });
            this.processMessages();
          }, 100);
        }

        send(data) {
          this.messages.push(data);
        }

        processMessages() {
          ${this.getBehaviorHandler(behavior, customHandler)}
        }

        close() {
          this.readyState = WebSocket.CLOSED;
          if (this.onclose) this.onclose({ type: 'close' });
        }
      };
    `;

    return baseScript;
  }

  /**
   * Get behavior handler for mock WebSocket
   */
  private getBehaviorHandler(behavior: string, customHandler?: string): string {
    switch (behavior) {
      case 'echo':
        return `
          this.messages.forEach(msg => {
            if (this.onmessage) {
              setTimeout(() => {
                this.onmessage({
                  type: 'message',
                  data: JSON.stringify({
                    type: 'echo',
                    originalData: msg,
                    timestamp: Date.now()
                  })
                });
              }, 50);
            }
          });
          this.messages = [];
        `;

      case 'delayed':
        return `
          setTimeout(() => {
            this.messages.forEach(msg => {
              if (this.onmessage) {
                this.onmessage({
                  type: 'message',
                  data: JSON.stringify({
                    type: 'delayed_response',
                    originalData: msg,
                    timestamp: Date.now()
                  })
                });
              }
            });
            this.messages = [];
          }, 1000);
        `;

      case 'error':
        return `
          setTimeout(() => {
            if (this.onerror) {
              this.onerror({ type: 'error', message: 'WebSocket connection failed' });
            }
            if (this.onclose) {
              this.onclose({ type: 'close', code: 1006, reason: 'Connection failed' });
            }
          }, 500);
        `;

      case 'custom':
        return customHandler || '';

      default:
        return '';
    }
  }

  /**
   * Close all connections
   */
  async closeAll(): Promise<void> {
    for (const [id, ws] of this.connections) {
      try {
        await ws.close();
      } catch (error) {
        console.warn(`Failed to close WebSocket connection ${id}:`, error);
      }
    }
    this.connections.clear();
  }
}

/**
 * Database Helper Class
 * Provides utility methods for database operations in tests
 */
export class DatabaseHelper {
  private dbUrl: string;
  private connection: any;

  constructor(dbUrl: string) {
    this.dbUrl = dbUrl;
  }

  /**
   * Initialize database connection
   */
  async connect(): Promise<void> {
    // This would typically use your database driver
    // For testing purposes, we'll mock this
    console.log('Database connection initialized');
  }

  /**
   * Execute query
   */
  async query(sql: string, params: any[] = []): Promise<any> {
    // Mock database query
    console.log('Executing query:', sql, params);
    return { rows: [], rowCount: 0 };
  }

  /**
   * Clean up test data
   */
  async cleanupTestData(userId: string): Promise<void> {
    try {
      // Clean up user-related test data
      await this.query('DELETE FROM test_runs WHERE user_id = $1', [userId]);
      await this.query('DELETE FROM test_cases WHERE created_by = $1', [userId]);
      await this.query('DELETE FROM projects WHERE created_by = $1', [userId]);
      await this.query('DELETE FROM users WHERE id = $1', [userId]);

      console.log(`✅ Cleaned up test data for user: ${userId}`);
    } catch (error) {
      console.error('❌ Failed to clean up test data:', error);
      throw error;
    }
  }

  /**
   * Seed test data
   */
  async seedTestData(dataType: string, count: number = 1): Promise<any[]> {
    const seedData = [];

    for (let i = 0; i < count; i++) {
      switch (dataType) {
        case 'users':
          seedData.push(await generateTestUser());
          break;
        case 'projects':
          seedData.push(await generateTestProject());
          break;
        default:
          throw new Error(`Unknown data type: ${dataType}`);
      }
    }

    return seedData;
  }

  /**
   * Verify data integrity
   */
  async verifyDataIntegrity(): Promise<boolean> {
    try {
      // Run database integrity checks
      const checks = [
        'SELECT COUNT(*) FROM users WHERE email IS NULL',
        'SELECT COUNT(*) FROM projects WHERE name IS NULL',
        'SELECT COUNT(*) FROM test_cases WHERE title IS NULL'
      ];

      for (const check of checks) {
        const result = await this.query(check);
        if (result.rows[0].count > 0) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Data integrity check failed:', error);
      return false;
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
    }
  }
}

/**
 * SSO Helper Class
 * Provides utility methods for SSO testing
 */
export class SSOHelper {
  private baseURL: string;
  private providers: Map<string, any> = new Map();

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  /**
   * Mock SSO provider
   */
  async mockSSOProvider(page: Page, providerType: 'azure-ad' | 'okta' | 'auth0', userData?: any): Promise<void> {
    const ssoData = generateSSOTestData(providerType);
    const user = userData || ssoData.user;

    switch (providerType) {
      case 'azure-ad':
        await this.mockAzureAD(page, user);
        break;
      case 'okta':
        await this.mockOkta(page, user);
        break;
      case 'auth0':
        await this.mockAuth0(page, user);
        break;
    }

    this.providers.set(providerType, ssoData);
  }

  /**
   * Mock Azure AD SSO flow
   */
  private async mockAzureAD(page: Page, user: any): Promise<void> {
    await page.route('**/login.microsoftonline.com/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `
          <!DOCTYPE html>
          <html>
            <head><title>Sign in to your account</title></head>
            <body>
              <form id="login-form" data-testid="azure-login-form">
                <input type="email" name="loginfmt" value="${user.email}" data-testid="email-input" />
                <input type="password" name="passwd" value="test-password" data-testid="password-input" />
                <button type="submit" data-testid="azure-signin-button">Sign in</button>
              </form>
              <script>
                document.getElementById('login-form').addEventListener('submit', (e) => {
                  e.preventDefault();
                  window.location.href = '${this.baseURL}/api/sso/callback?provider=azure-ad&state=test-state&code=mock-auth-code&session_state=test-session';
                });
              </script>
            </body>
          </html>
        `
      });
    });
  }

  /**
   * Mock Okta SSO flow
   */
  private async mockOkta(page: Page, user: any): Promise<void> {
    await page.route('**/*.okta.com/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `
          <!DOCTYPE html>
          <html>
            <head><title>Okta Sign In</title></head>
            <body>
              <form id="okta-login-form" data-testid="okta-login-form">
                <input type="text" name="username" value="${user.email}" data-testid="username-input" />
                <input type="password" name="password" value="test-password" data-testid="password-input" />
                <button type="submit" data-testid="okta-signin-button">Sign In</button>
              </form>
              <script>
                document.getElementById('okta-login-form').addEventListener('submit', (e) => {
                  e.preventDefault();
                  window.location.href = '${this.baseURL}/api/sso/callback?provider=okta&state=test-state&code=mock-okta-code';
                });
              </script>
            </body>
          </html>
        `
      });
    });
  }

  /**
   * Mock Auth0 SSO flow
   */
  private async mockAuth0(page: Page, user: any): Promise<void> {
    await page.route('**/*.auth0.com/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `
          <!DOCTYPE html>
          <html>
            <head><title>Auth0 Login</title></head>
            <body>
              <form id="auth0-login-form" data-testid="auth0-login-form">
                <input type="email" name="email" value="${user.email}" data-testid="email-input" />
                <input type="password" name="password" value="test-password" data-testid="password-input" />
                <button type="submit" data-testid="auth0-signin-button">Log In</button>
              </form>
              <script>
                document.getElementById('auth0-login-form').addEventListener('submit', (e) => {
                  e.preventDefault();
                  window.location.href = '${this.baseURL}/api/sso/callback?provider=auth0&state=test-state&code=mock-auth0-code';
                });
              </script>
            </body>
          </html>
        `
      });
    });
  }

  /**
   * Mock SSO callback
   */
  async mockSSOCallback(page: Page, providerType: string, user: any): Promise<void> {
    await page.route('**/api/sso/callback*', (route) => {
      const url = new URL(route.request().url());
      const provider = url.searchParams.get('provider');

      if (provider === providerType) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              firstName: user.firstName,
              lastName: user.lastName,
              roles: user.roles,
              groups: user.groups,
              avatar: user.avatar
            },
            tokens: {
              accessToken: 'mock-access-token',
              refreshToken: 'mock-refresh-token',
              expiresIn: 3600,
              tokenType: 'Bearer'
            },
            providerInfo: {
              id: providerType,
              name: this.getProviderName(providerType),
              type: 'oidc'
            }
          })
        });
      } else {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Invalid provider',
            code: 'INVALID_PROVIDER'
          })
        });
      }
    });
  }

  /**
   * Get provider display name
   */
  private getProviderName(providerType: string): string {
    const names = {
      'azure-ad': 'Azure Active Directory',
      'okta': 'Okta',
      'auth0': 'Auth0'
    };
    return names[providerType] || providerType;
  }

  /**
   * Verify SSO session
   */
  async verifySSOSession(page: Page): Promise<boolean> {
    try {
      const sessionInfo = await page.evaluate(() => {
        const token = localStorage.getItem('auth_token');
        const user = sessionStorage.getItem('user_info');
        return { token: !!token, user: !!user };
      });

      return sessionInfo.token && sessionInfo.user;
    } catch (error) {
      console.error('Failed to verify SSO session:', error);
      return false;
    }
  }

  /**
   * Simulate SSO logout
   */
  async simulateSSOLogout(page: Page, providerType: string): Promise<void> {
    await page.addInitScript((provider) => {
      // Clear local storage
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      sessionStorage.removeItem('user_info');

      // Redirect to logout endpoint
      const logoutUrls = {
        'azure-ad': 'https://login.microsoftonline.com/logout',
        'okta': 'https://company.okta.com/logout',
        'auth0': 'https://company.auth0.com/v2/logout'
      };

      if (logoutUrls[provider]) {
        window.location.href = logoutUrls[provider];
      }
    }, providerType);
  }
}

/**
 * Performance Helper Class
 * Provides utility methods for performance testing
 */
export class PerformanceHelper {
  /**
   * Measure page load performance
   */
  async measurePageLoad(page: Page): Promise<any> {
    return await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paintEntries = performance.getEntriesByType('paint');

      return {
        // Navigation timing
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        totalTime: navigation.loadEventEnd - navigation.navigationStart,

        // Paint timing
        firstPaint: paintEntries.find(entry => entry.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0,

        // Resource timing
        resourceCount: performance.getEntriesByType('resource').length,

        // Memory usage (if available)
        memory: (performance as any).memory ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
        } : null
      };
    });
  }

  /**
   * Measure interaction performance
   */
  async measureInteraction(page: Page, interaction: () => Promise<void>): Promise<any> {
    const startTime = Date.now();

    // Start performance mark
    await page.evaluate(() => performance.mark('interaction-start'));

    // Execute interaction
    await interaction();

    // End performance mark
    await page.evaluate(() => performance.mark('interaction-end'));

    // Measure the marks
    const measurement = await page.evaluate(() => {
      performance.measure('interaction-duration', 'interaction-start', 'interaction-end');
      const measure = performance.getEntriesByName('interaction-duration')[0];
      return {
        duration: measure.duration,
        startTime: measure.startTime
      };
    });

    return {
      ...measurement,
      wallTime: Date.now() - startTime
    };
  }

  /**
   * Monitor resource usage
   */
  async monitorResourceUsage(page: Page, duration: number = 5000): Promise<any> {
    return await page.evaluate((monitorDuration) => {
      return new Promise((resolve) => {
        const measurements = [];
        const startTime = Date.now();

        const collectMeasurement = () => {
          const memory = (performance as any).memory;
          measurements.push({
            timestamp: Date.now() - startTime,
            memory: memory ? {
              used: memory.usedJSHeapSize,
              total: memory.totalJSHeapSize,
              limit: memory.jsHeapSizeLimit
            } : null,
            performance: {
              now: performance.now()
            }
          });
        };

        const interval = setInterval(collectMeasurement, 500);

        setTimeout(() => {
          clearInterval(interval);
          resolve(measurements);
        }, monitorDuration);
      });
    }, duration);
  }
}

/**
 * Accessibility Helper Class
 * Provides utility methods for accessibility testing
 */
export class AccessibilityHelper {
  /**
   * Check for common accessibility issues
   */
  async checkAccessibility(page: Page): Promise<any> {
    return await page.evaluate(() => {
      const issues = [];

      // Check for missing alt text on images
      const images = document.querySelectorAll('img');
      images.forEach((img, index) => {
        if (!img.alt && img.alt !== '') {
          issues.push({
            type: 'missing-alt-text',
            element: `img[${index}]`,
            message: 'Image is missing alt text',
            severity: 'medium'
          });
        }
      });

      // Check for missing form labels
      const inputs = document.querySelectorAll('input, select, textarea');
      inputs.forEach((input, index) => {
        const hasLabel = document.querySelector(`label[for="${input.id}"]`) ||
                        input.getAttribute('aria-label') ||
                        input.getAttribute('title');
        if (!hasLabel) {
          issues.push({
            type: 'missing-form-label',
            element: input.tagName.toLowerCase(),
            message: 'Form input is missing associated label',
            severity: 'high'
          });
        }
      });

      // Check for proper heading hierarchy
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      let lastLevel = 0;
      headings.forEach((heading) => {
        const currentLevel = parseInt(heading.tagName.substring(1));
        if (currentLevel > lastLevel + 1) {
          issues.push({
            type: 'heading-hierarchy',
            element: heading.tagName.toLowerCase(),
            message: `Heading level skipped from h${lastLevel} to h${currentLevel}`,
            severity: 'low'
          });
        }
        lastLevel = currentLevel;
      });

      // Check for sufficient color contrast (basic check)
      const elementsWithText = document.querySelectorAll('*');
      elementsWithText.forEach((element) => {
        const styles = window.getComputedStyle(element);
        const color = styles.color;
        const backgroundColor = styles.backgroundColor;

        // Simple check for light text on light background or vice versa
        if (color !== 'rgb(0, 0, 0)' && backgroundColor !== 'rgb(255, 255, 255)') {
          // This is a simplified check - real contrast checking is more complex
          if (this.isSimilarColor(color, backgroundColor)) {
            issues.push({
              type: 'low-contrast',
              element: element.tagName.toLowerCase(),
              message: 'Text may have insufficient color contrast',
              severity: 'medium'
            });
          }
        }
      });

      return {
        totalIssues: issues.length,
        issues: issues,
        score: Math.max(0, 100 - (issues.length * 10))
      };
    });
  }

  /**
   * Simple color similarity check (placeholder for real contrast calculation)
   */
  private isSimilarColor(color1: string, color2: string): boolean {
    // This is a simplified placeholder
    // Real implementation would convert to LAB color space and calculate contrast ratio
    return false;
  }
}

/**
 * Network Helper Class
 * Provides utility methods for network condition testing
 */
export class NetworkHelper {
  /**
   * Simulate slow network
   */
  async simulateSlowNetwork(page: Page, latency: number = 1000, downloadThroughput: number = 1000): Promise<void> {
    await page.context().setOffline(false);

    // Note: Playwright doesn't directly support network throttling in all contexts
    // This would typically be done through Chrome DevTools Protocol
    await page.addInitScript((lat, throughput) => {
      // Mock slow network by intercepting fetch
      const originalFetch = window.fetch;
      window.fetch = async function(...args) {
        await new Promise(resolve => setTimeout(resolve, lat));
        return originalFetch.apply(this, args);
      };
    }, latency, downloadThroughput);
  }

  /**
   * Simulate offline mode
   */
  async simulateOffline(page: Page): Promise<void> {
    await page.setOffline(true);
  }

  /**
   * Restore network connection
   */
  async restoreNetwork(page: Page): Promise<void> {
    await page.setOffline(false);
  }

  /**
   * Monitor network requests
   */
  async monitorRequests(page: Page, duration: number = 5000): Promise<any> {
    const requests: any[] = [];

    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        timestamp: Date.now(),
        type: 'request'
      });
    });

    page.on('response', response => {
      requests.push({
        url: response.url(),
        status: response.status(),
        timestamp: Date.now(),
        type: 'response'
      });
    });

    await page.waitForTimeout(duration);

    return {
      totalRequests: requests.filter(r => r.type === 'request').length,
      requests: requests
    };
  }
}
