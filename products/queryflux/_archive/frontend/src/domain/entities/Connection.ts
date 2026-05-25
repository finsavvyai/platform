import { DatabaseType } from '../../types/database';

/**
 * Domain Entity: Database Connection
 * Represents a database connection configuration with enterprise-grade security
 */
export class Connection {
  public readonly id: string;
  public readonly createdAt: Date;
  public updatedAt: Date;
  private _encryptedCredentials: string;

  constructor(
    id: string,
    public readonly name: string,
    public readonly type: DatabaseType,
    public readonly host: string,
    public readonly port: number,
    public readonly database: string,
    public readonly username: string,
    encryptedPassword: string,
    public readonly ssl: boolean = false,
    public readonly userId: string,
    public readonly projectId?: string,
    public readonly tags: string[] = [],
    public readonly metadata: Record<string, any> = {}
  ) {
    this.id = id;
    this._encryptedCredentials = encryptedPassword;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  // Getters for encrypted data
  get encryptedCredentials(): string {
    return this._encryptedCredentials;
  }

  // Business methods
  updateConnection(updates: Partial<Connection>): void {
    // Validation rules
    this.validateConnectionConfig(updates);
    this.updatedAt = new Date();
  }

  private validateConnectionConfig(updates: Partial<Connection>): void {
    if (updates.host && !this.isValidHost(updates.host)) {
      throw new Error('Invalid host format');
    }
    if (updates.port && (updates.port < 1 || updates.port > 65535)) {
      throw new Error('Port must be between 1 and 65535');
    }
  }

  private isValidHost(host: string): boolean {
    // IPv4, IPv6, or hostname validation
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;

    return ipv4Regex.test(host) || ipv6Regex.test(host) || hostnameRegex.test(host);
  }

  // Domain invariants
  public isActive(): boolean {
    // Business rule: Connection is active if updated within last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return this.updatedAt > thirtyDaysAgo;
  }

  public getConnectionURI(): string {
    // Build connection URI without exposing credentials
    return `${this.type}://${this.host}:${this.port}/${this.database}`;
  }

  // Equality based on business identifier
  public equals(other: Connection): boolean {
    if (!(other instanceof Connection)) {
      return false;
    }
    return this.id === other.id;
  }

  // Value object for connection health
  public getHealthStatus(): ConnectionHealth {
    return new ConnectionHealth(this.id, this.type, this.isActive());
  }
}

/**
 * Value Object: Connection Health Status
 */
export class ConnectionHealth {
  constructor(
    public readonly connectionId: string,
    public readonly type: DatabaseType,
    public readonly isActive: boolean,
    public readonly lastChecked?: Date,
    public readonly responseTime?: number,
    public readonly error?: string
  ) {}

  public isHealthy(): boolean {
    return this.isActive && !this.error &&
           (!this.responseTime || this.responseTime < 5000); // 5s threshold
  }
}

/**
 * Value Object: Connection Credentials (Encrypted)
 */
export class ConnectionCredentials {
  constructor(
    public readonly encryptedData: string,
    public readonly algorithm: string = 'aes-256-gcm',
    public readonly iv: string,
    public readonly tag: string
  ) {}

  public static fromPlainText(plainText: string, key: string): ConnectionCredentials {
    // Implementation uses crypto module
    // This is a placeholder - actual encryption happens in the infrastructure layer
    return new ConnectionCredentials(
      'encrypted_placeholder',
      'aes-256-gcm',
      'iv_placeholder',
      'tag_placeholder'
    );
  }
}

/**
 * Value Object: Connection Metadata
 */
export class ConnectionMetadata {
  constructor(
    public readonly version: string,
    public readonly driver: string,
    public readonly features: string[],
    public readonly limits: ConnectionLimits
  ) {}
}

export class ConnectionLimits {
  constructor(
    public readonly maxConnections: number,
    public readonly maxQueryTime: number,
    public readonly maxResultSize: number
  ) {}
}
