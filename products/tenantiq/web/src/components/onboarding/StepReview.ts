import type { WizardStep } from './WizardContainer';
import type { TenantImportData } from './StepTenants';
import type { MetricsData } from './StepMetrics';
import type { ThresholdsData } from './StepThresholds';
import type { IntegrationsData } from './StepIntegrations';

export interface OnboardingReview {
  tenants: TenantImportData;
  metrics: MetricsData;
  thresholds: ThresholdsData;
  integrations: IntegrationsData;
  agreedToTerms: boolean;
  agreedToPrivacy: boolean;
}

export interface OnboardingResult {
  success: boolean;
  organizationId?: string;
  setupUrl?: string;
  message: string;
  errors?: Record<string, string>;
}

export class StepReview implements WizardStep {
  id = 'step-review';
  title = 'Review & Activate';
  description = 'Review your settings and activate your account';
  component = 'StepReviewComponent';
  status: 'pending' | 'in_progress' | 'completed' = 'pending';
  data?: OnboardingReview;
  errors?: Record<string, string>;
  canSkip = false;

  constructor() {
    this.data = {
      tenants: {},
      metrics: { selected: {} },
      thresholds: { thresholds: {} },
      integrations: { integrations: {} },
      agreedToTerms: false,
      agreedToPrivacy: false
    };
  }

  populateFromPreviousSteps(allStepsData: Record<string, any>): void {
    if (!this.data) return;

    this.data.tenants = allStepsData['step-tenants']?.data || {};
    this.data.metrics = allStepsData['step-metrics']?.data || {};
    this.data.thresholds = allStepsData['step-thresholds']?.data || {};
    this.data.integrations = allStepsData['step-integrations']?.data || {};
  }

  agreeTerm(term: 'terms' | 'privacy'): void {
    if (!this.data) return;

    if (term === 'terms') {
      this.data.agreedToTerms = true;
    } else if (term === 'privacy') {
      this.data.agreedToPrivacy = true;
    }
  }

  disagreeTerm(term: 'terms' | 'privacy'): void {
    if (!this.data) return;

    if (term === 'terms') {
      this.data.agreedToTerms = false;
    } else if (term === 'privacy') {
      this.data.agreedToPrivacy = false;
    }
  }

  hasAgreedToAll(): boolean {
    return this.data?.agreedToTerms && this.data?.agreedToPrivacy ? true : false;
  }

  validate(): { valid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    if (!this.data?.tenants || !this.data.tenants.preview || this.data.tenants.preview.length === 0) {
      errors.tenants = 'No tenants configured';
    }

    if (!this.data?.metrics || !this.data.metrics.selected || Object.keys(this.data.metrics.selected).length === 0) {
      errors.metrics = 'No metrics selected';
    }

    if (!this.data?.agreedToTerms) {
      errors.terms = 'You must agree to the terms of service';
    }

    if (!this.data?.agreedToPrivacy) {
      errors.privacy = 'You must agree to the privacy policy';
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  getSummary(): {
    tenantCount: number;
    metricsCount: number;
    integrationsCount: number;
    estimatedMonthlyCost: number;
  } {
    const tenantCount = this.data?.tenants?.preview?.length || 0;

    const metricsCount = this.data?.metrics?.selected
      ? Object.values(this.data.metrics.selected).filter(m => m.enabled).length
      : 0;

    const integrationsCount = this.data?.integrations?.integrations
      ? Object.values(this.data.integrations.integrations).filter(i => i.configured).length
      : 0;

    const estimatedMonthlyCost = tenantCount * 0.5 + metricsCount * 0.1 + integrationsCount * 5;

    return {
      tenantCount,
      metricsCount,
      integrationsCount,
      estimatedMonthlyCost
    };
  }

  async activate(): Promise<OnboardingResult> {
    const validation = this.validate();
    if (!validation.valid) {
      return {
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      };
    }

    return new Promise(resolve => {
      setTimeout(() => {
        const orgId = `org_${Date.now()}`;
        resolve({
          success: true,
          organizationId: orgId,
          setupUrl: `/dashboard/${orgId}`,
          message: 'Your organization has been set up successfully!'
        });
      }, 2000);
    });
  }

  getConfigurationBundle(): {
    organization: { name?: string };
    tenants: any[];
    metrics: any;
    thresholds: any;
    integrations: any;
  } {
    return {
      organization: { name: 'New Organization' },
      tenants: this.data?.tenants?.preview || [],
      metrics: this.data?.metrics || {},
      thresholds: this.data?.thresholds || {},
      integrations: this.data?.integrations || {}
    };
  }

  exportConfiguration(): string {
    const config = this.getConfigurationBundle();
    return JSON.stringify(config, null, 2);
  }

  downloadConfiguration(): { filename: string; content: string } {
    const config = this.exportConfiguration();
    return {
      filename: `tenantiq-config-${new Date().toISOString().split('T')[0]}.json`,
      content: config
    };
  }
}
