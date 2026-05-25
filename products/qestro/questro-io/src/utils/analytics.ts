// Analytics utility functions for tracking user interactions
// across the Questro testing platform

export interface AnalyticsEvent {
  action: string;
  category: string;
  label?: string;
  value?: number;
  customParameters?: Record<string, any>;
}

export interface VoiceCommandEvent {
  command: string;
  success: boolean;
  duration?: number;
  intent?: string;
}

export interface TestGenerationEvent {
  language: string;
  testCount: number;
  duration: number;
  codeSize: number;
  framework?: string;
}

export interface SecurityScanEvent {
  scanType: string;
  vulnerabilitiesFound: number;
  criticalCount: number;
  duration: number;
  targetUrl?: string;
}

export interface PerformanceTestEvent {
  userCount: number;
  duration: number;
  successRate: number;
  averageResponseTime: number;
  throughput: number;
}

export interface SubscriptionEvent {
  action: 'subscribe' | 'upgrade' | 'downgrade' | 'cancel';
  planType: string;
  amount: number;
  currency: string;
  previousPlan?: string;
}

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    trackEvent?: (action: string, category: string, label?: string, value?: number) => void;
    trackVoiceCommand?: (command: string, success: boolean) => void;
    trackTestGeneration?: (language: string, testCount: number, duration: number) => void;
    trackSecurityScan?: (scanType: string, vulnerabilitiesFound: number) => void;
    trackPerformanceTest?: (userCount: number, duration: number, successRate: number) => void;
    trackSubscription?: (action: string, planType: string, amount: number) => void;
    fbq?: (...args: any[]) => void;
    _linkedin_data_partner_ids?: string[];
  }
}

export class Analytics {
  private static isProduction = process.env.NODE_ENV === 'production';
  private static isAnalyticsEnabled = typeof window !== 'undefined' && window.gtag;

