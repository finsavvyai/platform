export interface Env {
  DB: D1Database;
  TF_NONCES: KVNamespace;
  ENVIRONMENT: string;
  AUTH_SECRET: string;
}

export interface ZtnaApp {
  id: string;
  ownerUserId: string;
  hostname: string;
  upstream: string;
  requiredTrustScore: number;
  forwardWriteMethods: boolean;
  status: 'active' | 'paused' | 'deleted';
}
