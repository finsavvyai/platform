import type { WizardStep } from './WizardContainer';
import {
  AVAILABLE_INTEGRATIONS,
  VALID_SYNC_FREQUENCIES
} from './integration-definitions';

export type { IntegrationDefinition } from './integration-definitions';

export interface Integration {
  id: string;
  name: string;
  category: string;
  configured: boolean;
  credentials?: Record<string, string>;
  testStatus?: 'pending' | 'success' | 'failure';
  testMessage?: string;
}

export interface IntegrationsData {
  integrations: Record<string, Integration>;
  autoDiscovery?: boolean;
  syncFrequency?: 'realtime' | 'hourly' | '6hourly' | 'daily';
}

export class StepIntegrations implements WizardStep {
  id = 'step-integrations';
  title = 'Configure Integrations';
  description = 'Connect your infrastructure providers and services';
  component = 'StepIntegrationsComponent';
  status: 'pending' | 'in_progress' | 'completed' = 'pending';
  data?: IntegrationsData;
  errors?: Record<string, string>;
  canSkip = true;

  constructor() {
    this.data = {
      integrations: {},
      autoDiscovery: false,
      syncFrequency: 'hourly'
    };
    this.initializeIntegrations();
  }

  private initializeIntegrations(): void {
    if (!this.data) return;
    for (const [id, config] of Object.entries(AVAILABLE_INTEGRATIONS)) {
      this.data.integrations[id] = {
        id,
        name: config.name,
        category: config.category,
        configured: false
      };
    }
  }

  getAvailableIntegrations(): Array<{
    id: string;
    name: string;
    category: string;
    requiredFields: string[];
  }> {
    return Object.entries(AVAILABLE_INTEGRATIONS).map(([id, config]) => ({
      id,
      ...config
    }));
  }

  configureIntegration(
    integrationId: string,
    credentials: Record<string, string>
  ): { valid: boolean; error?: string } {
    if (!this.data?.integrations[integrationId]) {
      return { valid: false, error: 'Integration not found' };
    }

    const config = AVAILABLE_INTEGRATIONS[integrationId];
    if (!config) {
      return { valid: false, error: 'Integration config not found' };
    }

    const missing = config.requiredFields.filter(field => !credentials[field]);
    if (missing.length > 0) {
      return { valid: false, error: `Missing required fields: ${missing.join(', ')}` };
    }

    const integration = this.data.integrations[integrationId];
    integration.credentials = credentials;
    integration.configured = false;
    integration.testStatus = 'pending';
    return { valid: true };
  }

  async testIntegration(
    integrationId: string
  ): Promise<{ success: boolean; message: string }> {
    const integration = this.data?.integrations[integrationId];
    if (!integration || !integration.credentials) {
      return { success: false, message: 'Integration not configured' };
    }

    integration.testStatus = 'pending';

    return new Promise(resolve => {
      setTimeout(() => {
        const success = Math.random() > 0.3;
        integration!.testStatus = success ? 'success' : 'failure';
        integration!.testMessage = success
          ? 'Connection successful'
          : 'Failed to connect. Check credentials.';

        if (success) {
          integration!.configured = true;
        }

        resolve({ success, message: integration!.testMessage });
      }, 1000);
    });
  }

  unconfigureIntegration(integrationId: string): boolean {
    if (!this.data?.integrations[integrationId]) return false;
    const integration = this.data.integrations[integrationId];
    integration.credentials = undefined;
    integration.configured = false;
    integration.testStatus = 'pending';
    return true;
  }

  getConfiguredIntegrations(): string[] {
    if (!this.data) return [];
    return Object.entries(this.data.integrations)
      .filter(([_, int]) => int.configured)
      .map(([id]) => id);
  }

  setAutoDiscovery(enabled: boolean): void {
    if (this.data) {
      this.data.autoDiscovery = enabled;
    }
  }

  setSyncFrequency(frequency: string): boolean {
    const valid = (VALID_SYNC_FREQUENCIES as readonly string[]).includes(frequency);
    if (valid && this.data) {
      this.data.syncFrequency = frequency as IntegrationsData['syncFrequency'];
      return true;
    }
    return false;
  }

  validate(): { valid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};
    if (this.getConfiguredIntegrations().length === 0) {
      errors.integrations =
        'At least one integration should be configured (can be skipped)';
    }
    return { valid: Object.keys(errors).length === 0, errors };
  }

  getConfiguration(): {
    integrations: Array<{ id: string; credentials: Record<string, string> }>;
    autoDiscovery: boolean;
    syncFrequency: string;
  } {
    const integrations = this.getConfiguredIntegrations().map(id => ({
      id,
      credentials: this.data?.integrations[id]?.credentials || {}
    }));
    return {
      integrations,
      autoDiscovery: this.data?.autoDiscovery || false,
      syncFrequency: this.data?.syncFrequency || 'hourly'
    };
  }
}
