export interface ApiKeyInfo {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  rateLimit: number;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ApiKeyCreateResponse {
  id: string;
  key: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
}
