/**
 * 🌙 LunaForge Secure Credential Storage
 *
 * Provides secure storage for sensitive credentials using VS Code's secretStorage API.
 * Credentials are encrypted at rest and never exposed in configuration files.
 */

import * as vscode from 'vscode';

export interface StoredCredentials {
  apiKey: string;
  merchantId: string;
  secretKey: string;
  environment: 'sandbox' | 'production';
}

export class SecureCredentialStorage {
  private static instance: SecureCredentialStorage;
  private context: vscode.ExtensionContext;

  private readonly STORAGE_KEY_API_KEY = 'lunaforge.payplus.apiKey';
  private readonly STORAGE_KEY_MERCHANT_ID = 'lunaforge.payplus.merchantId';
  private readonly STORAGE_KEY_SECRET_KEY = 'lunaforge.payplus.secretKey';
  private readonly STORAGE_KEY_ENVIRONMENT = 'lunaforge.payplus.environment';

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  public static getInstance(context: vscode.ExtensionContext): SecureCredentialStorage {
    if (!SecureCredentialStorage.instance) {
      SecureCredentialStorage.instance = new SecureCredentialStorage(context);
    }
    return SecureCredentialStorage.instance;
  }

  /**
   * Store PayPlus credentials securely
   */
  public async storeCredentials(credentials: StoredCredentials): Promise<void> {
    try {
      await this.context.secrets.store(this.STORAGE_KEY_API_KEY, credentials.apiKey);
      await this.context.secrets.store(this.STORAGE_KEY_MERCHANT_ID, credentials.merchantId);
      await this.context.secrets.store(this.STORAGE_KEY_SECRET_KEY, credentials.secretKey);
      await this.context.secrets.store(this.STORAGE_KEY_ENVIRONMENT, credentials.environment);

      console.log('Credentials stored securely');
    } catch (error) {
      console.error('Failed to store credentials:', error);
      throw new Error(`Failed to store credentials: ${(error as Error).message}`);
    }
  }

  /**
   * Retrieve PayPlus credentials from secure storage
   * Returns null if credentials are not stored
   */
  public async getCredentials(): Promise<StoredCredentials | null> {
    try {
      const apiKey = await this.context.secrets.get(this.STORAGE_KEY_API_KEY);
      const merchantId = await this.context.secrets.get(this.STORAGE_KEY_MERCHANT_ID);
      const secretKey = await this.context.secrets.get(this.STORAGE_KEY_SECRET_KEY);
      const environment = await this.context.secrets.get(this.STORAGE_KEY_ENVIRONMENT) as 'sandbox' | 'production' | undefined;

      // Return null if any critical credential is missing
      if (!apiKey || !merchantId || !secretKey) {
        return null;
      }

      return {
        apiKey,
        merchantId,
        secretKey,
        environment: environment || 'sandbox'
      };
    } catch (error) {
      console.error('Failed to retrieve credentials:', error);
      return null;
    }
  }

  /**
   * Check if credentials are stored
   */
  public async hasCredentials(): Promise<boolean> {
    const creds = await this.getCredentials();
    return creds !== null;
  }

  /**
   * Clear all stored credentials
   */
  public async clearCredentials(): Promise<void> {
    try {
      await this.context.secrets.delete(this.STORAGE_KEY_API_KEY);
      await this.context.secrets.delete(this.STORAGE_KEY_MERCHANT_ID);
      await this.context.secrets.delete(this.STORAGE_KEY_SECRET_KEY);
      await this.context.secrets.delete(this.STORAGE_KEY_ENVIRONMENT);

      console.log('Credentials cleared from secure storage');
    } catch (error) {
      console.error('Failed to clear credentials:', error);
      throw new Error(`Failed to clear credentials: ${(error as Error).message}`);
    }
  }

  /**
   * Prompt user to enter credentials securely
   * Returns the credentials if user provides them, null if cancelled
   */
  public async promptForCredentials(): Promise<StoredCredentials | null> {
    try {
      // Prompt for API Key
      const apiKey = await vscode.window.showInputBox({
        prompt: 'Enter your PayPlus API Key',
        password: true,
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'API Key is required';
          }
          return undefined;
        }
      });

      if (!apiKey) {
        return null; // User cancelled
      }

      // Prompt for Merchant ID
      const merchantId = await vscode.window.showInputBox({
        prompt: 'Enter your PayPlus Merchant ID',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Merchant ID is required';
          }
          return undefined;
        }
      });

      if (!merchantId) {
        return null; // User cancelled
      }

      // Prompt for Secret Key
      const secretKey = await vscode.window.showInputBox({
        prompt: 'Enter your PayPlus Secret Key',
        password: true,
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Secret Key is required';
          }
          return undefined;
        }
      });

      if (!secretKey) {
        return null; // User cancelled
      }

      // Select environment
      const environment = await vscode.window.showQuickPick(
        [
          { label: 'Sandbox', description: 'For testing and development', value: 'sandbox' as const },
          { label: 'Production', description: 'For live payments', value: 'production' as const }
        ],
        {
          placeHolder: 'Select PayPlus environment',
          canPickMany: false
        }
      );

      if (!environment) {
        return null; // User cancelled
      }

      const credentials: StoredCredentials = {
        apiKey: apiKey.trim(),
        merchantId: merchantId.trim(),
        secretKey: secretKey.trim(),
        environment: environment.value
      };

      // Store the credentials
      await this.storeCredentials(credentials);

      return credentials;
    } catch (error) {
      console.error('Failed to prompt for credentials:', error);
      return null;
    }
  }

  /**
   * Update existing credentials (only updates provided fields)
   */
  public async updateCredentials(updates: Partial<StoredCredentials>): Promise<void> {
    const existing = await this.getCredentials();
    if (!existing) {
      throw new Error('No existing credentials to update. Please store credentials first.');
    }

    const updated: StoredCredentials = {
      ...existing,
      ...updates
    };

    await this.storeCredentials(updated);
  }
}
