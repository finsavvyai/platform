'use strict';

/**
 * API Environment Substitutor
 * Handles environment variable substitution in API tests
 */

export class APIEnvironmentSubstitutor {
  private envVars: Record<string, string>;

  constructor() {
    this.envVars = process.env as Record<string, string>;
  }

  /**
   * Substitute environment variables in any value
   * Syntax: ${VAR_NAME} or ${VAR_NAME:default_value}
   */
  substitute(value: any): any {
    if (typeof value === 'string') {
      return this.substituteString(value);
    }
    if (Array.isArray(value)) {
      return value.map((v) => this.substitute(v));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.entries(value).reduce(
        (acc, [key, val]) => ({
          ...acc,
          [key]: this.substitute(val),
        }),
        {}
      );
    }
    return value;
  }

  /**
   * Substitute environment variables in string
   */
  private substituteString(str: string): string {
    return str.replace(
      /\$\{([^}:]+)(?::([^}]*))?\}/g,
      (_, varName, defaultValue) => {
        const value = this.envVars[varName];
        return value !== undefined ? value : (defaultValue || '');
      }
    );
  }

  /**
   * Set environment variable
   */
  setVar(name: string, value: string): void {
    this.envVars[name] = value;
    process.env[name] = value;
  }

  /**
   * Get environment variable
   */
  getVar(name: string): string | undefined {
    return this.envVars[name];
  }
}
