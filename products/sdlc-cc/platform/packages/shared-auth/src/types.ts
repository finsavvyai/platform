export interface SDLCUser {
  id: string;
  email: string;
  name?: string;
  tier: 'starter' | 'professional' | 'enterprise';
  features: FeatureAccess;
  organizationId?: string;
  tenantId?: string;
  preferences?: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureAccess {
  rag: boolean;
  vectorSearch: boolean;
  dlp: boolean;
  compliance: boolean;
  adminUI: boolean;
  documentProcessor: boolean;
  developerPortal: boolean;
  realtimeStreaming: boolean;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: NotificationPreferences;
  language: string;
  timezone: string;
}

export interface NotificationPreferences {
  email: boolean;
  inApp: boolean;
  slack: boolean;
  security: boolean;
  compliance: boolean;
  usage: boolean;
}

export interface Subscription {
  id: string;
  userId: string;
  tier: 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'cancelled' | 'past_due' | 'incomplete';
  currentPeriodEnd: Date;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  tier: 'professional' | 'enterprise';
  domains: string[];
  ssoConfig?: SSOConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface SSOConfig {
  provider: 'okta' | 'azure' | 'google' | 'saml';
  entityId?: string;
  ssoUrl?: string;
  cert?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  permissions: Permission[];
  joinedAt: Date;
}

export interface Permission {
  resource: string;
  actions: ('read' | 'write' | 'delete' | 'admin')[];
}

export interface AuthConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  jwtSecret: string;
  jwtExpiresIn?: string;
  refreshTokenExpiresIn?: string;
  frontendUrl: string;
}

export interface LoginResponse {
  user: SDLCUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RegistrationRequest {
  email: string;
  password: string;
  name: string;
  tier?: 'starter' | 'professional' | 'enterprise';
  organizationId?: string;
  referralCode?: string;
}

export interface ProductUsage {
  userId: string;
  productId: string;
  metric: string;
  quantity: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface AuthToken {
  userId: string;
  email: string;
  tier: string;
  features: FeatureAccess;
  organizationId?: string;
  tenantId?: string;
  permissions: string[];
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

export interface MFASetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

// Subscription tiers configuration
export interface TierConfiguration {
  starter: {
    price: number;
    rag: { queriesPerMonth: number; maxDocuments: number };
    vectorSearch: { indexCount: number };
    dlp: { scansPerMonth: number };
    compliance: { frameworks: string[] };
    apiRateLimit: number;
  };
  professional: {
    price: number;
    rag: { queriesPerMonth: number; maxDocuments: number };
    vectorSearch: { indexCount: number };
    dlp: { scansPerMonth: number };
    compliance: { frameworks: string[] };
    apiRateLimit: number;
  };
  enterprise: {
    price: number;
    rag: { queriesPerMonth: number; maxDocuments: number };
    vectorSearch: { indexCount: number };
    dlp: { scansPerMonth: number };
    compliance: { frameworks: string[] };
    apiRateLimit: number;
  };
}

export const DEFAULT_TIER_CONFIGS: TierConfiguration = {
  starter: {
    price: 29,
    rag: { queriesPerMonth: 1000, maxDocuments: 100 },
    vectorSearch: { indexCount: 3 },
    dlp: { scansPerMonth: 500 },
    compliance: { frameworks: ['GDPR'] },
    apiRateLimit: 100,
  },
  professional: {
    price: 99,
    rag: { queriesPerMonth: 10000, maxDocuments: 1000 },
    vectorSearch: { indexCount: 20 },
    dlp: { scansPerMonth: 5000 },
    compliance: { frameworks: ['GDPR', 'HIPAA', 'FINRA', 'PCI-DSS'] },
    apiRateLimit: 1000,
  },
  enterprise: {
    price: 0, // custom pricing
    rag: { queriesPerMonth: -1, maxDocuments: -1 },
    vectorSearch: { indexCount: -1 },
    dlp: { scansPerMonth: -1 },
    compliance: { frameworks: ['GDPR', 'HIPAA', 'FINRA', 'PCI-DSS', 'SOC2', 'ISO27001'] },
    apiRateLimit: -1,
  },
};