  /**
   * Generic event tracking
   */
  static trackEvent(event: AnalyticsEvent): void {
    if (!this.isAnalyticsEnabled) {
      console.log('Analytics (dev):', event);
      return;
    }

    try {
      if (window.trackEvent) {
        window.trackEvent(event.action, event.category, event.label, event.value);
      }

      // Also track with gtag directly for custom parameters
      if (window.gtag) {
        window.gtag('event', event.action, {
          event_category: event.category,
          event_label: event.label,
          value: event.value,
          ...event.customParameters
        });
      }
    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  }

  /**
   * Track voice command usage
   */
  static trackVoiceCommand(event: VoiceCommandEvent): void {
    if (!this.isAnalyticsEnabled) {
      console.log('Voice Analytics (dev):', event);
      return;
    }

    try {
      if (window.trackVoiceCommand) {
        window.trackVoiceCommand(event.command, event.success);
      }

      // Enhanced tracking with additional parameters
      this.trackEvent({
        action: 'voice_command_used',
        category: 'Voice Features',
        label: event.command,
        value: event.success ? 1 : 0,
        customParameters: {
          command_duration: event.duration,
          intent_detected: event.intent,
          voice_success: event.success
        }
      });
    } catch (error) {
      console.error('Voice analytics error:', error);
    }
  }

  /**
   * Track AI test generation
   */
  static trackTestGeneration(event: TestGenerationEvent): void {
    if (!this.isAnalyticsEnabled) {
      console.log('Test Generation Analytics (dev):', event);
      return;
    }

    try {
      if (window.trackTestGeneration) {
        window.trackTestGeneration(event.language, event.testCount, event.duration);
      }

      this.trackEvent({
        action: 'test_generated',
        category: 'AI Features',
        label: event.language,
        value: event.testCount,
        customParameters: {
          generation_time: event.duration,
          code_size: event.codeSize,
          framework: event.framework,
          tests_per_second: event.testCount / (event.duration / 1000)
        }
      });
    } catch (error) {
      console.error('Test generation analytics error:', error);
    }
  }

  /**
   * Track security scanning
   */
  static trackSecurityScan(event: SecurityScanEvent): void {
    if (!this.isAnalyticsEnabled) {
      console.log('Security Analytics (dev):', event);
      return;
    }

    try {
      if (window.trackSecurityScan) {
        window.trackSecurityScan(event.scanType, event.vulnerabilitiesFound);
      }

      this.trackEvent({
        action: 'security_scan_completed',
        category: 'Security Features',
        label: event.scanType,
        value: event.vulnerabilitiesFound,
        customParameters: {
          critical_vulnerabilities: event.criticalCount,
          scan_duration: event.duration,
          target_scanned: event.targetUrl ? 'external' : 'internal',
          security_score: this.calculateSecurityScore(event.vulnerabilitiesFound, event.criticalCount)
        }
      });
    } catch (error) {
      console.error('Security analytics error:', error);
    }
  }

  /**
   * Track performance testing
   */
  static trackPerformanceTest(event: PerformanceTestEvent): void {
    if (!this.isAnalyticsEnabled) {
      console.log('Performance Analytics (dev):', event);
      return;
    }

    try {
      if (window.trackPerformanceTest) {
        window.trackPerformanceTest(event.userCount, event.duration, event.successRate);
      }

      this.trackEvent({
        action: 'performance_test_completed',
        category: 'Performance Features',
        label: this.getPerformanceTestCategory(event.userCount),
        value: event.userCount,
        customParameters: {
          test_duration: event.duration,
          success_rate: event.successRate,
          avg_response_time: event.averageResponseTime,
          throughput: event.throughput,
          performance_score: this.calculatePerformanceScore(event)
        }
      });
    } catch (error) {
      console.error('Performance analytics error:', error);
    }
  }

  /**
   * Track subscription events
   */
  static trackSubscription(event: SubscriptionEvent): void {
    if (!this.isAnalyticsEnabled) {
      console.log('Subscription Analytics (dev):', event);
      return;
    }

    try {
      if (window.trackSubscription) {
        window.trackSubscription(event.action, event.planType, event.amount);
      }

      // Enhanced ecommerce tracking
      if (window.gtag) {
        window.gtag('event', 'purchase', {
          transaction_id: `sub_${Date.now()}`,
          value: event.amount,
          currency: event.currency,
          items: [{
            item_id: event.planType,
            item_name: `Questro ${event.planType} Plan`,
            item_category: 'Subscription',
            price: event.amount,
            quantity: 1
          }]
        });
      }

      this.trackEvent({
        action: event.action,
        category: 'Subscription',
        label: event.planType,
        value: event.amount,
        customParameters: {
          currency: event.currency,
          previous_plan: event.previousPlan,
          subscription_action: event.action
        }
      });
    } catch (error) {
      console.error('Subscription analytics error:', error);
    }
  }

  /**
   * Track page views with custom parameters
   */
  static trackPageView(page: string, customParameters?: Record<string, any>): void {
    if (!this.isAnalyticsEnabled) {
      console.log('Page View Analytics (dev):', { page, customParameters });
      return;
    }

    try {
      if (window.gtag) {
        window.gtag('config', 'G-XXXXXXXXXX', {
          page_title: document.title,
          page_location: window.location.href,
          page_path: page,
          ...customParameters
        });
      }
    } catch (error) {
      console.error('Page view analytics error:', error);
    }
  }

  /**
   * Track conversion events
   */
  static trackConversion(conversionType: string, value?: number): void {
    if (!this.isAnalyticsEnabled) {
      console.log('Conversion Analytics (dev):', { conversionType, value });
      return;
    }

    try {
      this.trackEvent({
        action: 'conversion',
        category: 'Conversions',
        label: conversionType,
        value: value
      });

      // Facebook Pixel tracking
      if (window.fbq) {
        window.fbq('track', 'Lead', {
          content_name: conversionType,
          value: value
        });
      }
    } catch (error) {
      console.error('Conversion analytics error:', error);
    }
  }

  /**
   * Track user engagement
   */
  static trackEngagement(action: string, duration?: number): void {
    this.trackEvent({
      action: 'user_engagement',
      category: 'Engagement',
      label: action,
      value: duration,
      customParameters: {
        engagement_time: duration,
        engagement_action: action
      }
    });
  }

  // Helper methods
  private static calculateSecurityScore(total: number, critical: number): number {
    if (total === 0) return 10;
    const score = Math.max(1, 10 - (critical * 3) - (total * 0.5));
    return Math.round(score * 10) / 10;
  }

  private static calculatePerformanceScore(event: PerformanceTestEvent): number {
    const responseScore = Math.max(0, 100 - event.averageResponseTime);
    const successScore = event.successRate;
    const throughputScore = Math.min(100, event.throughput / 10);
    
    return Math.round(((responseScore + successScore + throughputScore) / 3) * 10) / 10;
  }

  private static getPerformanceTestCategory(userCount: number): string {
    if (userCount <= 50) return 'light_load';
    if (userCount <= 500) return 'medium_load';
    if (userCount <= 2000) return 'heavy_load';
    return 'stress_test';
  }
}

// Export convenience functions
export const trackVoiceCommand = (command: string, success: boolean, duration?: number, intent?: string) => {
  Analytics.trackVoiceCommand({ command, success, duration, intent });
};

export const trackTestGeneration = (language: string, testCount: number, duration: number, codeSize: number, framework?: string) => {
  Analytics.trackTestGeneration({ language, testCount, duration, codeSize, framework });
};

export const trackSecurityScan = (scanType: string, vulnerabilitiesFound: number, criticalCount: number, duration: number, targetUrl?: string) => {
  Analytics.trackSecurityScan({ scanType, vulnerabilitiesFound, criticalCount, duration, targetUrl });
};

export const trackPerformanceTest = (userCount: number, duration: number, successRate: number, averageResponseTime: number, throughput: number) => {
  Analytics.trackPerformanceTest({ userCount, duration, successRate, averageResponseTime, throughput });
};

export const trackSubscription = (action: SubscriptionEvent['action'], planType: string, amount: number, currency = 'USD', previousPlan?: string) => {
  Analytics.trackSubscription({ action, planType, amount, currency, previousPlan });
};

export const trackPageView = (page: string, customParameters?: Record<string, any>) => {
  Analytics.trackPageView(page, customParameters);
};

export const trackConversion = (conversionType: string, value?: number) => {
  Analytics.trackConversion(conversionType, value);
};

export const trackEngagement = (action: string, duration?: number) => {
  Analytics.trackEngagement(action, duration);
};

export default Analytics;